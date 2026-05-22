import assert from "node:assert/strict";
import test from "node:test";
import { loadProjectConfig } from "../src/application/project-config.js";
import { GraphPlannerError, planChildren } from "../src/application/graph-planner.js";
import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelResponse,
} from "../src/ports/language-model-port.js";

class CapturePlanModel implements LanguageModelPort {
  readonly calls: Array<{ messages: LanguageModelMessage[]; options: LanguageModelCompleteOptions }> = [];

  constructor(private readonly response: string | Error) {}

  async complete(messages: LanguageModelMessage[], options: LanguageModelCompleteOptions = {}): Promise<LanguageModelResponse> {
    this.calls.push({ messages, options });
    if (this.response instanceof Error) {
      throw this.response;
    }
    return { content: this.response, toolCalls: [], model: "planner-test" };
  }
}

test("project config accepts plan purpose model routing", async () => {
  const loaded = await loadProjectConfig("rlm.config.yaml");

  assert.equal(loaded.config.agents.default?.models.plan, "medium");
});

test("planChildren validates structured child output", async () => {
  const model = new CapturePlanModel(JSON.stringify({
    children: [
      { label: "Design API", prompt: "Design the planner API.", type: "AI", complexity: "medium" },
      { label: "Validate", prompt: "Validate planner results.", type: "Validator", complexity: "low" },
    ],
  }));

  const result = await planChildren(model, {
    nodeId: "node-1",
    nodeLabel: "Root",
    nodePrompt: "Build graph planning",
    ancestors: [],
    maxChildren: 5,
  });

  assert.equal(result.children.length, 2);
  assert.equal(result.children[0]?.label, "Design API");
  assert.equal(result.diagnostics.purpose, "plan");
  assert.equal(result.diagnostics.model, "planner-test");
  assert.equal(model.calls[0]?.options.purpose, "plan");
});

test("planChildren rejects invalid JSON with typed error", async () => {
  const model = new CapturePlanModel("{not json}");

  await assert.rejects(
    () => planChildren(model, {
      nodeId: "node-1",
      nodeLabel: "Root",
      nodePrompt: "Build graph planning",
      ancestors: [],
      maxChildren: 5,
    }),
    (error: unknown) => error instanceof GraphPlannerError && error.code === "invalid_planner_output",
  );
});

test("planChildren maps model failure to planning_failed", async () => {
  const model = new CapturePlanModel(new Error("offline"));

  await assert.rejects(
    () => planChildren(model, {
      nodeId: "node-1",
      nodeLabel: "Root",
      nodePrompt: "Build graph planning",
      ancestors: [],
      maxChildren: 5,
    }),
    (error: unknown) => error instanceof GraphPlannerError && error.code === "planning_failed",
  );
});

test("planChildren includes ancestor context in model messages", async () => {
  const model = new CapturePlanModel(JSON.stringify({
    children: [
      { label: "Child", prompt: "Plan child.", type: "AI", complexity: "low" },
    ],
  }));

  await planChildren(model, {
    nodeId: "child-1",
    nodeLabel: "Child",
    nodePrompt: "Plan this subtree",
    ancestors: [
      { id: "root", label: "Root Composer", prompt: "Build audiobook workflow" },
      { id: "branch", label: "Speaker Plan", prompt: "Interpret speakers" },
    ],
    maxChildren: 3,
  });

  const content = model.calls.flatMap((call) => call.messages.map((message) => message.content)).join("\n");
  assert.match(content, /Root Composer/);
  assert.match(content, /Speaker Plan/);
});
