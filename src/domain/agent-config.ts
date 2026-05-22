import type { LanguageModelPurpose } from "../ports/language-model-port.js";

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
export type ModelSelection = string | "dynamic";

export interface AgentConfig {
  tools: string[];
  models: Record<CoreModelPurpose, ModelSelection> & Partial<Record<ModelPurpose, ModelSelection>>;
}
