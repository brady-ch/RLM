import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTrace } from "../src/adapters/in-memory-trace.js";
import { RecursiveLanguageModel } from "../src/domain/recursive-language-model.js";
import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelResponse,
} from "../src/ports/language-model-port.js";
import type { ToolExecutionResult, ToolPort } from "../src/ports/tool-port.js";

class EchoTool implements ToolPort {
  readonly name = "echo";
  readonly description = "echo";
  readonly schema = {};
  async execute(): Promise<ToolExecutionResult> {
    return { status: "success", output: "echoed" };
  }
}

class RecordingModel implements LanguageModelPort {
  readonly calls: Array<{
    options: LanguageModelCompleteOptions;
    messages: LanguageModelMessage[];
  }> = [];

  async complete(
    messages: LanguageModelMessage[],
    options: LanguageModelCompleteOptions = {},
  ): Promise<LanguageModelResponse> {
    this.calls.push({ options, messages });
    if ((options.tools?.length ?? 0) > 0 && this.calls.length === 1) {
      return {
        content: "tool requested",
        toolCalls: [{ id: "t1", name: "echo", args: {} }],
      };
    }
    return { content: "done", toolCalls: [] };
  }
}

test("tool-enabled rounds set constrainedToolCalling=true", async () => {
  const model = new RecordingModel();
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(model, trace, [new EchoTool()]);
  const result = await engine.run({
    prompt: "Use a tool once",
    config: {
      maxDepth: 0,
      maxDynamicDepth: 1,
      maxBranches: 1,
      maxPromptCharacters: 500,
      maxModelCalls: 8,
      maxToolRounds: 1,
    },
  });
  assert.equal(result.answer.length > 0, true);
  assert.equal(model.calls[0]?.options.constrainedToolCalling, true);
});

test("non-tool rounds set constrainedToolCalling=false", async () => {
  const model = new RecordingModel();
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(model, trace, []);
  await engine.run({
    prompt: "Simple answer",
    config: {
      maxDepth: 0,
      maxDynamicDepth: 1,
      maxBranches: 1,
      maxPromptCharacters: 500,
      maxModelCalls: 8,
      maxToolRounds: 0,
    },
  });

  assert.equal(model.calls[0]?.options.constrainedToolCalling, false);
});
