import type {
  EffectiveSamplingMetadata,
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelPurpose,
  LanguageModelResponse,
  LanguageModelSamplingOptions,
  SamplingParameterName,
  SamplingSourceLayer,
} from "../ports/language-model-port.js";
import type { AgentConfig, ProjectConfig, RuntimeHostSelection } from "./project-config.js";
import { resolveModelTier } from "./project-config.js";
import type { RuntimeLogger } from "../ports/runtime-logger-port.js";

export interface ModelProviderOptions {
  config: ProjectConfig;
  agent: AgentConfig;
  hostSelection?: RuntimeHostSelection | undefined;
  createModel: (model: string, runtime: ModelRuntimeSelection) => LanguageModelPort;
  resolveUnavailableHostDecision?:
    | ((input: {
        requestedHostId: string;
        availableHostIds: string[];
      }) => Promise<{ action: "retry" | "switch" | "abort"; hostId?: string }>)
    | undefined;
  recordSelection?: (selection: ModelSelectionRecord) => void;
  logger?: RuntimeLogger | undefined;
}

export interface ModelSelectionRecord {
  purpose: LanguageModelPurpose | "default";
  model: string;
  tier: string;
  estimatedRamMb: number;
  source: "configured";
  hostId: string;
  hostKind: "ollama" | "http";
  hostEndpoint: string;
  sampling?: EffectiveSamplingMetadata | undefined;
}

export interface ModelRuntimeSelection {
  hostId: string;
  hostKind: "ollama" | "http";
  baseUrl: string;
  allowUnconstrainedToolCalls: boolean;
}

const SAMPLING_KEYS = [
  "temperature",
  "topP",
  "topK",
  "repeatPenalty",
  "maxTokens",
  "seed",
] as const satisfies readonly SamplingParameterName[];

const ADAPTER_DEFAULT_SAMPLING: Partial<
  Record<ModelRuntimeSelection["hostKind"], LanguageModelSamplingOptions>
> = {
  ollama: {
    temperature: 0.2,
  },
};

export class PurposeRoutingLanguageModel implements LanguageModelPort {
  private readonly cache = new Map<string, LanguageModelPort>();

  constructor(private readonly options: ModelProviderOptions) {}

  async complete(
    messages: LanguageModelMessage[],
    completeOptions: LanguageModelCompleteOptions = {},
  ): Promise<LanguageModelResponse> {
    if (completeOptions.overrideModel || completeOptions.overrideModelSelection) {
      const override = this.resolveOverrideSelection(completeOptions);
      const model = override.model;
      const runtime = await this.resolveRuntimeSelection();
      const sampling = this.resolveSampling(model, runtime.hostKind, completeOptions.sampling);
      const response = await this.getModel(model, runtime).complete(messages, {
        ...completeOptions,
        sampling: sampling.values,
      });
      response.model ??= model;
      response.sampling = mergeSamplingMetadata(sampling, response.sampling);
      response.host ??= {
        id: runtime.hostId,
        kind: runtime.hostKind,
        endpoint: runtime.baseUrl,
      };
      this.options.recordSelection?.({
        purpose: completeOptions.purpose ?? "default",
        model,
        tier: override.tier,
        estimatedRamMb: override.estimatedRamMb,
        source: "configured",
        hostId: runtime.hostId,
        hostKind: runtime.hostKind,
        hostEndpoint: runtime.baseUrl,
        sampling: response.sampling,
      });
      this.options.logger?.log({
        stage: "model",
        message: "selected model",
        data: {
          purpose: completeOptions.purpose ?? "default",
          model,
          tier: override.tier,
          estimatedRamMb: override.estimatedRamMb,
          source: "configured",
          hostId: runtime.hostId,
          hostKind: runtime.hostKind,
          hostEndpoint: runtime.baseUrl,
          sampling: response.sampling,
        },
      });
      return response;
    }

    const selection = await this.selectModel(
      completeOptions.purpose,
      completeOptions.complexityDepth,
    );
    const runtime: ModelRuntimeSelection = {
      hostId: selection.hostId,
      hostKind: selection.hostKind,
      baseUrl: selection.hostEndpoint,
      allowUnconstrainedToolCalls: false,
    };
    const sampling = this.resolveSampling(
      selection.model,
      selection.hostKind,
      completeOptions.sampling,
    );
    const selectionWithSampling: ModelSelectionRecord = { ...selection, sampling };
    this.options.recordSelection?.(selectionWithSampling);
    this.options.logger?.log({
      stage: "model",
      message: "selected model",
      data: {
        purpose: selection.purpose,
        model: selection.model,
        tier: selection.tier,
        estimatedRamMb: selection.estimatedRamMb,
        source: selection.source,
        sampling,
      },
    });
    const response = await this.getModel(selection.model, runtime).complete(messages, {
      ...completeOptions,
      sampling: sampling.values,
    });
    response.model ??= selection.model;
    response.sampling = mergeSamplingMetadata(sampling, response.sampling);
    response.host ??= {
      id: selection.hostId,
      kind: selection.hostKind,
      endpoint: selection.hostEndpoint,
    };

    return response;
  }

  resolveOverrideSelection(completeOptions: LanguageModelCompleteOptions): {
    model: string;
    tier: string;
    estimatedRamMb: number;
  } {
    const selection = completeOptions.overrideModelSelection ?? completeOptions.overrideModel;
    if (!selection) {
      throw new Error("override model selection is required");
    }

    if (completeOptions.overrideModelSelection) {
      const tier = this.options.config.models.tiers[selection];
      if (tier) {
        return {
          model: tier.name,
          tier: selection,
          estimatedRamMb: tier.estimatedRamMb,
        };
      }
    }

    return {
      model: selection,
      tier: "override",
      estimatedRamMb: 0,
    };
  }

  async selectModel(
    purpose: LanguageModelPurpose | undefined,
    complexityDepth = 0,
  ): Promise<ModelSelectionRecord> {
    const normalizedPurpose = purpose ?? "default";
    const configuredSelection = purpose ? this.options.agent.models[purpose] : undefined;
    const tierName =
      configuredSelection === "dynamic"
        ? selectDynamicTier(complexityDepth)
        : (configuredSelection ?? "small");
    const tier = resolveModelTier(this.options.config, tierName);

    const runtime = await this.resolveRuntimeSelection();

    return {
      purpose: normalizedPurpose,
      model: tier.name,
      tier: tierName,
      estimatedRamMb: tier.estimatedRamMb,
      source: "configured",
      hostId: runtime.hostId,
      hostKind: runtime.hostKind,
      hostEndpoint: runtime.baseUrl,
    };
  }

  private resolveSampling(
    model: string,
    hostKind: ModelRuntimeSelection["hostKind"],
    nodeOverride?: LanguageModelSamplingOptions | undefined,
  ): EffectiveSamplingMetadata {
    return mergeSamplingLayers([
      { source: "adapter_default", values: ADAPTER_DEFAULT_SAMPLING[hostKind] },
      { source: "global", values: this.options.config.models.sampling?.defaults },
      {
        source: "model_profile",
        values: this.options.config.models.sampling?.modelProfiles?.[model],
      },
      { source: "node", values: nodeOverride },
    ]);
  }

  private getModel(model: string, runtime?: ModelRuntimeSelection): LanguageModelPort {
    const cacheKey = runtime ? `${runtime.hostId}:${model}` : model;
    const existing = this.cache.get(cacheKey);
    if (existing) {
      return existing;
    }

    if (!runtime) {
      throw new Error(`Runtime host selection is required for model "${model}".`);
    }
    const created = this.options.createModel(model, runtime);
    this.cache.set(cacheKey, created);
    return created;
  }

  private async resolveRuntimeSelection(): Promise<ModelRuntimeSelection> {
    const hosts = this.options.config.hosts ?? {
      local_ollama: {
        kind: "ollama" as const,
        baseUrl: "http://127.0.0.1:11434",
        available: true,
        allowUnconstrainedToolCalls: false,
      },
    };
    const requested = this.options.hostSelection ?? {
      hostId: "local_ollama",
      source: "default" as const,
    };
    let requestedHostId = requested.hostId;
    let host = hosts[requestedHostId];

    while (!host || host.available === false) {
      const availableHostIds = Object.entries(hosts)
        .filter(([, value]) => value.available !== false)
        .map(([id]) => id);
      const decision = await this.options.resolveUnavailableHostDecision?.({
        requestedHostId,
        availableHostIds,
      });
      if (!decision || decision.action === "abort") {
        throw new Error(
          `selected model unavailable: requested host "${requestedHostId}" is unavailable`,
        );
      }
      if (decision.action === "retry") {
        host = hosts[requestedHostId];
        continue;
      }
      if (decision.action === "switch") {
        const nextHostId = decision.hostId?.trim();
        if (!nextHostId || !hosts[nextHostId]) {
          throw new Error(`Requested host switch target "${decision.hostId ?? ""}" is invalid.`);
        }
        requestedHostId = nextHostId;
        host = hosts[requestedHostId];
      }
    }

    return {
      hostId: requestedHostId,
      hostKind: host.kind,
      baseUrl: host.baseUrl,
      allowUnconstrainedToolCalls: host.allowUnconstrainedToolCalls ?? false,
    };
  }
}

export function estimateAgentRamMb(
  config: ProjectConfig,
  agent: AgentConfig,
  complexityDepth: number,
): number {
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

function mergeSamplingLayers(
  layers: Array<{ source: SamplingSourceLayer; values?: LanguageModelSamplingOptions | undefined }>,
): EffectiveSamplingMetadata {
  const values: LanguageModelSamplingOptions = {};
  const sources: EffectiveSamplingMetadata["sources"] = {};

  for (const layer of layers) {
    if (!layer.values) {
      continue;
    }
    for (const key of SAMPLING_KEYS) {
      const value = layer.values[key];
      if (value === undefined) {
        continue;
      }
      values[key] = value;
      sources[key] = layer.source;
    }
  }

  return { values, sources };
}

function mergeSamplingMetadata(
  resolved: EffectiveSamplingMetadata,
  adapterMetadata?: EffectiveSamplingMetadata | undefined,
): EffectiveSamplingMetadata {
  return {
    values: {
      ...resolved.values,
      ...adapterMetadata?.values,
    },
    sources: {
      ...resolved.sources,
      ...adapterMetadata?.sources,
    },
    warnings: [...(resolved.warnings ?? []), ...(adapterMetadata?.warnings ?? [])],
  };
}
