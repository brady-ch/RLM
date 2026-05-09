import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
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
import { buildSearchQuery } from "../src/adapters/search-query.js";
import { WebSearchTool, parseUddgLines } from "../src/adapters/web-search-tool.js";
import { WebFetchTool } from "../src/adapters/web-fetch-tool.js";
import { analyzeHtmlContent, stripFluffWords, stripHtmlTags } from "../src/application/content-tree.js";
import { createAgentRegistry, selectAgent } from "../src/application/agent-registry.js";
import { loadProjectConfig, resolveRuntimeConfig } from "../src/application/project-config.js";
import { MemoryManager } from "../src/application/memory-manager.js";
import { PurposeRoutingLanguageModel, selectDynamicTier } from "../src/application/model-provider.js";
import { createYamlModelScoreStore } from "../src/application/model-score-store.js";
import { buildBugfixQueue, runWorkflow } from "../src/application/workflow-runner.js";
import { createInteractiveExecutionSession } from "../src/application/execution-controller.js";
import { parseArgs } from "../src/cli/args.js";
import { renderResult } from "../src/cli/render.js";
import type { RuntimeLogEvent, RuntimeLogger } from "../src/ports/runtime-logger-port.js";

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

class CaptureLogger implements RuntimeLogger {
  readonly events: RuntimeLogEvent[] = [];

  log(event: RuntimeLogEvent): void {
    this.events.push(event);
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
  assert.equal(options.modelOverride, undefined);
  assert.equal(options.config.maxDepth, 3);
  assert.equal(options.config.maxBranches, 4);
  assert.deepEqual(options.configOverrides, {
    maxDepth: 3,
    maxBranches: 4,
  });
  assert.equal(options.config.maxModelCalls, 24);
  assert.equal(options.compact, true);
  assert.equal(options.verbose, false);
});

test("parses verbose cli option and env default", () => {
  assert.equal(parseArgs(["ask", "hello", "--verbose"], {}).verbose, true);
  assert.equal(parseArgs(["ask", "hello"], { RLM_VERBOSE: "1" }).verbose, true);
  assert.equal(parseArgs(["ask", "hello"], { RLM_MODEL: "yaml-override-model" }).modelOverride, "yaml-override-model");
});

test("parses direct prompt command shape and json output flag", () => {
  const options = parseArgs(["hello", "world", "--json", "--agent", "research", "--workflow", "default", "--config", "custom.yaml"], {});

  assert.equal(options.prompt, "hello world");
  assert.equal(options.command, "ask");
  assert.equal(options.json, true);
  assert.equal(options.agent, "research");
  assert.equal(options.workflow, "default");
  assert.equal(options.configPath, "custom.yaml");
  assert.equal(options.config.maxDepth, undefined);
  assert.equal(options.config.maxDynamicDepth, 4);
});

test("parses ui command and ui port", () => {
  const options = parseArgs(["ui", "review", "the", "plan", "--ui-port", "4545"], {});

  assert.equal(options.command, "ui");
  assert.equal(options.prompt, "review the plan");
  assert.equal(options.uiPort, 4545);
});

test("interactive execution waits for node approval and uses edited prompt", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel(["edited answer"]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession();

  const run = engine.run({
    prompt: "original prompt",
    config: {
      ...config,
      maxDepth: 0,
    },
    execution: session.control,
  });

  await session.waitForNodeStatus("task-1", "awaiting_approval");
  assert.equal(model.calls.length, 0);

  session.editNodePrompt("task-1", "edited prompt");
  session.approveNode("task-1");

  const result = await run;
  assert.equal(result.answer, "edited answer");
  assert.equal(model.calls[0]?.messages.at(-1)?.content, "edited prompt");
  assert.equal(session.snapshot().graph.nodes.find((node) => node.id === "task-1")?.status, "completed");
});

test("interactive execution rejects stale approval tokens", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel(["approved answer"]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession();

  const run = engine.run({
    prompt: "token test",
    config: {
      ...config,
      maxDepth: 0,
    },
    execution: session.control,
  });

  await session.waitForNodeStatus("task-1", "awaiting_approval");
  const token = session.snapshot().graph.nodes.find((node) => node.id === "task-1")?.approvalToken;
  assert.ok(token);

  assert.throws(() => session.approveNode("task-1", "task-1:0"), /Stale approval token/);
  session.approveNode("task-1", token);

  const result = await run;
  assert.equal(result.answer, "approved answer");
});

test("interactive execution treats duplicate approval token as no-op", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel(["approved answer"]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession();

  const run = engine.run({
    prompt: "duplicate test",
    config: {
      ...config,
      maxDepth: 0,
    },
    execution: session.control,
  });

  await session.waitForNodeStatus("task-1", "awaiting_approval");
  const token = session.snapshot().graph.nodes.find((node) => node.id === "task-1")?.approvalToken;
  assert.ok(token);

  const first = session.approveNode("task-1", token);
  const duplicate = session.approveNode("task-1", token);

  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);

  const result = await run;
  assert.equal(result.answer, "approved answer");
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

test("counts depth selection against the total model call budget", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new QueueModel(["3", "direct within budget"]), trace);

  const result = await engine.run({
    prompt: "Analyze a complex project",
    config: {
      ...dynamicDepthConfig,
      maxModelCalls: 2,
    },
  });

  assert.equal(result.answer, "direct within budget");
  assert.equal(result.metadata.modelCalls, 2);
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["depth", "answer"],
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
  const logger = new CaptureLogger();
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
    logger,
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
  assert.ok(logger.events.some((event) => event.stage === "tool" && event.message === "starting tool call"));
  assert.ok(logger.events.some((event) => event.stage === "tool" && event.message === "completed tool call"));
});

test("logs recursive task plan after decomposition", async () => {
  const trace = new InMemoryTrace();
  const logger = new CaptureLogger();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      "RECURSIVE",
      "First child\nSecond child",
      "First answer",
      "First summary",
      "Second answer",
      "Second summary",
      "Final answer",
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Split this",
    config: {
      ...config,
      maxDepth: 1,
    },
    logger,
  });

  assert.equal(result.answer, "Final answer");
  const planEvent = logger.events.find((event) => event.stage === "plan" && event.message === "created recursive task plan");
  assert.ok(planEvent);
  assert.deepEqual((planEvent.data?.["children"] as Array<{ id: string; prompt: string }>).map((child) => child.prompt), [
    "First child",
    "Second child",
  ]);
});

test("logs failed unknown tool calls and continues with tool result context", async () => {
  const trace = new InMemoryTrace();
  const logger = new CaptureLogger();
  const model = new QueueModel([
    {
      content: "",
      toolCalls: [
        {
          id: "call-missing",
          name: "missing_tool",
          args: {
            text: "hello",
          },
        },
      ],
    },
    "final answer",
  ]);
  const engine = new RecursiveLanguageModel(model, trace, []);

  const result = await engine.run({
    prompt: "Use a missing tool",
    config: {
      ...config,
      maxDepth: 0,
    },
    logger,
  });

  assert.equal(result.answer, "final answer");
  assert.match(result.metadata.errors[0] ?? "", /Unknown tool/);
  assert.ok(logger.events.some((event) => event.stage === "tool" && event.message === "failed tool call"));
  assert.equal(model.calls[1]?.messages.at(-1)?.role, "tool");
});

test("answers from available context when tool round limit is reached", async () => {
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
    "direct answer after tool limit",
  ]);
  const engine = new RecursiveLanguageModel(model, trace, [new EchoTool()]);

  const result = await engine.run({
    prompt: "Use a tool once",
    config: {
      ...config,
      maxDepth: 0,
      maxToolRounds: 0,
    },
  });

  assert.equal(result.answer, "direct answer after tool limit");
  assert.equal(result.metadata.modelCalls, 2);
  assert.ok(result.metadata.errors.some((error) => error.includes("tool round limit reached")));
  assert.equal(model.calls[1]?.options.tools?.length, 0);
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

test("agent router selects research for source-backed prompts", () => {
  const registry = createAgentRegistry({
    defaultTools: [new EchoTool()],
    researchTools: [],
  });

  assert.equal(selectAgent(registry, "Research the latest TypeScript release").id, "research");
  assert.equal(selectAgent(registry, "Implement a parser fix and add tests").id, "coding");
  assert.equal(selectAgent(registry, "Design the onboarding UX flow").id, "product_designer");
  assert.equal(selectAgent(registry, "Validate the release workflow").id, "qa");
  assert.equal(selectAgent(registry, "Explain recursion").id, "default");
  assert.equal(selectAgent(registry, "Explain recursion", "research").id, "research");
  assert.equal(selectAgent(registry, "Explain recursion", "coding").id, "coding");
  assert.equal(selectAgent(registry, "Explain recursion", "qa").id, "qa");
  assert.equal(selectAgent(registry, "Explain recursion", "product_designer").id, "product_designer");
});

test("agent profiles expose scoped tool sets", () => {
  const shellTool = new EchoTool();
  const writeTool = new EchoTool();
  const searchTool = new EchoTool();
  const webFetchTool = new EchoTool();
  Object.defineProperty(shellTool, "name", { value: "shell" });
  Object.defineProperty(writeTool, "name", { value: "write_file" });
  Object.defineProperty(searchTool, "name", { value: "web_search" });
  Object.defineProperty(webFetchTool, "name", { value: "web_fetch" });
  const registry = createAgentRegistry({
    defaultTools: [shellTool, writeTool, searchTool, webFetchTool],
    researchTools: [searchTool, webFetchTool],
    codingTools: [shellTool, writeTool, searchTool, webFetchTool],
    productDesignerTools: [searchTool, webFetchTool, writeTool],
  });

  assert.deepEqual(selectAgent(registry, "Fix the CLI", "coding").tools.map((tool) => tool.name), [
    "shell",
    "write_file",
    "web_search",
    "web_fetch",
  ]);
  assert.deepEqual(selectAgent(registry, "Design a settings page", "product_designer").tools.map((tool) => tool.name), [
    "web_search",
    "web_fetch",
    "write_file",
  ]);
  assert.deepEqual(selectAgent(registry, "Research docs", "research").tools.map((tool) => tool.name), [
    "web_search",
    "web_fetch",
  ]);
});

test("bugfix queue skips duplicate highest-priority keywords", () => {
  const queue = buildBugfixQueue({
    id: "bugfix",
    priority: 100,
    highestPriorityKeywords: ["fail", "error", "regression"],
  }, [
    "BUGFIX[fail, build]: Fix failing build command.",
    "BUGFIX[fail, test]: Fix duplicate failing test report.",
    "BUGFIX[regression]: Restore changed CLI output.",
    "BUGFIX: Investigate broken renderer error handling.",
  ].join("\n"), "qa");

  assert.equal(queue.id, "bugfix");
  assert.equal(queue.priority, 100);
  assert.deepEqual(queue.items.map((item) => item.task), [
    "Fix failing build command.",
    "Restore changed CLI output.",
    "Investigate broken renderer error handling.",
  ]);
  assert.deepEqual(queue.items.map((item) => item.keywords), [
    ["fail", "build"],
    ["regression"],
    ["error"],
  ]);
});

test("workflow runs QA validation and exposes bugfix tasks in a higher-priority queue", async () => {
  const tool = new EchoTool();
  const agentModels = {
    depth: "small",
    classify: "small",
    decompose: "small",
    answer: "small",
    summarize: "small",
    synthesize: "small",
  };
  const projectConfig = {
    models: {
      default: "small-model",
      rotation: {
        enabled: false,
        sampleRate: 0,
        scorePath: "rlm.model-scores.yaml",
      },
      tiers: {
        small: {
          name: "small-model",
          estimatedRamMb: 512,
        },
      },
    },
    memory: {
      maxRamMb: 2048,
      reserveSystemRamMb: 0,
      waitForCapacity: false,
      capacityCheckIntervalMs: 1,
    },
    runtime: config,
    agents: {
      default: {
        tools: ["echo"],
        models: agentModels,
      },
      coding: {
        tools: ["echo"],
        models: agentModels,
      },
      qa: {
        tools: ["echo"],
        models: agentModels,
      },
      product_designer: {
        tools: ["echo"],
        models: agentModels,
      },
      research: {
        tools: ["echo"],
        models: agentModels,
      },
    },
    workflows: {
      default: {
        mode: "ram_queue" as const,
        agents: ["coding"],
        continueOnError: false,
        qa: {
          agent: "qa",
          validationCommands: ["npm test", "npm run build"],
          bugfixQueue: {
            id: "bugfix",
            priority: 100,
            highestPriorityKeywords: ["fail", "error"],
          },
        },
      },
    },
  };
  const registry = createAgentRegistry({
    defaultTools: [tool],
    codingTools: [tool],
    qaTools: [tool],
    productDesignerTools: [tool],
    researchTools: [tool],
    agentConfigs: projectConfig.agents,
  });
  const responses = [
    "Implementation complete.",
    "BUGFIX[error]: Fix build error reported by validation.\nBUGFIX[error]: Duplicate error should not be queued.",
  ];
  const logger = new CaptureLogger();

  const result = await runWorkflow({
    workflowId: "default",
    prompt: "Implement the parser change",
    config: {
      ...config,
      maxDepth: 0,
    },
    projectConfig,
    registry,
    memoryManager: new MemoryManager({
      config: projectConfig.memory,
    }),
    createModel: () => new QueueModel([responses.shift() ?? "ok"]),
    logger,
    runValidationCommand: async (command) => ({
      command,
      status: command === "npm test" ? "success" : "error",
      output: command === "npm test" ? "tests passed" : "build failed",
    }),
  });

  assert.deepEqual(result.metadata.workflow?.agents, ["coding", "qa"]);
  assert.deepEqual(result.metadata.workflow?.qa?.validationCommands.map((item) => item.command), ["npm test", "npm run build"]);
  assert.equal(result.metadata.workflowQueues?.[0]?.id, "bugfix");
  assert.equal(result.metadata.workflowQueues?.[0]?.priority, 100);
  assert.deepEqual(result.metadata.workflowQueues?.[0]?.items.map((item) => item.task), [
    "Fix build error reported by validation.",
  ]);
  assert.ok(logger.events.some((event) => event.stage === "workflow" && event.message === "starting workflow"));
  assert.ok(logger.events.some((event) => event.stage === "workflow" && event.message === "workflow agent completed"));
  assert.ok(logger.events.some((event) => event.stage === "validation" && event.message === "starting validation command"));
  assert.ok(logger.events.some((event) => event.stage === "validation" && event.message === "completed validation command"));
});

test("workflow dispatch tiers run minimal agents for simple prompts", async () => {
  const tool = new EchoTool();
  const agentModels = {
    depth: "small",
    classify: "small",
    decompose: "small",
    answer: "small",
    summarize: "small",
    synthesize: "small",
  };
  const projectConfig = {
    models: {
      default: "small-model",
      rotation: {
        enabled: false,
        sampleRate: 0,
        scorePath: "rlm.model-scores.yaml",
      },
      tiers: {
        small: {
          name: "small-model",
          estimatedRamMb: 512,
        },
      },
    },
    memory: {
      maxRamMb: 2048,
      reserveSystemRamMb: 0,
      waitForCapacity: false,
      capacityCheckIntervalMs: 1,
    },
    runtime: config,
    agents: {
      default: {
        tools: ["echo"],
        models: agentModels,
      },
      coding: {
        tools: ["echo"],
        models: agentModels,
      },
      qa: {
        tools: ["echo"],
        models: agentModels,
      },
      product_designer: {
        tools: ["echo"],
        models: agentModels,
      },
      research: {
        tools: ["echo"],
        models: agentModels,
      },
    },
    workflows: {
      default: {
        mode: "ram_queue" as const,
        agents: ["research", "product_designer", "coding"],
        continueOnError: false,
        dispatch: {
          strategy: "complexity_tiers" as const,
          tiers: [
            {
              name: "simple",
              maxEstimatedDepth: 1,
              agents: ["coding"],
              qa: false,
            },
            {
              name: "complex",
              agents: ["research", "product_designer", "coding"],
              qa: true,
            },
          ],
        },
        qa: {
          agent: "qa",
          validationCommands: [],
          bugfixQueue: {
            id: "bugfix",
            priority: 100,
            highestPriorityKeywords: ["fail", "error"],
          },
        },
      },
    },
  };
  const registry = createAgentRegistry({
    defaultTools: [tool],
    codingTools: [tool],
    qaTools: [tool],
    productDesignerTools: [tool],
    researchTools: [tool],
    agentConfigs: projectConfig.agents,
  });

  const result = await runWorkflow({
    workflowId: "default",
    prompt: "Fix typo",
    config: {
      ...config,
      maxDepth: 0,
    },
    projectConfig,
    registry,
    memoryManager: new MemoryManager({
      config: projectConfig.memory,
    }),
    createModel: () => new QueueModel(["Implementation complete."]),
  });

  assert.deepEqual(result.metadata.workflow?.agents, ["coding"]);
  assert.equal(result.metadata.workflow?.qa, undefined);
  assert.equal(result.metadata.modelCalls, 1);
});

test("workflow dispatch tiers run complex agent sets and QA for complex prompts", async () => {
  const tool = new EchoTool();
  const agentModels = {
    depth: "small",
    classify: "small",
    decompose: "small",
    answer: "small",
    summarize: "small",
    synthesize: "small",
  };
  const projectConfig = {
    models: {
      default: "small-model",
      rotation: {
        enabled: false,
        sampleRate: 0,
        scorePath: "rlm.model-scores.yaml",
      },
      tiers: {
        small: {
          name: "small-model",
          estimatedRamMb: 512,
        },
      },
    },
    memory: {
      maxRamMb: 4096,
      reserveSystemRamMb: 0,
      waitForCapacity: false,
      capacityCheckIntervalMs: 1,
    },
    runtime: config,
    agents: {
      default: {
        tools: ["echo"],
        models: agentModels,
      },
      coding: {
        tools: ["echo"],
        models: agentModels,
      },
      qa: {
        tools: ["echo"],
        models: agentModels,
      },
      product_designer: {
        tools: ["echo"],
        models: agentModels,
      },
      research: {
        tools: ["echo"],
        models: agentModels,
      },
    },
    workflows: {
      default: {
        mode: "ram_queue" as const,
        agents: ["coding"],
        continueOnError: false,
        dispatch: {
          strategy: "complexity_tiers" as const,
          tiers: [
            {
              name: "simple",
              maxEstimatedDepth: 1,
              agents: ["coding"],
              qa: false,
            },
            {
              name: "complex",
              agents: ["research", "product_designer", "coding"],
              qa: true,
            },
          ],
        },
        qa: {
          agent: "qa",
          validationCommands: [],
          bugfixQueue: {
            id: "bugfix",
            priority: 100,
            highestPriorityKeywords: ["fail", "error"],
          },
        },
      },
    },
  };
  const registry = createAgentRegistry({
    defaultTools: [tool],
    codingTools: [tool],
    qaTools: [tool],
    productDesignerTools: [tool],
    researchTools: [tool],
    agentConfigs: projectConfig.agents,
  });

  const result = await runWorkflow({
    workflowId: "default",
    prompt: "Design the architecture for a multi-agent workflow system",
    config: {
      ...config,
      maxDepth: 0,
    },
    projectConfig,
    registry,
    memoryManager: new MemoryManager({
      config: projectConfig.memory,
    }),
    createModel: () => new QueueModel(["ok"]),
  });

  assert.deepEqual(result.metadata.workflow?.agents, ["research", "product_designer", "coding", "qa"]);
  assert.equal(result.metadata.workflow?.qa?.agent, "qa");
  assert.equal(result.metadata.modelCalls, 4);
});

test("search query builder applies search operators", () => {
  const query = buildSearchQuery({
    terms: ["recursive language model"],
    exactPhrases: ["tool calling"],
    requiredTerms: ["benchmark"],
    excludedTerms: ["reddit"],
    siteFilters: ["arxiv.org"],
    fileType: "pdf",
    after: "2025-01-01",
    before: "2026-01-01",
  });

  assert.equal(
    query,
    'recursive language model "tool calling" +benchmark -reddit site:arxiv.org filetype:pdf after:2025-01-01 before:2026-01-01',
  );
});

test("parseUddgLines extracts title, link, and optional snippet", () => {
  const htmlLine =
    `<a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdocs">Official docs</a>`;
  assert.deepEqual(parseUddgLines(htmlLine), [{
    title: "Official docs",
    link: "https://example.com/docs",
    snippet: "",
  }]);
});

test("web_search returns error when provider serves an interactive challenge", async () => {
  const tool = new WebSearchTool({
    runCurl: async () =>
      "<html><div class=\"anomaly-modal__title\">blocked</div></html>",
  });

  const result = await tool.execute({
    terms: ["test"],
  });

  assert.equal(result.status, "error");
  assert.match(result.output, /interactive challenge|automated access blocked/i);
});

test("web_search parses DuckDuckGo-style redirect HTML", async () => {
  let requestedUrl = "";
  const fixture = `<!DOCTYPE html><html><body>
<a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdocs">Official docs</a>
</body></html>`;

  const tool = new WebSearchTool({
    runCurl: async (url) => {
      requestedUrl = url;
      return fixture;
    },
  });

  const result = await tool.execute({
    exactPhrases: ["tool calling"],
    siteFilters: ["example.com"],
  });

  assert.equal(result.status, "success");
  const u = new URL(requestedUrl);
  assert.equal(u.searchParams.get("q"), '"tool calling" site:example.com');
  const output = JSON.parse(result.output);
  assert.equal(output.query, '"tool calling" site:example.com');
  assert.deepEqual(output.results, [
    {
      position: 1,
      title: "Official docs",
      link: "https://example.com/docs",
      snippet: "",
    },
  ]);
});

test("content analysis strips html and fluff words into scored sections", () => {
  const html = `
    <html>
      <head><title>The Best Guide to Tool Calling</title><style>.x{}</style></head>
      <body>
        <h1>Tool Calling Architecture</h1>
        <p>This is the best practical guide for model tool calling systems.</p>
        <h2>Unrelated Notes</h2>
        <p>The weather and office lunch are not important.</p>
        <script>alert("ignore")</script>
      </body>
    </html>
  `;

  assert.equal(stripHtmlTags("<p>The useful text</p>"), "The useful text");
  assert.equal(stripFluffWords("The useful text is in the guide"), "useful text guide");
  const analysis = analyzeHtmlContent(html, "tool calling architecture", 1);

  assert.equal(analysis.title, "best guide tool calling");
  assert.equal(analysis.selected[0]?.title, "tool calling architecture");
  assert.match(analysis.selected[0]?.text ?? "", /practical guide model tool calling systems/);
});

test("web fetch tool returns selected content tree sections", async () => {
  const tool = new WebFetchTool({
    fetchFn: async () => new Response(`
      <html>
        <head><title>Docs</title></head>
        <body>
          <h1>Install Tool Calling</h1>
          <p>Use bind tools with structured schemas for model calls.</p>
          <h1>Other</h1>
          <p>General unrelated content.</p>
        </body>
      </html>
    `, {
      status: 200,
      headers: {
        "content-type": "text/html",
      },
    }),
  });

  const result = await tool.execute({
    url: "https://example.com/docs",
    query: "tool calling schemas",
    maxSections: 1,
  });

  assert.equal(result.status, "success");
  const output = JSON.parse(result.output);
  assert.equal(output.url, "https://example.com/docs");
  assert.equal(output.selected.length, 1);
  assert.equal(output.selected[0].title, "install tool calling");
});

test("loads yaml project config from an explicit path", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "rlm-config-"));
  try {
    const configPath = join(workspace, "rlm.config.yaml");
    await writeFile(configPath, `
models:
  default: small-model
  tiers:
    small:
      name: small-model
      estimatedRamMb: 512
memory:
  maxRamMb: 1024
  reserveSystemRamMb: 128
  waitForCapacity: false
  capacityCheckIntervalMs: 1
runtime:
  maxDynamicDepth: 2
  maxBranches: 5
  maxPromptCharacters: 3000
  maxModelCalls: 9
  maxToolRounds: 1
agents:
  default:
    tools: [shell]
    models:
      depth: small
      classify: small
      decompose: small
      answer: dynamic
      summarize: small
      synthesize: small
  coding:
    tools: [shell]
    models:
      depth: small
      classify: small
      decompose: small
      answer: dynamic
      summarize: small
      synthesize: small
  product_designer:
    tools: [write_file]
    models:
      depth: small
      classify: small
      decompose: small
      answer: dynamic
      summarize: small
      synthesize: small
  research:
    tools: [web_search]
    models:
      depth: small
      classify: small
      decompose: small
      answer: dynamic
      summarize: small
      synthesize: small
workflows:
  default:
    mode: ram_queue
    agents: [research, coding]
    continueOnError: true
`, "utf8");

    const loaded = await loadProjectConfig(configPath);

    assert.equal(loaded.path, configPath);
    assert.equal(loaded.config.models.default, "small-model");
    assert.equal(loaded.config.runtime.maxModelCalls, 9);
    assert.equal(loaded.config.runtime.maxBranches, 5);
    assert.deepEqual(loaded.config.workflows["default"]?.agents, ["research", "coding"]);
    assert.deepEqual(resolveRuntimeConfig(loaded.config, { maxModelCalls: 3 }), {
      maxDynamicDepth: 2,
      maxBranches: 5,
      maxPromptCharacters: 3000,
      maxModelCalls: 3,
      maxToolRounds: 1,
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("purpose routing model selects per-purpose and dynamic tiers", async () => {
  const calls: string[] = [];
  const model = new PurposeRoutingLanguageModel({
    config: {
      models: {
        default: "small-model",
        rotation: {
          enabled: false,
          sampleRate: 0,
          scorePath: "rlm.model-scores.yaml",
        },
        tiers: {
          small: {
            name: "small-model",
            estimatedRamMb: 512,
          },
          medium: {
            name: "medium-model",
            estimatedRamMb: 1024,
          },
          large: {
            name: "large-model",
            estimatedRamMb: 2048,
          },
        },
      },
      memory: {
        maxRamMb: 4096,
        reserveSystemRamMb: 0,
        waitForCapacity: false,
        capacityCheckIntervalMs: 1,
      },
      runtime: config,
      agents: {},
      workflows: {},
    },
    agent: {
      tools: [],
      models: {
        depth: "small",
        classify: "small",
        decompose: "medium",
        answer: "dynamic",
        summarize: "small",
        synthesize: "medium",
      },
    },
    createModel: (name) => new QueueModel([`${name} response`]),
    recordSelection: (selection) => calls.push(`${selection.purpose}:${selection.model}`),
  });

  assert.equal(selectDynamicTier(1), "small");
  assert.equal(selectDynamicTier(2), "medium");
  assert.equal(selectDynamicTier(3), "large");
  assert.equal((await model.complete([], { purpose: "answer", complexityDepth: 3 })).content, "large-model response");
  assert.equal((await model.complete([], { purpose: "decompose", complexityDepth: 1 })).content, "medium-model response");
  assert.deepEqual(calls, ["answer:large-model", "decompose:medium-model"]);
});

test("purpose routing occasionally selects use-case alternates and records yaml scores", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "rlm-model-scores-"));
  try {
    const selections: string[] = [];
    const createdModels = new Map<string, QueueModel>();
    const model = new PurposeRoutingLanguageModel({
      config: {
        models: {
          default: "small-model",
          rotation: {
            enabled: true,
            sampleRate: 1,
            scorePath: "rlm.model-scores.yaml",
          },
          tiers: {
            small: {
              name: "small-model",
              estimatedRamMb: 512,
              alternateModels: [
                {
                  name: "small-alt-model",
                  useCases: ["answer"],
                },
                {
                  name: "classify-alt-model",
                  useCases: ["classify"],
                },
              ],
            },
            large: {
              name: "large-judge-model",
              estimatedRamMb: 2048,
            },
          },
        },
        memory: {
          maxRamMb: 4096,
          reserveSystemRamMb: 0,
          waitForCapacity: false,
          capacityCheckIntervalMs: 1,
        },
        runtime: config,
        agents: {},
        workflows: {},
      },
      agent: {
        tools: [],
        models: {
          depth: "small",
          classify: "small",
          decompose: "small",
          answer: "small",
          summarize: "small",
          synthesize: "small",
        },
      },
      createModel: (name) => {
        const responses = name === "large-judge-model"
          ? ["score: 4.5\nreason: useful alternate answer"]
          : [`${name} response`];
        const created = new QueueModel(responses);
        createdModels.set(name, created);
        return created;
      },
      scoreStore: createYamlModelScoreStore(workspace, "rlm.model-scores.yaml"),
      random: () => 0,
      recordSelection: (selection) => selections.push(`${selection.purpose}:${selection.model}:${selection.source}:${selection.evaluatorModel ?? ""}`),
    });

    const response = await model.complete([
      {
        role: "user",
        content: "answer this",
      },
    ], {
      purpose: "answer",
      complexityDepth: 1,
    });

    assert.equal(response.content, "small-alt-model response");
    assert.deepEqual(selections, ["answer:small-alt-model:rotation:large-judge-model"]);
    assert.equal(createdModels.get("small-model"), undefined);
    assert.equal(createdModels.get("large-judge-model")?.calls.length, 1);
    const scoreFile = await readFile(join(workspace, "rlm.model-scores.yaml"), "utf8");
    assert.match(scoreFile, /small-alt-model/);
    assert.match(scoreFile, /averageScore: 4\.5/);
    assert.match(scoreFile, /useful alternate answer/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("memory manager reserves, releases, and rejects over-capacity requests", async () => {
  const manager = new MemoryManager({
    config: {
      maxRamMb: 1024,
      reserveSystemRamMb: 0,
      waitForCapacity: false,
      capacityCheckIntervalMs: 1,
    },
    freememBytes: () => 2048 * 1024 * 1024,
    totalmemBytes: () => 4096 * 1024 * 1024,
  });

  const reservation = await manager.reserve(512);
  assert.equal(manager.snapshot().reservedRamMb, 512);
  await assert.rejects(() => manager.reserve(600), /Insufficient RAM/);
  reservation.release();
  assert.equal(manager.snapshot().reservedRamMb, 0);
});

test("renders compact output for subprocess use", () => {
  const output = renderResult(
    {
      answer: "Hello\nworld",
      metadata: {
        agent: {
          id: "default",
          source: "auto",
        },
        depth: {
          selected: 2,
          source: "override",
        },
        modelSelections: [],
        memoryReservations: [],
        modelCalls: 1,
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          unknownCompletions: 0,
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
        agent: {
          id: "research",
          source: "auto",
        },
        depth: {
          selected: 1,
          source: "model",
        },
        modelSelections: [],
        memoryReservations: [],
        modelCalls: 1,
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          unknownCompletions: 0,
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
    agent: {
      id: "research",
      source: "auto",
    },
    depth: {
      selected: 1,
      source: "model",
    },
    modelSelections: [],
    memoryReservations: [],
    modelCalls: 1,
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      unknownCompletions: 0,
    },
    trace: [],
    toolCalls: [],
    errors: [],
  });
});
