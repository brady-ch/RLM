import type { AgentProfile } from "../domain/agents.js";
import type {
  ModelSelectionTrace,
  RecursiveModelConfig,
  RecursivePromptResult,
} from "../domain/types.js";
import type { LanguageModelPort } from "../ports/language-model-port.js";
import type { ToolPort } from "../ports/tool-port.js";
import { InMemoryTrace } from "../adapters/in-memory-trace.js";
import { runRecursivePrompt } from "./run-recursive-prompt.js";
import type { ProjectConfig } from "./project-config.js";
import { MemoryManager } from "./memory-manager.js";
import { estimateAgentRamMb, PurposeRoutingLanguageModel } from "./model-provider.js";
import type { ModelRuntimeSelection } from "./model-provider.js";
import { selectedAgentMetadata } from "./agent-registry.js";
import type { RuntimeLogger } from "../ports/runtime-logger-port.js";
import type { LanguageModelPurpose } from "../ports/language-model-port.js";
import type { ExecutionControl, RuntimeMemory, RuntimeRunState } from "../domain/types.js";
import { resolveRuntimeHostSelection } from "./project-config.js";

export interface RunConfiguredAgentInput {
  prompt: string;
  config: RecursiveModelConfig;
  projectConfig: ProjectConfig;
  configPath?: string | undefined;
  agent: AgentProfile;
  agentSource: "auto" | "override";
  baseUrl?: string | undefined;
  hostId?: string | undefined;
  memoryManager: MemoryManager;
  createModel: (model: string, runtime: ModelRuntimeSelection) => LanguageModelPort;
  logger?: RuntimeLogger | undefined;
  execution?: ExecutionControl | undefined;
  runState?: RuntimeRunState | undefined;
  memory?: RuntimeMemory | undefined;
  nodeBinding?:
    | {
        toolAllowlist?: string[] | undefined;
        purposeTiers?: Partial<Record<LanguageModelPurpose, string>> | undefined;
      }
    | undefined;
}

class NodeBindingLanguageModel implements LanguageModelPort {
  constructor(
    private readonly inner: PurposeRoutingLanguageModel,
    private readonly purposeTiers?: Partial<Record<LanguageModelPurpose, string>> | undefined,
  ) {}

  async complete(
    messages: Parameters<LanguageModelPort["complete"]>[0],
    options: Parameters<LanguageModelPort["complete"]>[1] = {},
  ) {
    const tier =
      options.purpose && !options.overrideModel && !options.overrideModelSelection
        ? this.purposeTiers?.[options.purpose]?.trim()
        : undefined;
    return this.inner.complete(messages, {
      ...options,
      overrideModel: tier ? undefined : options.overrideModel,
      overrideModelSelection: tier ?? options.overrideModelSelection,
    });
  }
}

function filterAgentTools(agent: AgentProfile, allowlist?: string[]): ToolPort[] {
  if (!allowlist || allowlist.length === 0) {
    return agent.tools;
  }
  const allowed = new Set(allowlist.map((tool) => tool.trim()).filter(Boolean));
  return agent.tools.filter((tool) => allowed.has(tool.name));
}

export async function runConfiguredAgent(
  input: RunConfiguredAgentInput,
): Promise<RecursivePromptResult> {
  const estimatedDepth = estimatePromptDepth(input.prompt);
  const requestedRamMb = estimateAgentRamMb(
    input.projectConfig,
    input.agent.config,
    estimatedDepth,
  );
  const startedAt = Date.now();
  input.logger?.log({
    stage: "agent",
    message: "requesting memory reservation",
    data: {
      agent: input.agent.id,
      estimatedDepth,
      requestedRamMb,
    },
  });
  const reservation = await input.memoryManager.reserve(requestedRamMb);
  const waitedMs = Date.now() - startedAt;
  input.logger?.log({
    stage: "agent",
    message: "memory reservation acquired",
    data: {
      agent: input.agent.id,
      requestedRamMb: reservation.requestedRamMb,
      availableRamMb: reservation.snapshot.availableRamMb,
      waitedMs,
    },
  });
  const modelSelections: ModelSelectionTrace[] = [];

  try {
    const baseModel = new PurposeRoutingLanguageModel({
      config: input.projectConfig,
      agent: input.agent.config,
      hostSelection: resolveRuntimeHostSelection(input.projectConfig, {
        cliHostId: input.hostId,
      }),
      createModel: input.createModel,
      logger: input.logger,
      recordSelection: (selection) => {
        modelSelections.push({
          agent: input.agent.id,
          purpose: selection.purpose,
          model: selection.model,
          tier: selection.tier,
          estimatedRamMb: selection.estimatedRamMb,
          source: selection.source,
          hostId: selection.hostId,
          hostKind: selection.hostKind,
          hostEndpoint: selection.hostEndpoint,
        });
      },
    });
    const model = input.nodeBinding?.purposeTiers
      ? new NodeBindingLanguageModel(baseModel, input.nodeBinding.purposeTiers)
      : baseModel;
    const trace = new InMemoryTrace();
    const result = await runRecursivePrompt({
      prompt: input.prompt,
      config: input.config,
      model,
      trace,
      tools: filterAgentTools(input.agent, input.nodeBinding?.toolAllowlist),
      agent: selectedAgentMetadata(input.agent, input.agentSource),
      logger: input.logger,
      execution: input.execution,
      runState: input.runState,
      memory: input.memory,
    });

    result.metadata.configPath = input.configPath;
    result.metadata.modelSelections.push(...modelSelections);
    result.metadata.memoryReservations.push({
      agent: input.agent.id,
      requestedRamMb: reservation.requestedRamMb,
      availableRamMb: reservation.snapshot.availableRamMb,
      waitedMs,
    });
    return result;
  } finally {
    reservation.release();
  }
}

export function estimatePromptDepth(prompt: string): number {
  const normalized = prompt.toLowerCase();
  if (
    prompt.length > 1_500 ||
    /\b(architecture|workflow|multi-agent|migrate|refactor|system)\b/.test(normalized)
  ) {
    return 3;
  }

  if (prompt.length > 500 || /\b(compare|design|implement|research|analyze)\b/.test(normalized)) {
    return 2;
  }

  return 1;
}
