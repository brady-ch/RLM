import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { RecursiveModelConfig } from "../domain/types.js";
import type { LanguageModelPurpose } from "../ports/language-model-port.js";

export const MODEL_PURPOSES = ["depth", "classify", "decompose", "answer", "summarize", "synthesize"] as const satisfies readonly LanguageModelPurpose[];

export type ModelPurpose = typeof MODEL_PURPOSES[number];
export type MemoryMode = "auto" | number;
export type ModelSelection = string | "dynamic";

export interface ModelTierConfig {
  name: string;
  estimatedRamMb: number;
  alternateModels?: ModelCandidateConfig[] | undefined;
}

export interface ModelCandidateConfig {
  name: string;
  useCases: ModelPurpose[];
}

export interface ModelRotationConfig {
  enabled: boolean;
  sampleRate: number;
  scorePath: string;
  evaluatorTier?: string | undefined;
}

export interface AgentConfig {
  tools: string[];
  models: Record<ModelPurpose, ModelSelection>;
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

export interface ProjectConfig {
  models: {
    default: string;
    tiers: Record<string, ModelTierConfig>;
    rotation: ModelRotationConfig;
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
});

const runtimeSchema = z.object({
  maxDepth: z.number().int().nonnegative().optional(),
  maxDynamicDepth: z.number().int().nonnegative().default(4),
  maxBranches: z.number().int().nonnegative().default(3),
  maxPromptCharacters: z.number().int().positive().default(6_000),
  maxModelCalls: z.number().int().nonnegative().default(24),
  maxToolRounds: z.number().int().nonnegative().default(3),
});

const configSchema = z.object({
  models: z.object({
    default: z.string().min(1),
    tiers: z.record(z.string(), z.object({
      name: z.string().min(1),
      estimatedRamMb: z.number().int().positive(),
      alternateModels: z.array(z.object({
        name: z.string().min(1),
        useCases: z.array(z.enum(MODEL_PURPOSES)).min(1),
      })).default([]),
    })),
    rotation: z.object({
      enabled: z.boolean().default(true),
      sampleRate: z.number().min(0).max(1).default(0.1),
      scorePath: z.string().min(1).default("rlm.model-scores.yaml"),
      evaluatorTier: z.string().min(1).optional(),
    }).default({
      enabled: true,
      sampleRate: 0.1,
      scorePath: "rlm.model-scores.yaml",
    }),
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
});

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  models: {
    default: "granite4.1:3b",
    rotation: {
      enabled: true,
      sampleRate: 0.1,
      scorePath: "rlm.model-scores.yaml",
    },
    tiers: {
      small: {
        name: "granite4.1:3b",
        estimatedRamMb: 4096,
        alternateModels: [],
      },
      medium: {
        name: "llama3.1:8b",
        estimatedRamMb: 8192,
        alternateModels: [],
      },
      large: {
        name: "qwen2.5-coder:14b",
        estimatedRamMb: 16000,
        alternateModels: [],
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
  },
  agents: {
    default: {
      tools: ["shell", "write_file", "google_search", "web_fetch"],
      models: defaultAgentModels(),
    },
    coding: {
      tools: ["shell", "write_file", "google_search", "web_fetch"],
      models: defaultAgentModels(),
    },
    qa: {
      tools: ["shell", "write_file"],
      models: defaultAgentModels(),
    },
    product_designer: {
      tools: ["google_search", "web_fetch", "write_file"],
      models: defaultAgentModels(),
    },
    research: {
      tools: ["google_search", "web_fetch"],
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
};

export async function loadProjectConfig(path?: string): Promise<LoadedProjectConfig> {
  const discoveredPath = path ? resolve(path) : await findDefaultConfigPath();
  if (!discoveredPath) {
    return {
      config: DEFAULT_PROJECT_CONFIG,
    };
  }

  const raw = await readFile(discoveredPath, "utf8");
  const parsed = parseYaml(raw) as unknown;
  const config = configSchema.parse(parsed) as ProjectConfig;
  validateConfigReferences(config);
  return {
    config,
    path: discoveredPath,
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
  const runtime: RecursiveModelConfig = {
    ...DEFAULT_PROJECT_CONFIG.runtime,
    ...config.runtime,
    ...overrides,
  };
  if (runtime.maxDepth === undefined) {
    delete runtime.maxDepth;
  }

  return runtime;
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

function defaultAgentModels(): Record<ModelPurpose, ModelSelection> {
  return {
    depth: "small",
    classify: "small",
    decompose: "medium",
    answer: "dynamic",
    summarize: "small",
    synthesize: "medium",
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
