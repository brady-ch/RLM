import assert from "node:assert/strict";
import test from "node:test";
import { createAgentRegistry, resolveAgent } from "../../../src/application/agent-registry.js";
import { createInteractiveExecutionSession } from "../../../src/application/execution-controller.js";
import {
  buildExecutionPrompt,
  executeGraph,
  GraphExecutorError,
  topologicalExecutionOrder,
} from "../../../src/application/graph-executor.js";
import { MemoryManager } from "../../../src/application/memory-manager.js";
import {
  loadProjectConfig,
  resolveRuntimeConfig,
} from "../../../src/application/project-config.js";
import type { ExecutionGraph, ExecutionGraphNode } from "../../../src/domain/types.js";
import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelResponse,
} from "../../../src/ports/language-model-port.js";
import type { ToolPort } from "../../../src/ports/tool-port.js";

class CountingModel implements LanguageModelPort {
  completeCount = 0;

  async complete(
    _messages: LanguageModelMessage[],
    _options: LanguageModelCompleteOptions = {},
  ): Promise<LanguageModelResponse> {
    this.completeCount += 1;
    return { content: "done", toolCalls: [], model: "counting-model" };
  }
}

function makeNode(
  partial: Partial<ExecutionGraphNode> & Pick<ExecutionGraphNode, "id">,
): ExecutionGraphNode {
  return {
    kind: "task",
    label: partial.label ?? partial.id,
    depth: partial.depth ?? 0,
    status: partial.status ?? "ready",
    ...partial,
  };
}

function buildGraph(
  nodes: ExecutionGraphNode[],
  edges: ExecutionGraph["edges"] = [],
): ExecutionGraph {
  return { nodes, edges };
}

async function createExecutorInput(model: LanguageModelPort) {
  const loaded = await loadProjectConfig("rlm.config.yaml");
  const projectConfig = loaded.config;
  const runtimeConfig = resolveRuntimeConfig(projectConfig);
  const registry = createAgentRegistry({
    defaultTools: [],
    researchTools: [],
    agentConfigs: projectConfig.agents,
  });
  const memoryManager = new MemoryManager({ config: projectConfig.memory });
  return {
    projectConfig,
    runtimeConfig,
    registry,
    agentSource: "auto" as const,
    memoryManager,
    createModel: () => model,
  };
}

function registerChain(
  session: ReturnType<typeof createInteractiveExecutionSession>,
  expertRuntime: "single-pass" | "rlm" | undefined,
): void {
  session.control.registerNode?.(
    makeNode({
      id: "root",
      label: "Root",
      prompt: "Root task",
      depth: 0,
      status: "ready",
      expertAgentId: "default",
      expertRuntime,
    }),
  );
  session.control.registerNode?.(
    makeNode({
      id: "child-1",
      parentId: "root",
      label: "Child 1",
      prompt: "Child task",
      depth: 1,
      status: "ready",
      expertAgentId: "default",
      expertRuntime,
    }),
  );
}

test("topologicalExecutionOrder returns parent-before-child order", () => {
  const graph = buildGraph(
    [
      makeNode({ id: "root", depth: 0 }),
      makeNode({ id: "A", parentId: "root", depth: 1 }),
      makeNode({ id: "B", parentId: "A", depth: 2 }),
    ],
    [
      { from: "root", to: "A" },
      { from: "A", to: "B" },
    ],
  );

  assert.deepEqual(topologicalExecutionOrder(graph), ["root", "A", "B"]);
});

test("topologicalExecutionOrder throws when cycle detected", () => {
  const graph = buildGraph(
    [
      makeNode({ id: "A", depth: 0 }),
      makeNode({ id: "B", parentId: "A", depth: 1 }),
      makeNode({ id: "C", parentId: "B", depth: 2 }),
    ],
    [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
      { from: "C", to: "A" },
    ],
  );

  assert.throws(
    () => topologicalExecutionOrder(graph),
    (error: unknown) => error instanceof GraphExecutorError && error.code === "cycle_detected",
  );
});

test("resolveAgent throws for unknown id", async () => {
  const loaded = await loadProjectConfig("rlm.config.yaml");
  const registry = createAgentRegistry({
    defaultTools: [],
    researchTools: [],
    agentConfigs: loaded.config.agents,
  });

  assert.throws(() => resolveAgent(registry, "nonexistent"), /Unknown agent "nonexistent"/);
});

test("buildExecutionPrompt prefixes ancestor context", () => {
  const root = makeNode({ id: "root", label: "Root", prompt: "Root prompt" });
  const child = makeNode({ id: "child", label: "Child", prompt: "Child prompt" });

  const prompt = buildExecutionPrompt(child, [root]);
  assert.match(prompt, /Context from ancestor steps:/);
  assert.match(prompt, /1\. Root: Root prompt/);
  assert.match(prompt, /Current task:\nChild prompt/);
});

test("executeGraph completes single-pass node with status transitions", async () => {
  const model = new CountingModel();
  const input = await createExecutorInput(model);
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  registerChain(session, "single-pass");
  session.beginConfirmedExecution();

  await executeGraph(session, input);

  const nodes = session.snapshot().graph.nodes;
  assert.equal(nodes.find((node) => node.id === "root")?.status, "completed");
  assert.equal(nodes.find((node) => node.id === "child-1")?.status, "completed");
  assert.ok(model.completeCount >= 2);
});

test("executeGraph marks invalid expertAgentId as failed", async () => {
  const model = new CountingModel();
  const input = await createExecutorInput(model);
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  session.control.registerNode?.(
    makeNode({
      id: "bad-agent",
      label: "Bad agent",
      prompt: "Task",
      depth: 0,
      status: "ready",
      expertAgentId: "missing-agent",
      expertRuntime: "single-pass",
    }),
  );
  session.beginConfirmedExecution();

  await executeGraph(session, input);

  const node = session.snapshot().graph.nodes.find((entry) => entry.id === "bad-agent");
  assert.equal(node?.status, "failed");
  assert.equal(model.completeCount, 0);
});

test("executeGraph blocks child when parent fails", async () => {
  const model = new CountingModel();
  const input = await createExecutorInput(model);
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  session.control.registerNode?.(
    makeNode({
      id: "root",
      label: "Root",
      prompt: "Root",
      depth: 0,
      status: "ready",
      expertAgentId: "missing-agent",
      expertRuntime: "single-pass",
    }),
  );
  session.control.registerNode?.(
    makeNode({
      id: "child",
      parentId: "root",
      label: "Child",
      prompt: "Child",
      depth: 1,
      status: "ready",
      expertAgentId: "default",
      expertRuntime: "single-pass",
    }),
  );
  session.beginConfirmedExecution();

  await executeGraph(session, input);

  const snapshot = session.snapshot().graph.nodes;
  assert.equal(snapshot.find((node) => node.id === "root")?.status, "failed");
  assert.equal(snapshot.find((node) => node.id === "child")?.status, "failed");
  assert.equal(model.completeCount, 0);
});

test("executeGraph fails node with undefined expertRuntime without invoking model", async () => {
  const model = new CountingModel();
  const input = await createExecutorInput(model);
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  session.control.registerNode?.(
    makeNode({
      id: "no-runtime",
      label: "No runtime",
      prompt: "Task",
      depth: 0,
      status: "ready",
      expertAgentId: "default",
    }),
  );
  session.beginConfirmedExecution();

  await executeGraph(session, input);

  const node = session.snapshot().graph.nodes.find((entry) => entry.id === "no-runtime");
  assert.equal(node?.status, "failed");
  assert.equal(model.completeCount, 0);
});

test("executeGraph filters tools via expertToolAllowlist for single-pass", async () => {
  const shellTool: ToolPort = {
    name: "shell",
    description: "shell",
    schema: {},
    execute: async () => ({ status: "success", output: "ok" }),
  };
  const fileTool: ToolPort = {
    name: "write_file",
    description: "write",
    schema: {},
    execute: async () => ({ status: "success", output: "ok" }),
  };
  const loaded = await loadProjectConfig("rlm.config.yaml");
  const projectConfig = loaded.config;
  const runtimeConfig = resolveRuntimeConfig(projectConfig);
  const registry = createAgentRegistry({
    defaultTools: [shellTool, fileTool],
    researchTools: [],
    agentConfigs: projectConfig.agents,
  });
  const memoryManager = new MemoryManager({ config: projectConfig.memory });
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  session.control.registerNode?.(
    makeNode({
      id: "allowlisted",
      label: "Allowlisted",
      prompt: "Task",
      depth: 0,
      status: "ready",
      expertAgentId: "default",
      expertRuntime: "single-pass",
      expertToolAllowlist: ["shell"],
    }),
  );
  session.beginConfirmedExecution();

  await executeGraph(session, {
    projectConfig,
    runtimeConfig,
    registry,
    agentSource: "auto",
    memoryManager,
    createModel: () => new CountingModel(),
  });

  assert.equal(
    session.snapshot().graph.nodes.find((node) => node.id === "allowlisted")?.status,
    "completed",
  );
});
