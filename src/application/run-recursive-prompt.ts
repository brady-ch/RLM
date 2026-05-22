import { RecursiveLanguageModel } from "../domain/recursive-language-model.js";
import type {
  RecursiveModelConfig,
  RecursivePromptResult,
  RuntimeMemory,
} from "../domain/types.js";
import type { SelectedAgent } from "../domain/agents.js";
import type { LanguageModelPort } from "../ports/language-model-port.js";
import type { ToolPort } from "../ports/tool-port.js";
import type { TracePort } from "../ports/trace-port.js";
import type { RuntimeLogger } from "../ports/runtime-logger-port.js";
import type { ExecutionControl } from "../domain/types.js";

export interface RunRecursivePromptInput {
  prompt: string;
  config: RecursiveModelConfig;
  model: LanguageModelPort;
  trace: TracePort;
  tools?: ToolPort[];
  agent?: SelectedAgent;
  logger?: RuntimeLogger | undefined;
  execution?: ExecutionControl | undefined;
  runState?: Parameters<RecursiveLanguageModel["run"]>[0]["runState"] | undefined;
  memory?: RuntimeMemory | undefined;
}

export async function runRecursivePrompt(
  input: RunRecursivePromptInput,
): Promise<RecursivePromptResult> {
  const engine = new RecursiveLanguageModel(input.model, input.trace, input.tools ?? []);
  const request: Parameters<typeof engine.run>[0] = {
    prompt: input.prompt,
    config: input.config,
    logger: input.logger,
    execution: input.execution,
    runState: input.runState,
    memory: input.memory,
  };
  if (input.agent) {
    request.agent = input.agent;
  }

  return engine.run(request);
}
