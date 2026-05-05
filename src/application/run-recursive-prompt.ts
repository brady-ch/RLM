import { RecursiveLanguageModel } from "../domain/recursive-language-model.js";
import type { RecursiveModelConfig, RecursivePromptResult } from "../domain/types.js";
import type { LanguageModelPort } from "../ports/language-model-port.js";
import type { ToolPort } from "../ports/tool-port.js";
import type { TracePort } from "../ports/trace-port.js";

export interface RunRecursivePromptInput {
  prompt: string;
  config: RecursiveModelConfig;
  model: LanguageModelPort;
  trace: TracePort;
  tools?: ToolPort[];
}

export async function runRecursivePrompt(input: RunRecursivePromptInput): Promise<RecursivePromptResult> {
  const engine = new RecursiveLanguageModel(input.model, input.trace, input.tools ?? []);
  return engine.run({
    prompt: input.prompt,
    config: input.config,
  });
}
