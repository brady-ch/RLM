import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";
import type { QualityLoopConfig, QualityLoopPhaseName, RecursiveModelConfig } from "../domain/types.js";
import type { ExtensionRegistryEntry } from "../ports/extension-port.js";
import type { LanguageModelPurpose } from "../ports/language-model-port.js";

export const MODEL_PURPOSES = [
  "depth",
  "classify",
  "decompose",
  "answer",
  "summarize",
  "synthesize",
  "quality_loop_draft",
  "quality_loop_critique",
  "quality_loop_refine",
  "quality_loop_gate",
  "quality_loop_best_of_progress",
] as const satisfies readonly LanguageModelPurpose[];

export const CORE_MODEL_PURPOSES = ["depth", "classify", "decompose", "answer", "summarize", "synthesize"] as const satisfies readonly LanguageModelPurpose[];

export type ModelPurpose = typeof MODEL_PURPOSES[number];
export type CoreModelPurpose = typeof CORE_MODEL_PURPOSES[number];
export type MemoryMode = "auto" | number;
export type ModelSelection = string | "dynamic";

export interface ModelTierConfig {
  name: string;
  estimatedRamMb: number;
}

export interface AgentConfig {
  tools: string[];
  models: Record<CoreModelPurpose, ModelSelection> & Partial<Record<ModelPurpose, ModelSelection>>;
}

export interface WorkflowDispatchConfig {
  strategy: "complexity_tiers";
  tiers: WorkflowDispatchTierConfig[];
}

export interface WorkflowDispatchTierConfig {
  name: string;
  agents: string[];
  qa: boolean;
  maxEstimatedDepth?: number | undefined;
}

export interface WorkflowConfig {
  mode: "ram_queue";
  agents: string[];
  continueOnError: boolean;
  qa?: WorkflowQaConfig | undefined;
  dispatch?: WorkflowDispatchConfig | undefined;
}

export interface WorkflowQaConfig {
  agent: string;
  validationCommands: string[];
  bugfixQueue: {
    id: string;
    priority: number;
    highestPriorityKeywords: string[];
  };
}

export interface McpServerConfig {
  id: string;
  command: string;
  args?: string[] | undefined;
  required: boolean;
}

export interface SkillPathPolicyConfig {
  path: string;
  strictness: "strict" | "lenient";
}

export interface SkillInteropConfig {
  searchPaths: string[];
  duplicateStrategy: "first_match";
  cache: boolean;
  pathPolicies: SkillPathPolicyConfig[];
}

export interface InteropConfig {
  mcp: {
    servers: McpServerConfig[];
  };
  skills: SkillInteropConfig;
}

export type ModelHostKind = "ollama" | "http";

export interface ModelHostConfig {
  kind: ModelHostKind;
  baseUrl: string;
  available?: boolean | undefined;
  allowUnconstrainedToolCalls?: boolean | undefined;
}

export interface RuntimeHostSelection {
  hostId: string;
  source: "env" | "cli" | "config" | "default";
}

export interface ProjectConfig {
  models: {
    default: string;
    tiers: Record<string, ModelTierConfig>;
  };
  memory: {
    maxRamMb: MemoryMode;
    reserveSystemRamMb: number;
    waitForCapacity: boolean;
    capacityCheckIntervalMs: number;
  };
  runtime: RecursiveModelConfig;
  agents: Record<string, AgentConfig>;
  workflows: Record<string, WorkflowConfig>;
  extensions?: {
    allowlist?: string | undefined;
    load?: ExtensionRegistryEntry[] | undefined;
  } | undefined;
  interop?: InteropConfig | undefined;
  hosts?: Record<string, ModelHostConfig> | undefined;
  runtimeHost?: string | undefined;
}

export interface LoadedProjectConfig {
  config: ProjectConfig;
  path?: string | undefined;
}

const modelSelectionSchema = z.string().min(1);
const agentModelsSchema = z.object({
  depth: modelSelectionSchema,
  classify: modelSelectionSchema,
  decompose: modelSelectionSchema,
  answer: modelSelectionSchema,
  summarize: modelSelectionSchema,
  synthesize: modelSelectionSchema,
  quality_loop_draft: modelSelectionSchema.optional(),
  quality_loop_critique: modelSelectionSchema.optional(),
  quality_loop_refine: modelSelectionSchema.optional(),
  quality_loop_gate: modelSelectionSchema.optional(),
  quality_loop_best_of_progress: modelSelectionSchema.optional(),
}).transform((models) => ({
  ...models,
  quality_loop_draft: models.quality_loop_draft ?? models.answer,
  quality_loop_critique: models.quality_loop_critique ?? models.answer,
  quality_loop_refine: models.quality_loop_refine ?? models.answer,
  quality_loop_gate: models.quality_loop_gate ?? models.answer,
  quality_loop_best_of_progress: models.quality_loop_best_of_progress ?? models.answer,
}));

const defaultQualityLoopConfig = {
  enabled: false,
  maxIterations: 3,
  budgetBehavior: "stop_before_partial_iteration" as const,
};

const qualityLoopSchema = z.object({
  enabled: z.boolean().default(false),
  maxIterations: z.number().int().positive().default(3),
  budgetBehavior: z.literal("stop_before_partial_iteration").default("stop_before_partial_iteration"),
  phaseModels: z.object({
    draft: modelSelectionSchema.optional(),
    critique: modelSelectionSchema.optional(),
    refine: modelSelectionSchema.optional(),
    gate: modelSelectionSchema.optional(),
    best_of_progress: modelSelectionSchema.optional(),
  }).optional(),
});

const runtimeSchema = z.object({
  maxDepth: z.number().int().nonnegative().optional(),
  maxDynamicDepth: z.number().int().nonnegative().default(4),
  maxBranches: z.number().int().nonnegative().default(3),
  maxPromptCharacters: z.number().int().positive().default(6_000),
  maxModelCalls: z.number().int().nonnegative().default(24),
  maxToolRounds: z.number().int().nonnegative().default(3),
  qualityLoop: qualityLoopSchema.default(defaultQualityLoopConfig),
});

const configSchema = z.object({
  models: z.object({
    default: z.string().min(1),
    tiers: z.record(z.string(), z.object({
      name: z.string().min(1),
      estimatedRamMb: z.number().int().positive(),
    })),
  }),
  memory: z.object({
    maxRamMb: z.union([z.literal("auto"), z.number().int().positive()]),
    reserveSystemRamMb: z.number().int().nonnegative(),
    waitForCapacity: z.boolean(),
    capacityCheckIntervalMs: z.number().int().positive(),
  }),
  runtime: runtimeSchema.default({
    maxDynamicDepth: 4,
    maxBranches: 3,
    maxPromptCharacters: 6_000,
    maxModelCalls: 24,
    maxToolRounds: 3,
    qualityLoop: defaultQualityLoopConfig,
  }),
  agents: z.record(z.string(), z.object({
    tools: z.array(z.string().min(1)),
    models: agentModelsSchema,
  })),
  workflows: z.record(z.string(), z.object({
    mode: z.literal("ram_queue"),
    agents: z.array(z.string().min(1)).min(1),
    continueOnError: z.boolean().default(false),
    qa: z.object({
      agent: z.string().min(1),
      validationCommands: z.array(z.string().min(1)).default(["npm test", "npm run build"]),
      bugfixQueue: z.object({
        id: z.string().min(1).default("bugfix"),
        priority: z.number().int().default(100),
        highestPriorityKeywords: z.array(z.string().min(1)).default(["fail", "error", "regression", "broken", "crash"]),
      }).default({
        id: "bugfix",
        priority: 100,
        highestPriorityKeywords: ["fail", "error", "regression", "broken", "crash"],
      }),
    }).optional(),
    dispatch: z.object({
      strategy: z.literal("complexity_tiers"),
      tiers: z.array(z.object({
        name: z.string().min(1),
        maxEstimatedDepth: z.number().int().nonnegative().optional(),
        agents: z.array(z.string().min(1)).min(1),
        qa: z.boolean().default(false),
      })).min(1),
    }).optional(),
  })),
  extensions: z.object({
    allowlist: z.string().optional(),
    load: z.array(z.object({
      path: z.string().min(1),
      agents: z.array(z.string().min(1)).default([]),
    })).default([]),
  }).optional(),
  interop: z.object({
    mcp: z.object({
      servers: z.array(z.object({
        id: z.string().min(1),
        command: z.string().min(1),
        args: z.array(z.string().min(1)).default([]),
        required: z.boolean().default(false),
      })).default([]),
    }).default({
      servers: [],
    }),
    skills: z.object({
      searchPaths: z.array(z.string().min(1)).default([".codex/skills", ".agents/skills"]),
      duplicateStrategy: z.literal("first_match").default("first_match"),
      cache: z.boolean().default(false),
      pathPolicies: z.array(z.object({
        path: z.string().min(1),
        strictness: z.enum(["strict", "lenient"]).default("strict"),
      })).default([]),
    }).default({
      searchPaths: [".codex/skills", ".agents/skills"],
      duplicateStrategy: "first_match",
      cache: false,
      pathPolicies: [],
    }),
  }).optional(),
  hosts: z.record(z.string().min(1), z.object({
    kind: z.enum(["ollama", "http"]),
    baseUrl: z.string().min(1),
    available: z.boolean().optional(),
    allowUnconstrainedToolCalls: z.boolean().optional(),
  })).optional(),
  runtimeHost: z.string().min(1).optional(),
});

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  models: {
    default: "granite4.1:3b",
    tiers: {
      small: {
        name: "granite4.1:3b",
        estimatedRamMb: 4096,
      },
      medium: {
        name: "llama3.1:8b",
        estimatedRamMb: 8192,
      },
      large: {
        name: "qwen2.5-coder:14b",
        estimatedRamMb: 16000,
      },
    },
  },
  memory: {
    maxRamMb: "auto",
    reserveSystemRamMb: 2048,
    waitForCapacity: true,
    capacityCheckIntervalMs: 1000,
  },
  runtime: {
    maxDynamicDepth: 4,
    maxBranches: 3,
    maxPromptCharacters: 6_000,
    maxModelCalls: 24,
    maxToolRounds: 3,
    qualityLoop: defaultQualityLoopConfig,
  },
  agents: {
    default: {
      tools: ["shell", "write_file", "web_search", "web_fetch"],
      models: defaultAgentModels(),
    },
    coding: {
      tools: ["shell", "write_file", "web_search", "web_fetch"],
      models: defaultAgentModels(),
    },
    qa: {
      tools: ["shell", "write_file"],
      models: defaultAgentModels(),
    },
    product_designer: {
      tools: ["web_search", "web_fetch", "write_file"],
      models: defaultAgentModels(),
    },
    research: {
      tools: ["web_search", "web_fetch"],
      models: defaultAgentModels(),
    },
  },
  workflows: {
    default: {
      mode: "ram_queue",
      agents: ["research", "product_designer", "coding"],
      continueOnError: false,
      dispatch: {
        strategy: "complexity_tiers",
        tiers: [
          {
            name: "simple",
            maxEstimatedDepth: 1,
            agents: ["coding"],
            qa: false,
          },
          {
            name: "normal",
            maxEstimatedDepth: 2,
            agents: ["coding"],
            qa: true,
          },
          {
            name: "complex",
            agents: ["research", "product_designer", "coding"],
            qa: true,
          },
        ],
      },
      qa: {
        agent: "qa",
        validationCommands: ["npm test", "npm run build"],
        bugfixQueue: {
          id: "bugfix",
          priority: 100,
          highestPriorityKeywords: ["fail", "error", "regression", "broken", "crash"],
        },
      },
    },
  },
  interop: {
    mcp: {
      servers: [],
    },
    skills: {
      searchPaths: [".codex/skills", ".agents/skills"],
      duplicateStrategy: "first_match",
      cache: false,
      pathPolicies: [],
    },
  },
  hosts: {
    local_ollama: {
      kind: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      available: true,
      allowUnconstrainedToolCalls: false,
    },
  },
  runtimeHost: "local_ollama",
};

/** JSON-backed clone of baked-in defaults — safe starting point before layered overlays. */
const DEFAULT_PROJECT_PLAIN = JSON.parse(JSON.stringify(DEFAULT_PROJECT_CONFIG)) as Record<string, unknown>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeInterop(left: unknown, right: unknown): unknown {
  if (!left) return right;
  if (!right) return left;
  if (!isPlainRecord(left) || !isPlainRecord(right)) {
    return right;
  }

  const lm = left as Record<string, unknown>;
  const rm = right as Record<string, unknown>;
  const lmcp = isPlainRecord(lm["mcp"]) ? lm["mcp"] as Record<string, unknown> : {};
  const rmcp = isPlainRecord(rm["mcp"]) ? rm["mcp"] as Record<string, unknown> : {};

  const lskills = isPlainRecord(lm["skills"]) ? lm["skills"] as Record<string, unknown> : {};
  const rskills = isPlainRecord(rm["skills"]) ? rm["skills"] as Record<string, unknown> : {};

  return {
    ...lm,
    ...rm,
    mcp: { ...lmcp, ...rmcp },
    skills: { ...lskills, ...rskills },
  };
}

/** Layer project/global YAML fragments onto each other — agents and tiers replace by id/key. */
function mergeYamlLayers(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...left };

  for (const [key, incoming] of Object.entries(right)) {
    if (!isPlainRecord(incoming)) {
      out[key] = incoming;
      continue;
    }

    const existingFlat = left[key];

    if (key === "agents" && isPlainRecord(existingFlat)) {
      const mergedAgents = {
        ...(existingFlat as Record<string, unknown>),
        ...(incoming as Record<string, unknown>),
      };
      out["agents"] = mergedAgents;
      continue;
    }

    if (key === "agents") {
      out["agents"] = { ...incoming };
      continue;
    }

    if (key === "models") {
      const prior = isPlainRecord(existingFlat) ? (existingFlat as Record<string, unknown>) : {};
      const leftTiersRaw = prior["tiers"];
      const incomingModels = incoming as Record<string, unknown>;
      const rightTiersRaw = incomingModels["tiers"];
      const leftTiers = isPlainRecord(leftTiersRaw)
        ? (leftTiersRaw as Record<string, unknown>)
        : {};
      const rightTiers = isPlainRecord(rightTiersRaw)
        ? (rightTiersRaw as Record<string, unknown>)
        : {};

      const incomingWithoutTiers = { ...incomingModels };
      delete incomingWithoutTiers["tiers"];

      out["models"] = {
        ...prior,
        ...incomingWithoutTiers,
        tiers: {
          ...leftTiers,
          ...rightTiers,
        },
      };
      continue;
    }

    if (key === "memory" || key === "runtime") {
      const prior = isPlainRecord(existingFlat) ? (existingFlat as Record<string, unknown>) : {};
      out[key] = { ...prior, ...incoming };
      continue;
    }

    if (key === "workflows" || key === "hosts") {
      const prior = isPlainRecord(existingFlat) ? (existingFlat as Record<string, unknown>) : {};
      out[key] = { ...prior, ...incoming };
      continue;
    }

    if (key === "interop") {
      out["interop"] = mergeInterop(existingFlat ?? {}, incoming);
      continue;
    }

    out[key] = incoming;
  }

  return out;
}

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
    const entries = [...await readdir(agentsDir)].sort((aName, bName) => aName.localeCompare(bName));
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
    const entries = [...await readdir(modelsDir)].sort((aName, bName) => aName.localeCompare(bName));
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
  }
  else {
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

    console.error("[rlm starter] seeded project-local .rlm/ with sample config, agents/coding.yaml, models/small.yaml");
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

function mergeResolvedQualityLoop(base: QualityLoopConfig, override?: Partial<QualityLoopConfig> | undefined): QualityLoopConfig {
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

export function resolveRuntimeConfig(config: ProjectConfig, overrides: Partial<RecursiveModelConfig> = {}): RecursiveModelConfig {
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

function defaultAgentModels(): AgentConfig["models"] {
  return {
    depth: "small",
    classify: "small",
    decompose: "medium",
    answer: "dynamic",
    summarize: "small",
    synthesize: "medium",
    quality_loop_draft: "dynamic",
    quality_loop_critique: "dynamic",
    quality_loop_refine: "dynamic",
    quality_loop_gate: "dynamic",
    quality_loop_best_of_progress: "dynamic",
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
      if (selection !== "dynamic" && !config.models.tiers[selection] && selection.trim().length === 0) {
        throw new Error(`Agent "${agentId}" has invalid model selection for ${purpose}: ${selection}`);
      }
    }
  }

  for (const [workflowId, workflow] of Object.entries(config.workflows)) {
    for (const agentId of workflow.agents) {
      if (!config.agents[agentId]) {
        throw new Error(`Workflow "${workflowId}" references unknown agent "${agentId}".`);
      }
    }

    if (workflow.qa && !config.agents[workflow.qa.agent]) {
      throw new Error(`Workflow "${workflowId}" references unknown QA agent "${workflow.qa.agent}".`);
    }

    for (const tier of workflow.dispatch?.tiers ?? []) {
      for (const agentId of tier.agents) {
        if (!config.agents[agentId]) {
          throw new Error(`Workflow "${workflowId}" dispatch tier "${tier.name}" references unknown agent "${agentId}".`);
        }
      }

      if (tier.qa && !workflow.qa) {
        throw new Error(`Workflow "${workflowId}" dispatch tier "${tier.name}" enables QA but no QA config is present.`);
      }
    }
  }
}
