import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
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
import { configSchema } from "./config/schema.js";
import {
  isGraphWorkflowConfig,
  type LoadedProjectConfig,
  type ModelHostConfig,
  type ModelTierConfig,
  type ProjectConfig,
  type RuntimeHostSelection,
} from "./config/types.js";
import { isPlainRecord, mergeYamlLayers } from "./config/yaml-merge.js";

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

async function safeStat(pathLike: string) {
  try {
    return await stat(pathLike);
  } catch {
    return undefined;
  }
}

function parseYamlTagged(pathLike: string, raw: string): unknown {
  try {
    return parseYaml(raw) as unknown;
  } catch (error: unknown) {
    const suffix = error instanceof Error ? error.message : String(error);
    throw new Error(`${pathLike}: ${suffix}`);
  }
}

async function loadScopedFragments(scopeRoot: string): Promise<Record<string, unknown>> {
  let accumulator: Record<string, unknown> = {};
  const scopeStat = await safeStat(scopeRoot);
  if (!scopeStat?.isDirectory()) {
    return {};
  }

  const cfgPath = join(scopeRoot, "config.yaml");
  const cfgStat = await safeStat(cfgPath);
  if (cfgStat?.isFile()) {
    const yamlRoot = parseYamlTagged(cfgPath, await readFile(cfgPath, "utf8"));
    if (yamlRoot === null || yamlRoot === undefined || !isPlainRecord(yamlRoot)) {
      throw new Error(`${cfgPath}: expected YAML mapping at root`);
    }

    accumulator = mergeYamlLayers(accumulator, yamlRoot);
  }

  const agentsDir = join(scopeRoot, "agents");
  const agentsStat = await safeStat(agentsDir);
  if (agentsStat?.isDirectory()) {
    const entries = [...(await readdir(agentsDir))].sort((aName, bName) =>
      aName.localeCompare(bName),
    );
    const agentsPartial: Record<string, unknown> = {};
    for (const fileName of entries) {
      if (!fileName.endsWith(".yaml") && !fileName.endsWith(".yml")) continue;
      const agentId = basename(fileName, extname(fileName)).trim();
      if (!agentId) continue;

      const filePath = join(agentsDir, fileName);
      const agentDoc = parseYamlTagged(filePath, await readFile(filePath, "utf8"));
      if (!isPlainRecord(agentDoc)) {
        throw new Error(`${filePath}: agent fragment must map tools/models`);
      }

      agentsPartial[agentId] = agentDoc;
    }

    if (Object.keys(agentsPartial).length > 0) {
      accumulator = mergeYamlLayers(accumulator, { agents: agentsPartial });
    }
  }

  const modelsDir = join(scopeRoot, "models");
  const modelsStat = await safeStat(modelsDir);
  if (modelsStat?.isDirectory()) {
    const tiers: Record<string, unknown> = {};
    const entries = [...(await readdir(modelsDir))].sort((aName, bName) =>
      aName.localeCompare(bName),
    );
    for (const entryName of entries) {
      if (!entryName.endsWith(".yaml") && !entryName.endsWith(".yml")) continue;
      const tierKey = basename(entryName, extname(entryName)).trim();
      if (!tierKey) continue;

      const filePath = join(modelsDir, entryName);
      const tierDoc = parseYamlTagged(filePath, await readFile(filePath, "utf8"));
      if (!isPlainRecord(tierDoc)) {
        throw new Error(`${filePath}: tier fragment must map fields`);
      }

      tiers[tierKey] = tierDoc;
    }

    if (Object.keys(tiers).length > 0) {
      accumulator = mergeYamlLayers(accumulator, { models: { tiers } });
    }
  }

  return accumulator;
}

export async function loadProjectConfig(path?: string): Promise<LoadedProjectConfig> {
  if (path) {
    const resolvedExplicit = resolve(path);
    const raw = await readFile(resolvedExplicit, "utf8");
    const yamlRoot = parseYamlTagged(resolvedExplicit, raw);
    let mergedYaml = structuredClone(DEFAULT_PROJECT_PLAIN);
    mergedYaml = mergeYamlLayers(
      mergedYaml,
      yamlRoot !== null && isPlainRecord(yamlRoot) ? yamlRoot : {},
    );

    const config = configSchema.parse(mergedYaml) as ProjectConfig;
    validateConfigReferences(config);

    return {
      config,
      path: resolvedExplicit,
    };
  }

  let mergedYaml = structuredClone(DEFAULT_PROJECT_PLAIN);

  const globalFragments = join(homedir(), ".rlm");
  if ((await safeStat(globalFragments))?.isDirectory()) {
    mergedYaml = mergeYamlLayers(mergedYaml, await loadScopedFragments(globalFragments));
  }

  let primaryPath: string | undefined;

  const cwd = process.cwd();
  const scopedDir = join(cwd, ".rlm");

  const legacyScoped = resolve(cwd, "rlm.config.yaml");
  const legacyExists = (await safeStat(legacyScoped))?.isFile() ?? false;

  if ((await safeStat(scopedDir))?.isDirectory()) {
    if (legacyExists) {
      const legacyYamlRaw = await readFile(legacyScoped, "utf8");
      const legacyYaml = parseYamlTagged(legacyScoped, legacyYamlRaw);
      if (!legacyYaml || !isPlainRecord(legacyYaml)) {
        throw new Error(`${legacyScoped}: expected YAML mapping at root`);
      }

      mergedYaml = mergeYamlLayers(mergedYaml, legacyYaml);
      primaryPath ??= legacyScoped;
    }

    mergedYaml = mergeYamlLayers(mergedYaml, await loadScopedFragments(scopedDir));

    const cfgChild = join(scopedDir, "config.yaml");
    if ((await safeStat(cfgChild))?.isFile()) {
      primaryPath ??= cfgChild;
    }

    primaryPath ??= legacyExists ? legacyScoped : undefined;
  } else {
    const discoveredPath = legacyExists ? legacyScoped : await findDefaultConfigPath();
    if (discoveredPath) {
      const discoveredRaw = await readFile(discoveredPath, "utf8");
      const parsedDoc = parseYamlTagged(discoveredPath, discoveredRaw);
      if (!isPlainRecord(parsedDoc)) {
        throw new Error(`${discoveredPath}: expected YAML mapping at root`);
      }

      mergedYaml = mergeYamlLayers(mergedYaml, parsedDoc);
      primaryPath ??= discoveredPath;
    }
  }

  const config = configSchema.parse(mergedYaml) as ProjectConfig;
  validateConfigReferences(config);

  return {
    config,
    path: primaryPath,
  };
}

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

async function findDefaultConfigPath(): Promise<string | undefined> {
  const candidate = resolve("rlm.config.yaml");
  try {
    await access(candidate, constants.R_OK);
    return candidate;
  } catch {
    return undefined;
  }
}

function validateConfigReferences(config: ProjectConfig): void {
  for (const [agentId, agent] of Object.entries(config.agents)) {
    for (const [purpose, selection] of Object.entries(agent.models)) {
      if (
        selection !== "dynamic" &&
        !config.models.tiers[selection] &&
        selection.trim().length === 0
      ) {
        throw new Error(
          `Agent "${agentId}" has invalid model selection for ${purpose}: ${selection}`,
        );
      }
    }
  }

  for (const [workflowId, workflow] of Object.entries(config.workflows)) {
    if (isGraphWorkflowConfig(workflow)) {
      continue;
    }

    for (const agentId of workflow.agents) {
      if (!config.agents[agentId]) {
        throw new Error(`Workflow "${workflowId}" references unknown agent "${agentId}".`);
      }
    }

    if (workflow.qa && !config.agents[workflow.qa.agent]) {
      throw new Error(
        `Workflow "${workflowId}" references unknown QA agent "${workflow.qa.agent}".`,
      );
    }

    for (const tier of workflow.dispatch?.tiers ?? []) {
      for (const agentId of tier.agents) {
        if (!config.agents[agentId]) {
          throw new Error(
            `Workflow "${workflowId}" dispatch tier "${tier.name}" references unknown agent "${agentId}".`,
          );
        }
      }

      if (tier.qa && !workflow.qa) {
        throw new Error(
          `Workflow "${workflowId}" dispatch tier "${tier.name}" enables QA but no QA config is present.`,
        );
      }
    }
  }
}
