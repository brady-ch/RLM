import { ChatOllama } from "@langchain/ollama";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessageLike } from "@langchain/core/messages";
import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelResponse,
} from "../ports/language-model-port.js";

export interface OllamaLanguageModelOptions {
  model: string;
  baseUrl?: string;
  temperature?: number;
}

export class OllamaLanguageModelAdapter implements LanguageModelPort {
  private readonly client: ChatOllama;

  constructor(options: OllamaLanguageModelOptions) {
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
    };
  }
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
