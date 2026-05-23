import type { AgentProfile } from "../../domain/agents.js";
import { RunStatePersistence, type LoadedResumeState } from "../../domain/run-state-persistence.js";
import type {
  ExecutionGraph,
  ExecutionGraphNode,
  ExecutionStatus,
  ExpertRuntimeMode,
  RecursiveModelConfig,
  RuntimeMemory,
  RuntimeRunState,
} from "../../domain/types.js";
import type { LanguageModelPort } from "../../ports/language-model-port.js";
import type { RuntimeLogger } from "../../ports/runtime-logger-port.js";
import { resolveAgent, type AgentRegistry } from "../execution/agent-registry.js";
import { runConfiguredAgent } from "../execution/agent-runner.js";
import type { InteractiveExecutionSession } from "../execution/execution-controller.js";
import { MemoryManager } from "../memory/memory-manager.js";
import {
  PurposeRoutingLanguageModel,
  type ModelRuntimeSelection,
} from "../execution/model-provider.js";
import type { ProjectConfig } from "../project-config.js";
import { resolveRuntimeHostSelection } from "../project-config.js";

export type GraphExecutorErrorCode =
  | "invalid_agent"
  | "invalid_runtime"
  | "blocked_by_failure"
  | "empty_graph"
  | "cycle_detected";

export class GraphExecutorError extends Error {
  constructor(
    public readonly code: GraphExecutorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GraphExecutorError";
  }
}

export interface GraphExecutorInput {
  projectConfig: ProjectConfig;
  runtimeConfig: RecursiveModelConfig;
  configPath?: string | undefined;
  registry: AgentRegistry;
  agentSource: "auto" | "override";
  memoryManager: MemoryManager;
  hostId?: string | undefined;
  createModel: (model: string, runtime: ModelRuntimeSelection) => LanguageModelPort;
  logger?: RuntimeLogger | undefined;
  runState?: RuntimeRunState | undefined;
  resume?: boolean | undefined;
  resolveMemory?: () => RuntimeMemory | undefined;
  memory?: RuntimeMemory | undefined;
}

export function topologicalExecutionOrder(graph: ExecutionGraph): string[] {
  const nodeIds = graph.nodes.map((node) => node.id);
  if (nodeIds.length === 0) {
    throw new GraphExecutorError("empty_graph", "Graph has no nodes.");
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of graph.edges) {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) {
      continue;
    }
    adjacency.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  for (const node of graph.nodes) {
    if (!node.parentId || !nodeById.has(node.parentId)) {
      continue;
    }
    const siblings = adjacency.get(node.parentId)!;
    if (!siblings.includes(node.id)) {
      siblings.push(node.id);
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
    }
  }

  const queue = nodeIds
    .filter((id) => (inDegree.get(id) ?? 0) === 0)
    .sort((left, right) => left.localeCompare(right));

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    const neighbors = [...(adjacency.get(current) ?? [])].sort((left, right) =>
      left.localeCompare(right),
    );
    for (const next of neighbors) {
      inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
      if (inDegree.get(next) === 0) {
        queue.push(next);
        queue.sort((left, right) => left.localeCompare(right));
      }
    }
  }

  if (order.length !== nodeIds.length) {
    throw new GraphExecutorError("cycle_detected", "Cycle detected in execution graph.");
  }

  return order;
}

export function buildExecutionPrompt(
  node: ExecutionGraphNode,
  ancestors: ExecutionGraphNode[],
): string {
  const lines: string[] = [];
  if (ancestors.length > 0) {
    lines.push("Context from ancestor steps:");
    ancestors.forEach((ancestor, index) => {
      lines.push(`${index + 1}. ${ancestor.label}: ${ancestor.prompt ?? ancestor.label}`);
    });
    lines.push("");
  }
  lines.push("Current task:");
  lines.push(node.prompt ?? node.label);
  return lines.join("\n");
}

function collectAncestors(
  node: ExecutionGraphNode,
  nodeById: Map<string, ExecutionGraphNode>,
): ExecutionGraphNode[] {
  const ancestors: ExecutionGraphNode[] = [];
  let current = node.parentId ? nodeById.get(node.parentId) : undefined;
  while (current) {
    ancestors.unshift(current);
    current = current.parentId ? nodeById.get(current.parentId) : undefined;
  }
  return ancestors;
}

function hasFailedAncestor(
  node: ExecutionGraphNode,
  failedNodeIds: Set<string>,
  nodeById: Map<string, ExecutionGraphNode>,
): boolean {
  let current = node.parentId ? nodeById.get(node.parentId) : undefined;
  while (current) {
    if (failedNodeIds.has(current.id)) {
      return true;
    }
    current = current.parentId ? nodeById.get(current.parentId) : undefined;
  }
  return false;
}

function filterAgentTools(agent: AgentProfile, allowlist?: string[]): AgentProfile {
  if (!allowlist || allowlist.length === 0) {
    return agent;
  }
  const allowed = new Set(allowlist.map((tool) => tool.trim()).filter(Boolean));
  return {
    ...agent,
    tools: agent.tools.filter((tool) => allowed.has(tool.name)),
  };
}

function isExpertRuntime(value: unknown): value is ExpertRuntimeMode {
  return value === "single-pass" || value === "rlm";
}

function shouldSkipExecutionStatus(status: ExecutionStatus): boolean {
  return (
    status === "skipped" ||
    status === "cancelled" ||
    status === "completed"
  );
}

function createRunStatePersistence(input: GraphExecutorInput): RunStatePersistence | undefined {
  if (!input.runState) {
    return undefined;
  }
  return new RunStatePersistence(input.runState, () => {});
}

async function persistRunStateStatus(
  persistence: RunStatePersistence | undefined,
  nodeId: string,
  status: string,
): Promise<void> {
  if (!persistence) {
    return;
  }
  try {
    await persistence.persistNodeStatus(nodeId, status);
  } catch {
    // Match Rust `_ =` — do not fail graph run on store rejection.
  }
}

async function persistResumeCursorTransition(
  persistence: RunStatePersistence | undefined,
  activeNodeId: string,
  completedNodeIds: string[],
): Promise<void> {
  if (!persistence) {
    return;
  }
  try {
    await persistence.persistResumeCursor({
      activeNodeId,
      completedNodeIds,
      variant: "playbook",
    });
  } catch {
    // Match Rust `_ =` — do not fail graph run on store rejection.
  }
}

async function prepareFreshRunState(
  input: GraphExecutorInput,
  graph: ExecutionGraph,
  persistence: RunStatePersistence | undefined,
): Promise<void> {
  if (!input.runState || !persistence || input.resume) {
    return;
  }
  const existing = await input.runState.store.getSnapshot(input.runState.runId);
  if (existing) {
    return;
  }
  const rootNode = graph.nodes.find((node) => node.parentId == null);
  const prompt = rootNode?.prompt ?? rootNode?.label ?? "graph run";
  const agentId = rootNode?.expertAgentId ?? "default";
  try {
    await persistence.initialize(prompt, agentId);
  } catch {
    // Match Rust `_ =` on fresh-run initialize.
  }
}

async function prepareResumeState(
  session: InteractiveExecutionSession,
  input: GraphExecutorInput,
  graph: ExecutionGraph,
  persistence: RunStatePersistence | undefined,
): Promise<{ skipCompleted: Set<string>; completedNodeIds: string[] }> {
  const skipCompleted = new Set<string>();
  let completedNodeIds: string[] = [];

  if (!input.resume || !input.runState || !persistence) {
    return { skipCompleted, completedNodeIds };
  }

  let resume: LoadedResumeState | undefined;
  try {
    resume = await persistence.loadResumeState();
  } catch {
    resume = undefined;
  }
  if (!resume) {
    return { skipCompleted, completedNodeIds };
  }

  for (const nodeId of resume.completedNodeIds) {
    if (graph.nodes.some((node) => node.id === nodeId)) {
      session.control.updateNodeStatus?.(nodeId, "completed");
    }
    skipCompleted.add(nodeId);
    completedNodeIds.push(nodeId);
  }

  return { skipCompleted, completedNodeIds };
}

export async function executeGraph(
  session: InteractiveExecutionSession,
  input: GraphExecutorInput,
): Promise<void> {
  const graph = session.snapshot().graph;
  if (graph.nodes.length === 0) {
    throw new GraphExecutorError("empty_graph", "Graph has no nodes.");
  }

  const order = topologicalExecutionOrder(graph);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const failedNodeIds = new Set<string>();
  const persistence = createRunStatePersistence(input);
  let completedNodeIds: string[] = [];

  await prepareFreshRunState(input, graph, persistence);
  const { skipCompleted, completedNodeIds: resumedCompleted } = await prepareResumeState(
    session,
    input,
    graph,
    persistence,
  );
  completedNodeIds = resumedCompleted;

  for (const nodeId of order) {
    const node = nodeById.get(nodeId);
    if (!node) {
      continue;
    }

    if (skipCompleted.has(nodeId)) {
      continue;
    }

    if (hasFailedAncestor(node, failedNodeIds, nodeById)) {
      session.control.updateNodeStatus?.(nodeId, "failed", {
        code: "blocked_by_failure",
        message: "Blocked: ancestor node failed",
      });
      await persistRunStateStatus(persistence, nodeId, "failed");
      failedNodeIds.add(nodeId);
      continue;
    }

    if (session.control.isCancelled()) {
      break;
    }

    if (shouldSkipExecutionStatus(node.status)) {
      continue;
    }

    const agentId = node.expertAgentId ?? "default";
    let boundAgent: AgentProfile;
    try {
      boundAgent = resolveAgent(input.registry, agentId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      session.control.updateNodeStatus?.(nodeId, "failed", {
        code: "invalid_agent",
        message,
      });
      await persistRunStateStatus(persistence, nodeId, "failed");
      failedNodeIds.add(nodeId);
      continue;
    }

    if (!isExpertRuntime(node.expertRuntime)) {
      session.control.updateNodeStatus?.(nodeId, "failed", {
        code: "invalid_runtime",
        message: "Runtime mode must be single-pass or rlm.",
      });
      await persistRunStateStatus(persistence, nodeId, "failed");
      failedNodeIds.add(nodeId);
      continue;
    }

    const runtime = node.expertRuntime;
    const toolAllowlist = node.expertToolAllowlist;
    const purposeTiers = node.expertPurposeTiers;

    if (session.control.waitForNodeApproval) {
      if (
        node.depth === 0 &&
        !node.spawnedAfterInitialApproval &&
        session.isConfirmedExecutionRunning()
      ) {
        session.control.updateNodeStatus?.(nodeId, "approved", {
          message: "graph confirmed for run",
        });
      } else {
        const decision = await session.control.waitForNodeApproval(node);
        if (decision.status === "skipped" || decision.status === "cancelled") {
          session.control.updateNodeStatus?.(nodeId, decision.status);
          await persistRunStateStatus(persistence, nodeId, decision.status);
          continue;
        }
      }
    }

    session.control.updateNodeStatus?.(nodeId, "running", {
      message: `Running as ${agentId} (${runtime})`,
    });
    await persistRunStateStatus(persistence, nodeId, "running");
    await persistResumeCursorTransition(persistence, nodeId, completedNodeIds);

    const ancestors = collectAncestors(node, nodeById);
    const prompt = buildExecutionPrompt(node, ancestors);
    const filteredAgent = filterAgentTools(boundAgent, toolAllowlist);

    try {
      if (runtime === "single-pass") {
        const model = new PurposeRoutingLanguageModel({
          config: input.projectConfig,
          agent: filteredAgent.config,
          hostSelection: resolveRuntimeHostSelection(input.projectConfig, {
            cliHostId: input.hostId,
          }),
          createModel: input.createModel,
          logger: input.logger,
        });
        const expertTier = purposeTiers?.answer?.trim();
        const response = await model.complete(
          [
            { role: "system", content: filteredAgent.systemPrompt },
            { role: "user", content: prompt },
          ],
          {
            purpose: "answer",
            overrideModelSelection: expertTier || undefined,
          },
        );
        input.logger?.log({
          stage: "graph-executor",
          message: "single-pass node completed",
          data: {
            nodeId,
            agentId,
            runtime,
            model: response.model,
          },
        });
      } else {
        await runConfiguredAgent({
          prompt,
          config: input.runtimeConfig,
          projectConfig: input.projectConfig,
          configPath: input.configPath,
          agent: filteredAgent,
          agentSource: input.agentSource,
          hostId: input.hostId,
          memoryManager: input.memoryManager,
          createModel: input.createModel,
          logger: input.logger,
          execution: session.control,
          runState: input.runState,
          memory: input.resolveMemory?.() ?? input.memory,
          nodeBinding: {
            toolAllowlist,
            purposeTiers,
          },
        });
      }

      session.control.updateNodeStatus?.(nodeId, "completed");
      completedNodeIds.push(nodeId);
      await persistRunStateStatus(persistence, nodeId, "completed");
      await persistResumeCursorTransition(persistence, nodeId, completedNodeIds);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      session.control.updateNodeStatus?.(nodeId, "failed", {
        message,
        failureCategory: "model",
      });
      await persistRunStateStatus(persistence, nodeId, "failed");
      failedNodeIds.add(nodeId);
    }
  }
}
