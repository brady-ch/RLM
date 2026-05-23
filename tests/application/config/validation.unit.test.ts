import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PROJECT_CONFIG } from "../../../src/application/config/defaults.js";
import { validateMemoryBudget } from "../../../src/application/config/validation.js";

test("validateMemoryBudget accepts tiers within cap", () => {
  const config = structuredClone(DEFAULT_PROJECT_CONFIG);
  config.memory.maxRamMb = 8192;
  assert.doesNotThrow(() => validateMemoryBudget(config));
});

test("validateMemoryBudget rejects tier estimate above maxRamMb", () => {
  const config = structuredClone(DEFAULT_PROJECT_CONFIG);
  config.memory.maxRamMb = 4096;
  config.models.tiers.large = {
    name: "qwen2.5-coder:14b",
    estimatedRamMb: 16000,
  };
  assert.throws(
    () => validateMemoryBudget(config),
    (err: unknown) =>
      err instanceof Error &&
      err.message.includes("16000") &&
      err.message.includes("4096"),
  );
});

test("validateMemoryBudget skips check when maxRamMb is auto", () => {
  const config = structuredClone(DEFAULT_PROJECT_CONFIG);
  config.memory.maxRamMb = "auto";
  config.models.tiers.large = {
    name: "qwen2.5-coder:14b",
    estimatedRamMb: 16000,
  };
  assert.doesNotThrow(() => validateMemoryBudget(config));
});
