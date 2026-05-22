import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelResponse,
} from "../../src/ports/language-model-port.js";

export type QueueResponse = string | LanguageModelResponse | Error;

export class QueueModel implements LanguageModelPort {
  readonly calls: Array<{
    messages: LanguageModelMessage[];
    options: LanguageModelCompleteOptions;
  }> = [];

  constructor(private readonly responses: QueueResponse[]) {}

  async complete(
    messages: LanguageModelMessage[],
    options: LanguageModelCompleteOptions = {},
  ): Promise<LanguageModelResponse> {
    this.calls.push({ messages, options });
    const response = this.responses.shift();
    if (response === undefined) {
      throw new Error("No queued response");
    }
    if (response instanceof Error) {
      throw response;
    }

    return typeof response === "string" ? { content: response, toolCalls: [] } : response;
  }
}

export class DelayedQueueModel implements LanguageModelPort {
  readonly calls: Array<{
    messages: LanguageModelMessage[];
    options: LanguageModelCompleteOptions;
  }> = [];

  constructor(
    private readonly responses: QueueResponse[],
    private readonly delayMs = 200,
  ) {}

  async complete(
    messages: LanguageModelMessage[],
    options: LanguageModelCompleteOptions = {},
  ): Promise<LanguageModelResponse> {
    this.calls.push({ messages, options });
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    const response = this.responses.shift();
    if (response === undefined) {
      throw new Error("No queued response");
    }
    if (response instanceof Error) {
      throw response;
    }

    return typeof response === "string" ? { content: response, toolCalls: [] } : response;
  }
}

export class ThrowingModel implements LanguageModelPort {
  constructor(private readonly message: string) {}

  async complete(): Promise<LanguageModelResponse> {
    throw new Error(this.message);
  }
}
