import assert from "node:assert/strict";
import test from "node:test";
import { buildLiveExecutionMetadata } from "../../../src/domain/recursion/execution-graph-sync.js";
import type { ExecutionGraphNode, RecursiveModelConfig } from "../../../src/domain/types.js";

test("buildLiveExecutionMetadata mirrors nodes and summarizes budget snapshots", () => {
  const node: ExecutionGraphNode = {
    id: "n1",
    kind: "task",
    label: "root",
    depth: 0,
    status: "running",
  };

  const map = new Map<string, ExecutionGraphNode>();
  map.set(node.id, node);

  const cfg: RecursiveModelConfig = {
    maxDepth: 2,
    maxDynamicDepth: 4,
    maxBranches: 2,
    maxPromptCharacters: 1_000,
    maxModelCalls: 10,
    maxToolRounds: 4,
  };

  const meta = buildLiveExecutionMetadata({
    executionNodes: map,
    executionEdges: [],
    modelCalls: 2,
    maxModelCalls: 10,
    toolCallsLength: 1,
    toolRoundLimit: 4,
    config: cfg,
  });

  assert.equal(meta.executionGraph?.nodes.length, 1);
  assert.ok(meta.executionGraph?.nodes.some((entry) => entry.id === "n1"));
  assert.ok(meta.budget?.estimatedModelCalls !== undefined);
  assert.equal(meta.budget?.modelCallsUsed, 2);
  assert.equal(meta.budget?.modelCallsRemaining, 8);
});
