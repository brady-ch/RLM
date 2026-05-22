import { ChatOllama } from "@langchain/ollama";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessageLike } from "@langchain/core/messages";
import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelResponse,
  LanguageModelSamplingOptions,
  LanguageModelUsage,
} from "../../ports/language-model-port.js";

export interface OllamaLanguageModelOptions {
  model: string;
  baseUrl?: string;
  temperature?: number;
}

export class OllamaLanguageModelAdapter implements LanguageModelPort {
  private readonly client: ChatOllama;
  private readonly modelName: string;
  private readonly baseUrl: string;
  private readonly defaultTemperature: number;

  constructor(options: OllamaLanguageModelOptions) {
    this.modelName = options.model;
    this.baseUrl = options.baseUrl ?? "http://127.0.0.1:11434";
    this.defaultTemperature = options.temperature ?? 0.2;
    const fields: ConstructorParameters<typeof ChatOllama>[0] = {
      model: options.model,
      temperature: this.defaultTemperature,
    };
    if (options.baseUrl) {
      fields.baseUrl = options.baseUrl;
    }

    this.client = new ChatOllama(fields);
  }

  async complete(
    messages: LanguageModelMessage[],
    options: LanguageModelCompleteOptions = {},
  ): Promise<LanguageModelResponse> {
    const client = this.createClient(options.sampling);
    let response: Awaited<ReturnType<typeof this.client.invoke>>;
    if (options.tools && options.tools.length > 0 && options.constrainedToolCalling) {
      // Ollama cannot combine strict format constraints and executable tool-calls in a single pass.
      // Run an explicit two-step protocol: constrained selection, then executable tool call.
      const selectionPass = await client.invoke(messages.map(toLangChainMessage));
      const selectedToolCalls = (selectionPass.tool_calls ?? []).map((toolCall, index) => ({
        id: toolCall.id ?? `tool-call-${index + 1}`,
        name: toolCall.name,
        args: toolCall.args,
      }));
      if (selectedToolCalls.length > 0) {
        const toolRunnable = client.bindTools(options.tools);
        const toolMessages: LanguageModelMessage[] = [
          ...messages,
          {
            role: "assistant",
            content: typeof selectionPass.content === "string" ? selectionPass.content : "",
            toolCalls: selectedToolCalls,
          },
        ];
        response = await toolRunnable.invoke(toolMessages.map(toLangChainMessage));
      } else {
        response = selectionPass;
      }
    } else {
      const runnable =
        options.tools && options.tools.length > 0 ? client.bindTools(options.tools) : client;
      response = await runnable.invoke(messages.map(toLangChainMessage));
    }
    const content =
      typeof response.content === "string"
        ? response.content
        : response.content
            .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
            .join("");

    return {
      content,
      toolCalls: (response.tool_calls ?? []).map((toolCall, index) => ({
        id: toolCall.id ?? `tool-call-${index + 1}`,
        name: toolCall.name,
        args: toolCall.args,
      })),
      usage: extractUsage(response),
      model: this.modelName,
      host: {
        id: "local_ollama",
        kind: "ollama",
        endpoint: this.baseUrl,
        constrainedToolCalling: options.constrainedToolCalling,
      },
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

  private createClient(sampling?: LanguageModelSamplingOptions | undefined): ChatOllama {
    if (!sampling) {
      return this.client;
    }
    const fields: ConstructorParameters<typeof ChatOllama>[0] = {
      model: this.modelName,
      baseUrl: this.baseUrl,
      temperature: sampling.temperature ?? this.defaultTemperature,
    };
    if (sampling.topP !== undefined) fields.topP = sampling.topP;
    if (sampling.topK !== undefined) fields.topK = sampling.topK;
    if (sampling.repeatPenalty !== undefined) fields.repeatPenalty = sampling.repeatPenalty;
    if (sampling.maxTokens !== undefined) fields.numPredict = sampling.maxTokens;
    if (sampling.seed !== undefined) fields.seed = sampling.seed;
    return new ChatOllama(fields);
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
