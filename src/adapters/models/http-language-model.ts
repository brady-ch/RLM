import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelResponse,
} from "../../ports/language-model-port.js";

export interface HttpLanguageModelOptions {
  model: string;
  baseUrl: string;
}

export class HttpLanguageModelAdapter implements LanguageModelPort {
  constructor(private readonly options: HttpLanguageModelOptions) {}

  async complete(
    messages: LanguageModelMessage[],
    completeOptions: LanguageModelCompleteOptions = {},
  ): Promise<LanguageModelResponse> {
    const response = await fetch(this.options.baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.options.model,
        messages,
        options: completeOptions,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `HTTP host completion failed for ${this.options.model}: HTTP ${response.status}`,
      );
    }

    const payload = (await response.json()) as Partial<LanguageModelResponse>;
    return {
      content: payload.content ?? "",
      toolCalls: payload.toolCalls ?? [],
      usage: payload.usage,
      model: payload.model ?? this.options.model,
      sampling: payload.sampling,
      host: payload.host,
    };
  }

  async close(): Promise<void> {
    // Stateless HTTP adapter; no persistent host-side session to tear down.
  }
}
