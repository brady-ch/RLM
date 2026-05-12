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
import { resolveModelTier } from "./project-config.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve as resolvePath } from "node:path";
import { parse as parseYamlDocument, stringify as stringifyYamlDocument } from "yaml";
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
    if (selection.source === "rotation" && selection.evaluatorModel) {
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

    const rotateThis = Boolean(purpose && this.shouldRotate());
    const rotatedCandidate = purpose && rotateThis
      ? pickAlternateCandidate(tier, purpose, this.options.random)
      : undefined;
    const evaluatorModelName = rotatedCandidate ? this.pickEvaluatorModel() : undefined;
    const useRotation = Boolean(rotatedCandidate && evaluatorModelName);

    const runtime = await this.resolveRuntimeSelection();

    return {
      purpose: normalizedPurpose,
      model: useRotation && rotatedCandidate ? rotatedCandidate.name : tier.name,
      tier: tierName,
      estimatedRamMb: tier.estimatedRamMb,
      source: useRotation ? "rotation" : "configured",
      evaluatorModel: useRotation ? evaluatorModelName : undefined,
      hostId: runtime.hostId,
      hostKind: runtime.hostKind,
      hostEndpoint: runtime.baseUrl,
    };
  }

  private shouldRotate(): boolean {
    const rotation = this.options.config.models.rotation;
    if (!rotation.enabled || !(rotation.sampleRate > 0)) {
      return false;
    }

    const roll = this.options.random?.() ?? Math.random();
    return roll < rotation.sampleRate;
  }

  private pickEvaluatorModel(): string | undefined {
    const tiers = this.options.config.models.tiers;
    const rotation = this.options.config.models.rotation;
    const explicitTier = rotation.evaluatorTier?.trim();
    const tierKey = explicitTier && explicitTier.length > 0 ? explicitTier : "large";

    try {
      if (!Object.hasOwn(tiers, tierKey)) {
        return undefined;
      }

      return resolveModelTier(this.options.config, tierKey).name;
    } catch {
      return undefined;
    }
  }

  private async rateRotatedResponse(
    selection: ModelSelectionRecord,
    messages: LanguageModelMessage[],
    response: LanguageModelResponse,
    _completeOptions: LanguageModelCompleteOptions,
  ): Promise<void> {
    const evaluatorModel = selection.evaluatorModel!;
    const guideline = [
      "Rate how well the model answer satisfies the preceding user/developer messages.",
      "Reply only with:",
      "score: <number from 1-5>",
      "reason: <short explanation>",
      "",
      "Conversation:",
      formatMessagesForRating(messages),
      "",
      "Assistant response:",
      response.content ?? "",
    ].join("\n");
    const ratingResponse = await this.getModel(evaluatorModel, {
      hostId: selection.hostId,
      hostKind: selection.hostKind,
      baseUrl: selection.hostEndpoint,
      allowUnconstrainedToolCalls: false,
    }).complete([{ role: "user", content: guideline }], {});
    const parsed = parseRating(ratingResponse.content ?? "");
    await persistModelScore(this.options.config.models.rotation.scorePath, selection.model, parsed);
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

function resolveScorePath(scorePath: string): string {
  return isAbsolute(scorePath) ? scorePath : resolvePath(process.cwd(), scorePath);
}

function pickAlternateCandidate(
  tier: ModelTierConfig,
  purpose: LanguageModelPurpose,
  random?: (() => number) | undefined,
): ModelCandidateConfig | undefined {
  const scoped = (tier.alternateModels ?? []).filter((candidate) => candidate.useCases.includes(purpose));
  if (scoped.length === 0) {
    return undefined;
  }

  if (scoped.length === 1) {
    const only = scoped[0];
    if (!only) {
      return undefined;
    }

    return only;
  }

  const roll = random?.() ?? Math.random();
  const index = Math.min(scoped.length - 1, Math.floor(roll * scoped.length));
  const chosen = scoped[index];

  return chosen;
}

async function persistModelScore(scorePath: string, modelId: string, parsed: { score: number; reason: string }): Promise<void> {
  const target = resolveScorePath(scorePath);
  type ScoreDoc = Record<string, { averageScore: number; reason?: string }>;
  let doc: ScoreDoc = {};

  try {
    const parsedYaml = parseYamlDocument(await readFile(target, "utf8")) as unknown;
    if (parsedYaml && typeof parsedYaml === "object" && parsedYaml !== null && !Array.isArray(parsedYaml)) {
      doc = parsedYaml as ScoreDoc;
    }
  } catch {
    doc = {};
  }

  doc[modelId] = {
    averageScore: parsed.score,
    reason: parsed.reason,
  };

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, stringifyYamlDocument(doc));
}
