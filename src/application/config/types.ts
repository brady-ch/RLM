import type { RecursiveModelConfig } from "../../domain/types.js";
import type { ExtensionRegistryEntry } from "../../ports/extension-port.js";
import type {
  LanguageModelPurpose,
  LanguageModelSamplingOptions,
} from "../../ports/language-model-port.js";

export const MODEL_PURPOSES = [
  "depth",
  "classify",
  "decompose",
  "answer",
  "summarize",
  "synthesize",
  "plan",
  "quality_loop_draft",
  "quality_loop_critique",
  "quality_loop_refine",
  "quality_loop_gate",
  "quality_loop_best_of_progress",
] as const satisfies readonly LanguageModelPurpose[];

export const CORE_MODEL_PURPOSES = [
  "depth",
  "classify",
  "decompose",
  "answer",
  "summarize",
  "synthesize",
] as const satisfies readonly LanguageModelPurpose[];

export type ModelPurpose = (typeof MODEL_PURPOSES)[number];
export type CoreModelPurpose = (typeof CORE_MODEL_PURPOSES)[number];
export type MemoryMode = "auto" | number;
export type ModelSelection = string | "dynamic";

export interface ModelTierConfig {
  name: string;
  estimatedRamMb: number;
}

export interface SamplingConfig {
  defaults?: LanguageModelSamplingOptions | undefined;
  modelProfiles?: Record<string, LanguageModelSamplingOptions> | undefined;
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

export interface RamQueueWorkflowConfig {
  mode: "ram_queue";
  agents: string[];
  continueOnError: boolean;
  qa?: WorkflowQaConfig | undefined;
  dispatch?: WorkflowDispatchConfig | undefined;
}

export interface GraphWorkflowConfig {
  kind: "graph";
  path?: string | undefined;
  defaultVariant?: "playbook" | "pipeline" | undefined;
}

export type WorkflowConfig = RamQueueWorkflowConfig | GraphWorkflowConfig;

export function isGraphWorkflowConfig(workflow: WorkflowConfig): workflow is GraphWorkflowConfig {
  return "kind" in workflow && workflow.kind === "graph";
}

export function isRamQueueWorkflowConfig(
  workflow: WorkflowConfig,
): workflow is RamQueueWorkflowConfig {
  return "mode" in workflow && workflow.mode === "ram_queue";
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
    sampling?: SamplingConfig | undefined;
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
  extensions?:
    | {
        allowlist?: string | undefined;
        load?: ExtensionRegistryEntry[] | undefined;
      }
    | undefined;
  interop?: InteropConfig | undefined;
  hosts?: Record<string, ModelHostConfig> | undefined;
  runtimeHost?: string | undefined;
}

export interface LoadedProjectConfig {
  config: ProjectConfig;
  path?: string | undefined;
}
