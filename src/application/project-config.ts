import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { LanguageModelPurpose } from "../ports/language-model-port.js";

export const MODEL_PURPOSES = ["depth", "classify", "decompose", "answer", "summarize", "synthesize"] as const satisfies readonly LanguageModelPurpose[];

export type ModelPurpose = typeof MODEL_PURPOSES[number];
export type MemoryMode = "auto" | number;
export type ModelSelection = string | "dynamic";

export interface ModelTierConfig {
  name: string;
  estimatedRamMb: number;
}

export interface AgentConfig {
  tools: string[];
  models: Record<ModelPurpose, ModelSelection>;
}

export interface WorkflowConfig {
  mode: "ram_queue";
  agents: string[];
  continueOnError: boolean;
  qa?: WorkflowQaConfig | undefined;
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
  };
  memory: {
    maxRamMb: MemoryMode;
    reserveSystemRamMb: number;
    waitForCapacity: boolean;
    capacityCheckIntervalMs: number;
  };
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
  })),
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
  }
}
