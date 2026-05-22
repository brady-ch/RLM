import { dirname, resolve as pathResolve } from "node:path";
import type { RecursivePromptResult } from "../domain/types.js";
import type { RuntimeLogger } from "../ports/runtime-logger-port.js";
import type { AgentRegistry } from "./agent-registry.js";
import { createInteractiveExecutionSession } from "./execution-controller.js";
import { executeGraph } from "./graph-executor.js";
import {
  applyPipelineTemplate,
  buildImportSessionSnapshot,
  graphHasPipelineTemplate,
  importSidecarToGraph,
} from "./graph-workflow-serializer.js";
import { loadGraphWorkflow } from "./graph-workflow-store.js";
import type { GraphWorkflowVariant } from "./graph-workflow-types.js";
import type { MemoryManager } from "./memory-manager.js";
import type { ModelRuntimeSelection } from "./model-provider.js";
import type { GraphWorkflowConfig, ProjectConfig } from "./project-config.js";
import type { LanguageModelPort } from "../ports/language-model-port.js";
import type { RuntimeMemory, RuntimeRunState } from "../domain/types.js";

export class GraphWorkflowRunError extends Error {
  constructor(
    public readonly code:
      | "missing_agent"
      | "missing_template"
      | "missing_input"
      | "invalid_sidecar"
      | "missing_variant",
    message: string,
    public readonly details?: { nodeId?: string; agentId?: string },
  ) {
    super(message);
    this.name = "GraphWorkflowRunError";
  }
}

export interface RunGraphWorkflowInput {
  workflowId: string;
  graphConfig: GraphWorkflowConfig;
  prompt: string;
  variant?: GraphWorkflowVariant | undefined;
  config: import("../domain/types.js").RecursiveModelConfig;
  projectConfig: ProjectConfig;
  configPath?: string | undefined;
  registry: AgentRegistry;
  memoryManager: MemoryManager;
  hostId?: string | undefined;
  createModel: (model: string, runtime: ModelRuntimeSelection) => LanguageModelPort;
  logger?: RuntimeLogger | undefined;
  runState?: RuntimeRunState | undefined;
  memory?: RuntimeMemory | undefined;
}

export function resolveGraphWorkflowVariant(input: {
  prompt: string;
  explicitVariant?: GraphWorkflowVariant | undefined;
  defaultVariant?: GraphWorkflowVariant | undefined;
}): GraphWorkflowVariant {
  if (input.explicitVariant) {
    return input.explicitVariant;
  }
  if (input.prompt.trim().length > 0) {
    return "pipeline";
  }
  return input.defaultVariant ?? "playbook";
}

export function validateGraphForRun(
  graph: import("../domain/types.js").ExecutionGraph,
  projectConfig: ProjectConfig,
  registry: AgentRegistry,
  variant: GraphWorkflowVariant,
): void {
  if (graph.nodes.length === 0) {
    throw new GraphWorkflowRunError("invalid_sidecar", "Graph workflow has no nodes.");
  }

  if (variant === "pipeline" && !graphHasPipelineTemplate(graph)) {
    throw new GraphWorkflowRunError(
      "missing_template",
      "Workflow run failed: pipeline variant requires `{{input}}` in root prompt.",
    );
  }

  for (const node of graph.nodes) {
    const agentId = node.expertAgentId ?? "default";
    const knownAgent =
      registry.profiles.some((profile) => profile.id === agentId) ||
      Boolean(projectConfig.agents[agentId]);
    if (!knownAgent) {
      throw new GraphWorkflowRunError(
        "missing_agent",
        `Workflow run failed: unknown expert '${agentId}' on node '${node.id}'.`,
        { nodeId: node.id, agentId },
      );
    }

    if (node.expertPurposeTiers) {
      for (const tier of Object.values(node.expertPurposeTiers)) {
        if (!tier || tier === "dynamic") {
          continue;
        }
        if (!projectConfig.models.tiers[tier] && tier.trim().length > 0) {
          throw new GraphWorkflowRunError(
            "missing_agent",
            `Workflow run failed: unknown model tier '${tier}' on node '${node.id}'.`,
            { nodeId: node.id },
          );
        }
      }
    }
  }
}

function buildGraphWorkflowResult(
  session: ReturnType<typeof createInteractiveExecutionSession>,
  workflowId: string,
  variant: GraphWorkflowVariant,
  maxModelCalls: number,
  maxToolRounds: number,
): RecursivePromptResult {
  const snapshot = session.snapshot();
  const nodes = snapshot.graph.nodes;
  const errors: string[] = [];
  const answer = nodes
    .filter((node) => node.kind === "task")
    .map((node) => {
      if (node.status === "failed") {
        errors.push(`${node.id}: execution failed`);
      }
      return `## ${node.label}\n${node.prompt ?? node.label}`;
    })
    .join("\n\n");

  const anyFailed = nodes.some((node) => node.status === "failed");
  const executionStatus = anyFailed ? "failed" : "completed";

  return {
    answer,
    trace: [],
    metadata: {
      agent: { id: "workflow", source: "auto" },
      workflow: {
        id: workflowId,
        agents: [...new Set(nodes.map((node) => node.expertAgentId ?? "default"))],
        variant,
      },
      executionGraph: snapshot.graph,
      executionStatus,
      depth: { selected: 0, source: "fallback" },
      modelSelections: [],
      memoryReservations: [],
      modelCalls: 0,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        unknownCompletions: 0,
      },
      toolCalls: [],
      errors,
      budget: {
        estimatedModelCalls: maxModelCalls * Math.max(1, nodes.length),
        estimatedToolRounds: maxToolRounds,
        modelCallsUsed: 0,
        modelCallsRemaining: maxModelCalls * Math.max(1, nodes.length),
        toolCallsUsed: 0,
      },
    },
  };
}

export async function runGraphWorkflow(
  input: RunGraphWorkflowInput,
): Promise<RecursivePromptResult> {
  let sidecar;
  try {
    sidecar = await loadGraphWorkflow(input.workflowId, {
      projectRoot: input.configPath ? resolveProjectRoot(input.configPath) : process.cwd(),
      path: input.graphConfig.path,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GraphWorkflowRunError("invalid_sidecar", message);
  }

  const variant = resolveGraphWorkflowVariant({
    prompt: input.prompt,
    explicitVariant: input.variant ?? input.graphConfig.defaultVariant,
  });

  let imported;
  try {
    imported = importSidecarToGraph(sidecar, variant);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GraphWorkflowRunError("missing_variant", message);
  }

  let graph = imported.graph;
  if (variant === "pipeline") {
    if (!input.prompt.trim()) {
      throw new GraphWorkflowRunError(
        "missing_input",
        "Pipeline variant requires task input to substitute `{{input}}`.",
      );
    }
    graph = applyPipelineTemplate(graph, { input: input.prompt.trim() });
  }

  validateGraphForRun(graph, input.projectConfig, input.registry, variant);

  input.logger?.log({
    stage: "workflow",
    message: "starting graph workflow",
    data: {
      workflow: input.workflowId,
      variant,
      nodeCount: graph.nodes.length,
    },
  });

  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  session.restoreSnapshot(buildImportSessionSnapshot(graph));
  session.beginConfirmedExecution();

  try {
    await executeGraph(session, {
      projectConfig: input.projectConfig,
      runtimeConfig: input.config,
      configPath: input.configPath,
      registry: input.registry,
      agentSource: "auto",
      memoryManager: input.memoryManager,
      hostId: input.hostId,
      createModel: input.createModel,
      logger: input.logger,
      runState: input.runState,
      memory: input.memory,
    });
  } finally {
    session.finishConfirmedExecution();
  }

  const result = buildGraphWorkflowResult(
    session,
    input.workflowId,
    variant,
    input.config.maxModelCalls,
    input.config.maxToolRounds,
  );
  input.logger?.log({
    stage: "workflow",
    message: "completed graph workflow",
    data: {
      workflow: input.workflowId,
      variant,
      executionStatus: result.metadata.executionStatus,
      errors: result.metadata.errors.length,
    },
  });
  return result;
}

function resolveProjectRoot(configPath: string): string {
  return pathResolve(dirname(configPath), "..");
}
