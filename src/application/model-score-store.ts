import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { LanguageModelPurpose } from "../ports/language-model-port.js";

export interface ModelRatingInput {
  model: string;
  purpose: LanguageModelPurpose | "default";
  tier: string;
  score: number;
  evaluatorModel: string;
  reason: string;
}

export interface ModelScoreEntry {
  samples: number;
  averageScore: number;
  lastScore: number;
  lastRatedAt: string;
  evaluatorModel: string;
  reason: string;
}

export interface ModelScoreFile {
  models: Record<string, {
    tiers: Record<string, {
      useCases: Record<string, ModelScoreEntry>;
    }>;
  }>;
}

export interface ModelScoreStore {
  getAverageScore(model: string, tier: string, purpose: LanguageModelPurpose | "default"): Promise<number | undefined>;
  recordRating(input: ModelRatingInput): Promise<void>;
}

export class YamlModelScoreStore implements ModelScoreStore {
  private cache: ModelScoreFile | undefined;

  constructor(private readonly path: string) {}

  async getAverageScore(model: string, tier: string, purpose: LanguageModelPurpose | "default"): Promise<number | undefined> {
    const file = await this.load();
    return file.models[model]?.tiers[tier]?.useCases[purpose]?.averageScore;
  }

  async recordRating(input: ModelRatingInput): Promise<void> {
    const file = await this.load();
    const model = file.models[input.model] ?? {
      tiers: {},
    };
    const tier = model.tiers[input.tier] ?? {
      useCases: {},
    };
    const existing = tier.useCases[input.purpose];
    const samples = (existing?.samples ?? 0) + 1;
    const averageScore = existing
      ? ((existing.averageScore * existing.samples) + input.score) / samples
      : input.score;

    tier.useCases[input.purpose] = {
      samples,
      averageScore: roundScore(averageScore),
      lastScore: roundScore(input.score),
      lastRatedAt: new Date().toISOString(),
      evaluatorModel: input.evaluatorModel,
      reason: input.reason,
    };
    model.tiers[input.tier] = tier;
    file.models[input.model] = model;
    this.cache = file;

    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, stringifyYaml(file), "utf8");
  }

  private async load(): Promise<ModelScoreFile> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const parsed = parseYaml(await readFile(this.path, "utf8")) as unknown;
      this.cache = normalizeScoreFile(parsed);
      return this.cache;
    } catch (error: unknown) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        this.cache = {
          models: {},
        };
        return this.cache;
      }

      throw error;
    }
  }
}

export function createYamlModelScoreStore(workspaceRoot: string, scorePath: string): YamlModelScoreStore {
  return new YamlModelScoreStore(resolve(workspaceRoot, scorePath));
}

function normalizeScoreFile(value: unknown): ModelScoreFile {
  if (!value || typeof value !== "object") {
    return {
      models: {},
    };
  }

  const maybeFile = value as Partial<ModelScoreFile>;
  return {
    models: maybeFile.models && typeof maybeFile.models === "object" ? maybeFile.models : {},
  };
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}
