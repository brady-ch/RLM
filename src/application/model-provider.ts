import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelPurpose,
  LanguageModelResponse,
} from "../ports/language-model-port.js";
import type { AgentConfig, ModelCandidateConfig, ModelTierConfig, ProjectConfig } from "./project-config.js";
import { resolveModelTier } from "./project-config.js";
import type { ModelScoreStore } from "./model-score-store.js";

export interface ModelProviderOptions {
  config: ProjectConfig;
  agent: AgentConfig;
  baseUrl?: string | undefined;
  createModel: (model: string) => LanguageModelPort;
  recordSelection?: (selection: ModelSelectionRecord) => void;
  scoreStore?: ModelScoreStore | undefined;
  random?: (() => number) | undefined;
}

export interface ModelSelectionRecord {
  purpose: LanguageModelPurpose | "default";
  model: string;
  tier: string;
  estimatedRamMb: number;
  source: "configured" | "rotation";
  evaluatorModel?: string | undefined;
}

export class PurposeRoutingLanguageModel implements LanguageModelPort {
  private readonly cache = new Map<string, LanguageModelPort>();

  constructor(private readonly options: ModelProviderOptions) {}

  async complete(
    messages: LanguageModelMessage[],
    completeOptions: LanguageModelCompleteOptions = {},
  ): Promise<LanguageModelResponse> {
    const selection = await this.selectModel(completeOptions.purpose, completeOptions.complexityDepth);
    this.options.recordSelection?.(selection);
    const response = await this.getModel(selection.model).complete(messages, completeOptions);
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

    return {
      purpose: normalizedPurpose,
      model: rotatedModel?.name ?? tier.name,
      tier: tierName,
      estimatedRamMb: tier.estimatedRamMb,
      source: rotatedModel ? "rotation" : "configured",
      evaluatorModel: rotatedModel ? evaluatorModel : undefined,
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

    const ratingResponse = await this.getModel(selection.evaluatorModel).complete([
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
