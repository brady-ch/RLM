import assert from "node:assert/strict";
import test from "node:test";
import {
  canSpendAnyModelCall,
  estimateModelCalls,
  estimateToolRounds,
  hasCallReservedForDirectAnswer,
  maxToolRoundsFromLimit,
  remainingModelCalls,
} from "../../../src/domain/recursion/budget-guard.js";
import type { RecursiveModelConfig } from "../../../src/domain/types.js";

function baseEstimateConfig(overrides: Partial<RecursiveModelConfig>): RecursiveModelConfig {
  return {
    maxDynamicDepth: 0,
    maxBranches: 4,
    maxPromptCharacters: 4096,
    maxModelCalls: 10_000,
    maxToolRounds: 0,
    ...overrides,
  };
}

test("remainingModelCalls and spend gate match total budget semantics", () => {
  assert.equal(remainingModelCalls(2, 5), 3);
  assert.equal(canSpendAnyModelCall(4, 5), true);
  assert.equal(canSpendAnyModelCall(5, 5), false);
});

test("maxToolRoundsFromLimit clamps at zero", () => {
  assert.equal(maxToolRoundsFromLimit(3), 3);
  assert.equal(maxToolRoundsFromLimit(-1), 0);
});

test("hasCallReservedForDirectAnswer requires headroom beyond final call", () => {
  assert.equal(hasCallReservedForDirectAnswer(0, 100), true);
  assert.equal(hasCallReservedForDirectAnswer(98, 100), true);
  assert.equal(hasCallReservedForDirectAnswer(99, 100), false);
});

test("estimateModelCalls derives upper bound from depth and branching", () => {
  assert.equal(
    estimateModelCalls(baseEstimateConfig({ maxDepth: 0, maxBranches: 4, maxModelCalls: 50 }), 0),
    5,
  );
  const bounded = estimateModelCalls(
    baseEstimateConfig({ maxDepth: 4, maxBranches: 10, maxModelCalls: 10_000 }),
    0,
  );
  assert.ok(bounded <= 10_000);
});

test("estimateToolRounds prefers config.maxToolRounds when present", () => {
  assert.equal(estimateToolRounds(2, undefined), 2);
  assert.equal(estimateToolRounds(99, baseEstimateConfig({ maxToolRounds: 3 })), 3);
});
