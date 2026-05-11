import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelPurpose,
  LanguageModelResponse,
} from "../ports/language-model-port.js";
import type {
  AgentConfig,
  ModelCandidateConfig,
  ModelTierConfig,
  ProjectConfig,
  RuntimeHostSelection,
} from "./project-config.js";
import { resolveHostConfig, resolveModelTier } from "./project-config.js";
import type { ModelScoreStore } from "./model-score-store.js";
import type { RuntimeLogger } from "../ports/runtime-logger-port.js";

export interface ModelProviderOptions {
  config: ProjectConfig;
  agent: AgentConfig;
  hostSelection?: RuntimeHostSelection | undefined;
  createModel: (model: string, runtime: ModelRuntimeSelection) => LanguageModelPort;
  resolveUnavailableHostDecision?: ((input: {
    requestedHostId: string;
    availableHostIds: string[];
  }) => Promise<{ action: "retry" | "switch" | "abort"; hostId?: string }>) | undefined;
  recordSelection?: (selection: ModelSelectionRecord) => void;
  scoreStore?: ModelScoreStore | undefined;
  random?: (() => number) | undefined;
  logger?: RuntimeLogger | undefined;
}

export interface ModelSelectionRecord {
  purpose: LanguageModelPurpose | "default";
  model: string;
  tier: string;
  estimatedRamMb: number;
  source: "configured" | "rotation";
  evaluatorModel?: string | undefined;
  hostId: string;
  hostKind: "ollama" | "http";
  hostEndpoint: string;
}

export interface ModelRuntimeSelection {
  hostId: string;
  hostKind: "ollama" | "http";
  baseUrl: string;
  allowUnconstrainedToolCalls: boolean;
}

export class PurposeRoutingLanguageModel implements LanguageModelPort {
  private readonly cache = new Map<string, LanguageModelPort>();

  constructor(private readonly options: ModelProviderOptions) {}

  async complete(
    messages: LanguageModelMessage[],
    completeOptions: LanguageModelCompleteOptions = {},
  ): Promise<LanguageModelResponse> {
    if (completeOptions.overrideModel) {
      const model = completeOptions.overrideModel;
      const runtime = await this.resolveRuntimeSelection();
      const response = await this.getModel(model, runtime).complete(messages, completeOptions);
      response.model ??= model;
      response.host ??= {
        id: runtime.hostId,
        kind: runtime.hostKind,
        endpoint: runtime.baseUrl,
      };
      this.options.recordSelection?.({
        purpose: completeOptions.purpose ?? "default",
        model,
        tier: "override",
        estimatedRamMb: 0,
        source: "configured",
        hostId: runtime.hostId,
        hostKind: runtime.hostKind,
        hostEndpoint: runtime.baseUrl,
      });
      this.options.logger?.log({
        stage: "model",
        message: "selected model",
        data: {
          purpose: completeOptions.purpose ?? "default",
          model,
          tier: "override",
          estimatedRamMb: 0,
          source: "configured",
          hostId: runtime.hostId,
          hostKind: runtime.hostKind,
          hostEndpoint: runtime.baseUrl,
        },
      });
      return response;
    }

    const selection = await this.selectModel(completeOptions.purpose, completeOptions.complexityDepth);
    this.options.recordSelection?.(selection);
    this.options.logger?.log({
      stage: "model",
      message: "selected model",
      data: {
        purpose: selection.purpose,
        model: selection.model,
        tier: selection.tier,
        estimatedRamMb: selection.estimatedRamMb,
        source: selection.source,
      },
    });
    const response = await this.getModel(selection.model, {
      hostId: selection.hostId,
      hostKind: selection.hostKind,
      baseUrl: selection.hostEndpoint,
      allowUnconstrainedToolCalls: false,
    }).complete(messages, completeOptions);
    response.model ??= selection.model;
    response.host ??= {
      id: selection.hostId,
      kind: selection.hostKind,
      endpoint: selection.hostEndpoint,
    };
    if (selection.source === "rotation") {
      try {
        await this.rateRotatedResponse(selection, messages, response, completeOptions);
      } catch {
        // Scoring is advisory; a rating failure should not discard a completed model step.
      }
    }

    return response;
  }

  async selectModel(purpose: LanguageModelPurpose | undefined, complexityDepth = 0): Promise<ModelSelectionRecord> {
    const normalizedPurpose = purpose ?? "default";
    const configuredSelection = purpose ? this.options.agent.models[purpose] : undefined;
    const tierName = configuredSelection === "dynamic"
      ? selectDynamicTier(complexityDepth)
      : configuredSelection ?? "small";
    const tier = resolveModelTier(this.options.config, tierName);
    const evaluatorModel = this.selectEvaluatorModel();
    const rotatedModel = purpose && this.shouldRotate()
      ? await this.selectRotatedModel(tierName, tier, purpose)
      : undefined;

    const runtime = await this.resolveRuntimeSelection();

    return {
      purpose: normalizedPurpose,
      model: rotatedModel?.name ?? tier.name,
      tier: tierName,
      estimatedRamMb: tier.estimatedRamMb,
      source: rotatedModel ? "rotation" : "configured",
      evaluatorModel: rotatedModel ? evaluatorModel : undefined,
      hostId: runtime.hostId,
      hostKind: runtime.hostKind,
      hostEndpoint: runtime.baseUrl,
    };
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
    const requested = this.options.hostSelection ?? { hostId: "local_ollama", source: "default" as const };
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
        throw new Error(`selected model unavailable: requested host "${requestedHostId}" is unavailable`);
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

  private shouldRotate(): boolean {
    const rotation = this.options.config.models.rotation;
    if (!rotation.enabled || !this.options.scoreStore || rotation.sampleRate <= 0) {
      return false;
    }

    return (this.options.random ?? Math.random)() < rotation.sampleRate;
  }

  private async selectRotatedModel(
    tierName: string,
    tier: ModelTierConfig,
    purpose: LanguageModelPurpose,
  ): Promise<ModelCandidateConfig | undefined> {
    const candidates = (tier.alternateModels ?? []).filter((candidate) => candidate.useCases.includes(purpose));
    if (candidates.length === 0) {
      return undefined;
    }

    let best: { candidate: ModelCandidateConfig; score: number } | undefined;
    for (const candidate of candidates) {
      const score = await this.options.scoreStore?.getAverageScore(candidate.name, tierName, purpose) ?? 0;
      if (!best || score > best.score) {
        best = {
          candidate,
          score,
        };
      }
    }

    return best?.candidate;
  }

  private selectEvaluatorModel(): string {
    const tiers = this.options.config.models.tiers;
    const preferredTier = this.options.config.models.rotation.evaluatorTier
      ? tiers[this.options.config.models.rotation.evaluatorTier]
      : undefined;
    if (preferredTier) {
      return preferredTier.name;
    }

    return Object.values(tiers)
      .sort((left, right) => right.estimatedRamMb - left.estimatedRamMb)[0]?.name ?? this.options.config.models.default;
  }

  private async rateRotatedResponse(
    selection: ModelSelectionRecord,
    messages: LanguageModelMessage[],
    response: LanguageModelResponse,
    completeOptions: LanguageModelCompleteOptions,
  ): Promise<void> {
    if (!this.options.scoreStore || !selection.evaluatorModel) {
      return;
    }

    const ratingOptions: LanguageModelCompleteOptions = {};
    if (completeOptions.purpose) {
      ratingOptions.purpose = completeOptions.purpose;
    }
    if (completeOptions.complexityDepth !== undefined) {
      ratingOptions.complexityDepth = completeOptions.complexityDepth;
    }

    const ratingRuntime: ModelRuntimeSelection = {
      hostId: selection.hostId,
      hostKind: selection.hostKind,
      baseUrl: selection.hostEndpoint,
      allowUnconstrainedToolCalls: false,
    };
    const ratingResponse = await this.getModel(selection.evaluatorModel, ratingRuntime).complete([
      {
        role: "system",
        content:
          "Rate the model output for the requested use case. Respond only as YAML with keys score and reason. " +
          "score must be a number from 1 to 5, where 5 is excellent.",
      },
      {
        role: "user",
        content: [
          `Use case: ${selection.purpose}`,
          "Prompt messages:",
          formatMessagesForRating(messages),
          "",
          "Model output:",
          response.content,
        ].join("\n"),
      },
    ], ratingOptions);
    const rating = parseRating(ratingResponse.content);

    await this.options.scoreStore.recordRating({
      model: selection.model,
      purpose: selection.purpose,
      tier: selection.tier,
      score: rating.score,
      evaluatorModel: selection.evaluatorModel,
      reason: rating.reason,
    });
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

function formatMessagesForRating(messages: LanguageModelMessage[]): string {
  return messages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n\n")
    .slice(0, 8_000);
}

function parseRating(content: string): { score: number; reason: string } {
  const scoreMatch = content.match(/\bscore\s*:\s*(?<score>[0-9]+(?:\.[0-9]+)?)/i);
  const parsedScore = Number(scoreMatch?.groups?.["score"] ?? 3);
  const score = Math.min(5, Math.max(1, Number.isFinite(parsedScore) ? parsedScore : 3));
  const reasonMatch = content.match(/\breason\s*:\s*(?<reason>.+)/i);

  return {
    score,
    reason: reasonMatch?.groups?.["reason"]?.trim() || content.trim().slice(0, 500) || "No reason provided.",
  };
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
