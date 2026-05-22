import type {
  QualityLoopConfig,
  QualityLoopPhaseName,
  RecursiveModelConfig,
} from "../../domain/types.js";
import { DEFAULT_PROJECT_CONFIG, defaultQualityLoopConfig } from "./defaults.js";
import type { ProjectConfig } from "./types.js";

function mergeQualityLoopPhaseModels(
  layers: Array<Partial<Record<QualityLoopPhaseName, string>> | undefined>,
): Partial<Record<QualityLoopPhaseName, string>> | undefined {
  const merged: Partial<Record<QualityLoopPhaseName, string>> = {};
  for (const layer of layers) {
    if (!layer) {
      continue;
    }
    for (const key of Object.keys(layer) as QualityLoopPhaseName[]) {
      const value = layer[key];
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeResolvedQualityLoop(
  base: QualityLoopConfig,
  override?: Partial<QualityLoopConfig> | undefined,
): QualityLoopConfig {
  if (!override) {
    return { ...base };
  }
  const phaseModels = mergeQualityLoopPhaseModels([base.phaseModels, override.phaseModels]);
  return {
    ...base,
    ...override,
    phaseModels,
  };
}

export function resolveRuntimeConfig(
  config: ProjectConfig,
  overrides: Partial<RecursiveModelConfig> = {},
): RecursiveModelConfig {
  const baseRuntime: RecursiveModelConfig = {
    ...DEFAULT_PROJECT_CONFIG.runtime,
    ...config.runtime,
  };
  const qualityLoopBase = baseRuntime.qualityLoop ?? defaultQualityLoopConfig;
  const runtime: RecursiveModelConfig = {
    ...baseRuntime,
    ...overrides,
    qualityLoop: mergeResolvedQualityLoop(qualityLoopBase, overrides.qualityLoop),
  };
  if (runtime.maxDepth === undefined) {
    delete runtime.maxDepth;
  }

  return runtime;
}
