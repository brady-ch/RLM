import { ChatOllama } from "@langchain/ollama";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessageLike } from "@langchain/core/messages";
import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelResponse,
  LanguageModelUsage,
} from "../ports/language-model-port.js";

export interface OllamaLanguageModelOptions {
  model: string;
  baseUrl?: string;
  temperature?: number;
}

export class OllamaLanguageModelAdapter implements LanguageModelPort {
  private readonly client: ChatOllama;
  private readonly modelName: string;
  private readonly baseUrl: string;

  constructor(options: OllamaLanguageModelOptions) {
    this.modelName = options.model;
    this.baseUrl = options.baseUrl ?? "http://127.0.0.1:11434";
    const fields: ConstructorParameters<typeof ChatOllama>[0] = {
      model: options.model,
      temperature: options.temperature ?? 0.2,
    };
    if (options.baseUrl) {
      fields.baseUrl = options.baseUrl;
    }

    this.client = new ChatOllama(fields);
  }

  async complete(messages: LanguageModelMessage[], options: LanguageModelCompleteOptions = {}): Promise<LanguageModelResponse> {
    const runnable = options.tools && options.tools.length > 0 ? this.client.bindTools(options.tools) : this.client;
    const response = await runnable.invoke(messages.map(toLangChainMessage));
    const content = typeof response.content === "string"
      ? response.content
      : response.content.map((part) => (typeof part === "string" ? part : JSON.stringify(part))).join("");

    return {
      content,
      toolCalls: (response.tool_calls ?? []).map((toolCall, index) => ({
        id: toolCall.id ?? `tool-call-${index + 1}`,
        name: toolCall.name,
        args: toolCall.args,
      })),
      usage: extractUsage(response),
      model: this.modelName,
    };
  }

  async close(): Promise<void> {
    const response = await fetch(new URL("/api/generate", this.baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.modelName,
        prompt: "",
        stream: false,
        keep_alive: 0,
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama unload failed for ${this.modelName}: HTTP ${response.status}`);
    }
  }
}

function extractUsage(response: unknown): LanguageModelUsage | undefined {
  const candidate = response as {
    usage_metadata?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
    response_metadata?: {
      prompt_eval_count?: number;
      eval_count?: number;
    };
  };
  const usageMetadata = candidate.usage_metadata;
  if (usageMetadata) {
    return {
      inputTokens: usageMetadata.input_tokens,
      outputTokens: usageMetadata.output_tokens,
      totalTokens: usageMetadata.total_tokens,
    };
  }

  const responseMetadata = candidate.response_metadata;
  if (!responseMetadata) {
    return undefined;
  }

  const inputTokens = responseMetadata.prompt_eval_count;
  const outputTokens = responseMetadata.eval_count;
  if (inputTokens === undefined && outputTokens === undefined) {
    return undefined;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
  };
}

function toLangChainMessage(message: LanguageModelMessage): BaseMessageLike {
  if (message.role === "tool") {
    return new ToolMessage({
      content: message.content,
      tool_call_id: message.toolCallId ?? "unknown-tool-call",
    });
  }

  if (message.role === "assistant") {
    const fields: ConstructorParameters<typeof AIMessage>[0] = {
      content: message.content,
    };
    if (message.toolCalls) {
      fields.tool_calls = message.toolCalls;
    }

    return new AIMessage(fields);
  }

  return [message.role, message.content];
}
