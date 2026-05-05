import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelPurpose,
  LanguageModelResponse,
} from "../ports/language-model-port.js";
import type { AgentConfig, ProjectConfig } from "./project-config.js";
import { resolveModelTier } from "./project-config.js";

export interface ModelProviderOptions {
  config: ProjectConfig;
  agent: AgentConfig;
  baseUrl?: string | undefined;
  createModel: (model: string) => LanguageModelPort;
  recordSelection?: (selection: ModelSelectionRecord) => void;
}

export interface ModelSelectionRecord {
  purpose: LanguageModelPurpose | "default";
  model: string;
  tier: string;
  estimatedRamMb: number;
}

export class PurposeRoutingLanguageModel implements LanguageModelPort {
  private readonly cache = new Map<string, LanguageModelPort>();

  constructor(private readonly options: ModelProviderOptions) {}

  async complete(
    messages: LanguageModelMessage[],
    completeOptions: LanguageModelCompleteOptions = {},
  ): Promise<LanguageModelResponse> {
    const selection = this.selectModel(completeOptions.purpose, completeOptions.complexityDepth);
    this.options.recordSelection?.(selection);
    return this.getModel(selection.model).complete(messages, completeOptions);
  }

  selectModel(purpose: LanguageModelPurpose | undefined, complexityDepth = 0): ModelSelectionRecord {
    const normalizedPurpose = purpose ?? "default";
    const configuredSelection = purpose ? this.options.agent.models[purpose] : undefined;
    const tierName = configuredSelection === "dynamic"
      ? selectDynamicTier(complexityDepth)
      : configuredSelection ?? "small";
    const tier = resolveModelTier(this.options.config, tierName);

    return {
      purpose: normalizedPurpose,
      model: tier.name,
      tier: tierName,
      estimatedRamMb: tier.estimatedRamMb,
    };
  }

  private getModel(model: string): LanguageModelPort {
    const existing = this.cache.get(model);
    if (existing) {
      return existing;
    }

    const created = this.options.createModel(model);
    this.cache.set(model, created);
    return created;
  }
}

export function estimateAgentRamMb(config: ProjectConfig, agent: AgentConfig, complexityDepth: number): number {
  return Math.max(
    ...Object.values(agent.models).map((selection) => {
      const tierName = selection === "dynamic" ? selectDynamicTier(complexityDepth) : selection;
      return resolveModelTier(config, tierName).estimatedRamMb;
    }),
  );
}

export function selectDynamicTier(complexityDepth: number): string {
  if (complexityDepth >= 3) {
    return "large";
  }

  if (complexityDepth >= 2) {
    return "medium";
  }

  return "small";
}
