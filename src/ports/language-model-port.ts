export interface LanguageModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: LanguageModelToolCall[];
}

export interface LanguageModelPort {
  complete(messages: LanguageModelMessage[], options?: LanguageModelCompleteOptions): Promise<LanguageModelResponse>;
  close?(): Promise<void>;
}

export interface LanguageModelCompleteOptions {
  tools?: LanguageModelTool[];
  purpose?: LanguageModelPurpose | undefined;
  complexityDepth?: number;
}

export type LanguageModelPurpose = "depth" | "classify" | "decompose" | "answer" | "summarize" | "synthesize";

export interface LanguageModelResponse {
  content: string;
  toolCalls: LanguageModelToolCall[];
  usage?: LanguageModelUsage | undefined;
  model?: string | undefined;
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
