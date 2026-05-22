import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import type {
  QualityLoopConfig,
  QualityLoopPhaseName,
  RecursiveModelConfig,
} from "../domain/types.js";
import {
  DEFAULT_PROJECT_CONFIG,
  DEFAULT_PROJECT_PLAIN,
  defaultQualityLoopConfig,
} from "./config/defaults.js";
import { safeStat } from "./config/loader.js";
import {
  type ModelHostConfig,
  type ModelTierConfig,
  type ProjectConfig,
  type RuntimeHostSelection,
} from "./config/types.js";

export {
  CORE_MODEL_PURPOSES,
  MODEL_PURPOSES,
  isGraphWorkflowConfig,
  isRamQueueWorkflowConfig,
  type AgentConfig,
  type CoreModelPurpose,
  type GraphWorkflowConfig,
  type InteropConfig,
  type LoadedProjectConfig,
  type McpServerConfig,
  type MemoryMode,
  type ModelHostConfig,
  type ModelHostKind,
  type ModelPurpose,
  type ModelSelection,
  type ModelTierConfig,
  type ProjectConfig,
  type RamQueueWorkflowConfig,
  type RuntimeHostSelection,
  type SamplingConfig,
  type SkillInteropConfig,
  type SkillPathPolicyConfig,
  type WorkflowConfig,
  type WorkflowDispatchConfig,
  type WorkflowDispatchTierConfig,
  type WorkflowQaConfig,
} from "./config/types.js";

export { DEFAULT_PROJECT_CONFIG } from "./config/defaults.js";
export { loadProjectConfig } from "./config/loader.js";

export async function seedProjectRlmStarter(projectRoot = process.cwd()): Promise<boolean> {
  const dotFolder = join(projectRoot, ".rlm");
  const primaryConfig = join(dotFolder, "config.yaml");
  try {
    if ((await safeStat(primaryConfig))?.isFile()) {
      return false;
    }

    await mkdir(dotFolder, { recursive: true });
    await mkdir(join(dotFolder, "agents"), { recursive: true });
    await mkdir(join(dotFolder, "models"), { recursive: true });

    await writeFile(primaryConfig, stringifyYaml(DEFAULT_PROJECT_PLAIN));

    await writeFile(
      join(dotFolder, "agents", "coding.yaml"),
      stringifyYaml(DEFAULT_PROJECT_CONFIG.agents["coding"]),
    );

    await writeFile(
      join(dotFolder, "models", "small.yaml"),
      stringifyYaml(DEFAULT_PROJECT_CONFIG.models.tiers["small"]),
    );

    console.error(
      "[rlm starter] seeded project-local .rlm/ with sample config, agents/coding.yaml, models/small.yaml",
    );
    return true;
  } catch (error: unknown) {
    const detail = error instanceof Error ? `${error.message} (starter seed)` : "starter seed";
    console.error("[rlm starter] FAILED to seed project .rlm layout:", detail);
    throw new Error(`${dotFolder}: ${detail}`);
  }
}

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

export function applyModelOverride(config: ProjectConfig, modelOverride?: string): ProjectConfig {
  if (!modelOverride) {
    return config;
  }

  const smallTier = config.models.tiers["small"] ?? {
    name: modelOverride,
    estimatedRamMb: 4096,
  };

  return {
    ...config,
    models: {
      ...config.models,
      default: modelOverride,
      tiers: {
        ...config.models.tiers,
        small: {
          ...smallTier,
          name: modelOverride,
        },
      },
    },
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

export function resolveRuntimeHostSelection(
  config: ProjectConfig,
  input: {
    cliHostId?: string | undefined;
    env?: NodeJS.ProcessEnv | undefined;
  } = {},
): RuntimeHostSelection {
  const envHost = input.env?.RLM_HOST?.trim();
  if (envHost) {
    return { hostId: envHost, source: "env" };
  }

  const cliHost = input.cliHostId?.trim();
  if (cliHost) {
    return { hostId: cliHost, source: "cli" };
  }

  const configHost = config.runtimeHost?.trim();
  if (configHost) {
    return { hostId: configHost, source: "config" };
  }

  const defaultHost = Object.keys(config.hosts ?? {})[0];
  if (defaultHost) {
    return { hostId: defaultHost, source: "default" };
  }

  return { hostId: "local_ollama", source: "default" };
}

export function resolveHostConfig(config: ProjectConfig, hostId: string): ModelHostConfig {
  const host = config.hosts?.[hostId];
  if (!host) {
    throw new Error(`Unknown runtime host "${hostId}".`);
  }

  return host;
}

export function resolveModelTier(config: ProjectConfig, selection: string): ModelTierConfig {
  const tier = config.models.tiers[selection];
  if (tier) {
    return tier;
  }

  return {
    name: selection,
    estimatedRamMb: config.models.tiers["small"]?.estimatedRamMb ?? 4096,
  };
}
