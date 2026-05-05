import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { RecursiveLanguageModel } from "../src/domain/recursive-language-model.js";
import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelResponse,
} from "../src/ports/language-model-port.js";
import type { ToolExecutionResult, ToolPort } from "../src/ports/tool-port.js";
import { InMemoryTrace } from "../src/adapters/in-memory-trace.js";
import { GuardedShellTool } from "../src/adapters/guarded-shell-tool.js";
import { WorkspaceFileWriteTool } from "../src/adapters/workspace-file-write-tool.js";
import { parseArgs } from "../src/cli/args.js";
import { renderResult } from "../src/cli/render.js";

type QueueResponse = string | LanguageModelResponse;

class QueueModel implements LanguageModelPort {
  readonly calls: Array<{ messages: LanguageModelMessage[]; options: LanguageModelCompleteOptions }> = [];

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

    return typeof response === "string" ? { content: response, toolCalls: [] } : response;
  }
}

class EchoTool implements ToolPort {
  readonly name = "echo";
  readonly description = "Echo input text.";
  readonly schema = {};

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    return {
      status: "success",
      output: `echo: ${String(args["text"] ?? "")}`,
    };
  }
}

const config = {
  maxDepth: 2,
  maxDynamicDepth: 4,
  maxBranches: 2,
  maxPromptCharacters: 1_000,
  maxModelCalls: 100,
  maxToolRounds: 3,
};

const dynamicDepthConfig = {
  maxDynamicDepth: 4,
  maxBranches: 2,
  maxPromptCharacters: 1_000,
  maxModelCalls: 100,
  maxToolRounds: 3,
};

test("answers directly when max depth is zero", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new QueueModel(["direct answer"]), trace);

  const result = await engine.run({
    prompt: "Explain recursion",
    config: {
      ...config,
      maxDepth: 0,
    },
  });

  assert.equal(result.answer, "direct answer");
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["answer"],
  );
});

test("decomposes, solves children, summarizes, and synthesizes", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      "RECURSIVE: needs parts",
      "Define recursion\nGive an example",
      "DIRECT: definition is simple",
      "Recursion is self-reference with a base case.",
      "Definition summary",
      "DIRECT: example is simple",
      "A function walking a tree can recurse into child nodes.",
      "Example summary",
      "Final synthesized answer",
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Explain recursion with an example",
    config,
  });

  assert.equal(result.answer, "Final synthesized answer");
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["classify", "decompose", "classify", "answer", "summarize", "classify", "answer", "summarize", "synthesize"],
  );
});

test("treats direct classifications with recursive in the reason as direct", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel(["DIRECT: no recursive decomposition needed", "direct answer"]),
    trace,
  );

  const result = await engine.run({
    prompt: "Answer this plainly",
    config,
  });

  assert.equal(result.answer, "direct answer");
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["classify", "answer"],
  );
});

test("supports nested recursive passes until max depth", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      "RECURSIVE: split the broad task",
      "Research options\nWrite recommendation",
      "RECURSIVE: options need subparts",
      "Option A\nOption B",
      "Grandchild A answer",
      "Grandchild A summary",
      "Grandchild B answer",
      "Grandchild B summary",
      "Options synthesized",
      "Options summary",
      "DIRECT: recommendation is simple",
      "Recommendation answer",
      "Recommendation summary",
      "Final synthesized answer",
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Compare options and recommend one",
    config,
  });

  assert.equal(result.answer, "Final synthesized answer");
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    [
      "classify",
      "decompose",
      "classify",
      "decompose",
      "answer",
      "summarize",
      "answer",
      "summarize",
      "synthesize",
      "summarize",
      "classify",
      "answer",
      "summarize",
      "synthesize",
    ],
  );
  assert.equal(result.trace.filter((event) => event.depth === 2 && event.kind === "answer").length, 2);
});

test("limits branches from decomposition output", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      "RECURSIVE",
      "One\nTwo\nThree",
      "DIRECT",
      "one answer",
      "one summary",
      "DIRECT",
      "two answer",
      "two summary",
      "combined",
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Split this",
    config,
  });

  assert.equal(result.answer, "combined");
  assert.equal(result.trace.filter((event) => event.kind === "answer").length, 2);
});

test("parses cli options with granite default", () => {
  const options = parseArgs(["ask", "hello", "--depth", "3", "--branches", "4", "--compact"], {});

  assert.equal(options.prompt, "hello");
  assert.equal(options.model, "granite4.1:3b");
  assert.equal(options.config.maxDepth, 3);
  assert.equal(options.config.maxBranches, 4);
  assert.equal(options.config.maxModelCalls, 24);
  assert.equal(options.compact, true);
});

test("parses direct prompt command shape and json output flag", () => {
  const options = parseArgs(["hello", "world", "--json"], {});

  assert.equal(options.prompt, "hello world");
  assert.equal(options.command, "ask");
  assert.equal(options.json, true);
  assert.equal(options.config.maxDepth, undefined);
  assert.equal(options.config.maxDynamicDepth, 4);
});

test("stops recursive expansion when model call budget is nearly exhausted", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel(["RECURSIVE", "direct within budget"]),
    trace,
  );

  const result = await engine.run({
    prompt: "Split this forever",
    config: {
      ...config,
      maxModelCalls: 2,
    },
  });

  assert.equal(result.answer, "direct within budget");
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["classify", "answer"],
  );
});

test("selects recursion depth with the model when no override is provided", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new QueueModel(["3", "DIRECT", "direct answer"]), trace);

  const result = await engine.run({
    prompt: "Analyze a complex project",
    config: dynamicDepthConfig,
  });

  assert.equal(result.answer, "direct answer");
  assert.deepEqual(result.metadata.depth, {
    selected: 3,
    source: "model",
  });
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["depth", "classify", "answer"],
  );
});

test("falls back when dynamic depth classifier does not return an integer", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new QueueModel(["not sure", "DIRECT", "direct answer"]), trace);

  const result = await engine.run({
    prompt: "Analyze this",
    config: dynamicDepthConfig,
  });

  assert.deepEqual(result.metadata.depth, {
    selected: 2,
    source: "fallback",
  });
});

test("executes bounded tool calls during answer steps", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel([
    {
      content: "",
      toolCalls: [
        {
          id: "call-1",
          name: "echo",
          args: {
            text: "hello",
          },
        },
      ],
    },
    "final answer",
  ]);
  const engine = new RecursiveLanguageModel(model, trace, [new EchoTool()]);

  const result = await engine.run({
    prompt: "Use a tool",
    config: {
      ...config,
      maxDepth: 0,
    },
  });

  assert.equal(result.answer, "final answer");
  assert.equal(result.metadata.toolCalls.length, 1);
  assert.equal(result.metadata.toolCalls[0]?.output, "echo: hello");
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["tool-call", "tool-result", "answer"],
  );
  assert.equal(model.calls[0]?.options.tools?.length, 1);
  assert.equal(model.calls[1]?.messages.at(-1)?.role, "tool");
});

test("guarded shell tool rejects non-allowlisted commands", async () => {
  const tool = new GuardedShellTool({
    workspaceRoot: process.cwd(),
  });

  const result = await tool.execute({
    command: "npm test",
  });

  assert.equal(result.status, "error");
  assert.match(result.output, /not allowlisted/);
});

test("workspace file write tool writes and appends inside the open directory", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "rlm-write-tool-"));
  try {
    const tool = new WorkspaceFileWriteTool({
      workspaceRoot: workspace,
    });

    const writeResult = await tool.execute({
      path: "notes/output.txt",
      content: "hello",
    });
    const appendResult = await tool.execute({
      path: "notes/output.txt",
      content: " world",
      mode: "append",
    });

    assert.equal(writeResult.status, "success");
    assert.equal(appendResult.status, "success");
    assert.equal(await readFile(join(workspace, "notes/output.txt"), "utf8"), "hello world");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("workspace file write tool rejects paths outside the open directory", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "rlm-write-tool-"));
  try {
    const tool = new WorkspaceFileWriteTool({
      workspaceRoot: workspace,
    });

    const result = await tool.execute({
      path: "../outside.txt",
      content: "nope",
    });

    assert.equal(result.status, "error");
    assert.match(result.output, /outside the open workspace directory/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("renders compact output for subprocess use", () => {
  const output = renderResult(
    {
      answer: "Hello\nworld",
      metadata: {
        depth: {
          selected: 2,
          source: "override",
        },
        toolCalls: [],
        errors: [],
      },
      trace: [
        {
          id: "task-1",
          depth: 0,
          kind: "answer",
          prompt: "hello",
          output: "Hello\nworld",
        },
      ],
    },
    {
      compact: true,
      json: false,
      includeTrace: true,
      model: "granite4.1:3b",
    },
  );

  assert.match(output, /model: granite4\.1:3b/);
  assert.match(output, /answer: Hello world/);
  assert.match(output, /trace:/);
});

test("renders json output for tool use", () => {
  const output = renderResult(
    {
      answer: "Hello world",
      metadata: {
        depth: {
          selected: 1,
          source: "model",
        },
        toolCalls: [],
        errors: [],
      },
      trace: [],
    },
    {
      compact: false,
      json: true,
      includeTrace: false,
      model: "granite4.1:3b",
    },
  );

  assert.deepEqual(JSON.parse(output), {
    answer: "Hello world",
    model: "granite4.1:3b",
    depth: {
      selected: 1,
      source: "model",
    },
    trace: [],
    toolCalls: [],
    errors: [],
  });
});
