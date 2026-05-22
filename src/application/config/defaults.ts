import type { AgentConfig, ProjectConfig } from "./types.js";

export const defaultQualityLoopConfig = {
  enabled: false,
  maxIterations: 3,
  budgetBehavior: "stop_before_partial_iteration" as const,
};

function defaultAgentModels(): AgentConfig["models"] {
  return {
    depth: "small",
    classify: "small",
    decompose: "medium",
    answer: "dynamic",
    summarize: "small",
    synthesize: "medium",
    plan: "medium",
    quality_loop_draft: "dynamic",
    quality_loop_critique: "dynamic",
    quality_loop_refine: "dynamic",
    quality_loop_gate: "dynamic",
    quality_loop_best_of_progress: "dynamic",
  };
}

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
export const DEFAULT_PROJECT_PLAIN = JSON.parse(JSON.stringify(DEFAULT_PROJECT_CONFIG)) as Record<
  string,
  unknown
>;
