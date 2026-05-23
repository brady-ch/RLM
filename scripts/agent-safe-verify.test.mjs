import assert from "node:assert/strict";
import test from "node:test";

import { computeAdaptiveLimits } from "./lib/ram-gate.mjs";

test("computeAdaptiveLimits scales down on 8 GB laptop with low availability", () => {
  const limits = computeAdaptiveLimits({ totalMb: 8192, availableMb: 1600 });
  assert.ok(limits.minimalGateMb <= 320);
  assert.ok(limits.buildGateMb <= 640);
  assert.ok(limits.compileGateMb <= 512);
  assert.ok(limits.minimalGateMb >= 128);
  assert.equal(limits.cargoJobs, 1);
});

test("computeAdaptiveLimits allows more headroom on 32 GB workstation", () => {
  const limits = computeAdaptiveLimits({ totalMb: 32768, availableMb: 20000 });
  assert.ok(limits.minimalGateMb >= 500);
  assert.ok(limits.buildGateMb >= 2500);
  assert.ok(limits.compileGateMb >= 2000);
  assert.ok(limits.nodeHeapMb >= 3000);
  assert.ok(limits.cargoJobs >= 2);
});

test("computeAdaptiveLimits never gates above current availability fraction", () => {
  const limits = computeAdaptiveLimits({ totalMb: 32768, availableMb: 1200 });
  assert.ok(limits.minimalGateMb <= Math.round(1200 * 0.15));
  assert.ok(limits.buildGateMb <= Math.round(1200 * 0.4));
  assert.ok(limits.compileGateMb <= Math.round(1200 * 0.3));
});
