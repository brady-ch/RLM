export interface LanguageModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: LanguageModelToolCall[];
}

export interface LanguageModelPort {
  complete(
    messages: LanguageModelMessage[],
    options?: LanguageModelCompleteOptions,
  ): Promise<LanguageModelResponse>;
  close?(): Promise<void>;
}

export interface LanguageModelCompleteOptions {
  tools?: LanguageModelTool[];
  purpose?: LanguageModelPurpose | undefined;
  complexityDepth?: number;
  overrideModel?: string | undefined;
  overrideModelSelection?: string | undefined;
  constrainedToolCalling?: boolean | undefined;
  sampling?: LanguageModelSamplingOptions | undefined;
}

export type LanguageModelPurpose =
  | "depth"
  | "classify"
  | "decompose"
  | "answer"
  | "summarize"
  | "synthesize"
  | "plan"
  | "quality_loop_draft"
  | "quality_loop_critique"
  | "quality_loop_refine"
  | "quality_loop_gate"
  | "quality_loop_best_of_progress";

export interface LanguageModelResponse {
  content: string;
  toolCalls: LanguageModelToolCall[];
  usage?: LanguageModelUsage | undefined;
  model?: string | undefined;
  sampling?: EffectiveSamplingMetadata | undefined;
  host?:
    | {
        id: string;
        kind: "ollama" | "http";
        endpoint: string;
        constrainedToolCalling?: boolean | undefined;
        degradedToolCalling?: boolean | undefined;
      }
    | undefined;
}

export interface LanguageModelSamplingOptions {
  temperature?: number | undefined;
  topP?: number | undefined;
  topK?: number | undefined;
  repeatPenalty?: number | undefined;
  maxTokens?: number | undefined;
  seed?: number | undefined;
}

export type SamplingParameterName = keyof LanguageModelSamplingOptions;
export type SamplingSourceLayer = "adapter_default" | "global" | "model_profile" | "node";

export interface EffectiveSamplingMetadata {
  values: LanguageModelSamplingOptions;
  sources: Partial<Record<SamplingParameterName, SamplingSourceLayer>>;
  warnings?: string[] | undefined;
}

export interface LanguageModelUsage {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  totalTokens?: number | undefined;
}

export interface LanguageModelTool {
  name: string;
  description: string;
  schema: unknown;
}

export interface LanguageModelToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}
