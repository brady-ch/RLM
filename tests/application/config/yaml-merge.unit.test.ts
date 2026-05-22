import assert from "node:assert/strict";
import test from "node:test";
import {
  isPlainRecord,
  mergeInterop,
  mergeYamlLayers,
} from "../../../src/application/config/yaml-merge.js";

test("isPlainRecord rejects arrays and primitives", () => {
  assert.equal(isPlainRecord({ a: 1 }), true);
  assert.equal(isPlainRecord(null), false);
  assert.equal(isPlainRecord([1]), false);
});

test("mergeYamlLayers deep-merges models.tiers and modelProfiles sampling", () => {
  const left: Record<string, unknown> = {
    models: {
      default: "a",
      tiers: { small: { name: "s1", estimatedRamMb: 1 } },
      sampling: { modelProfiles: { p1: { temperature: 0.1 } } },
    },
  };
  const right: Record<string, unknown> = {
    models: {
      default: "b",
      tiers: { medium: { name: "m1", estimatedRamMb: 2 } },
      sampling: { modelProfiles: { p2: { temperature: 0.2 } } },
    },
  };
  const merged = mergeYamlLayers(left, right);
  const models = merged["models"] as Record<string, unknown>;
  const tiers = models["tiers"] as Record<string, unknown>;
  assert.equal(tiers["small"] ? "ok" : "", "ok");
  assert.equal(tiers["medium"] ? "ok" : "", "ok");
  const sampling = models["sampling"] as Record<string, unknown>;
  const profiles = sampling["modelProfiles"] as Record<string, unknown>;
  assert.equal(profiles["p1"] ? "ok" : "", "ok");
  assert.equal(profiles["p2"] ? "ok" : "", "ok");
});

test("mergeYamlLayers replaces agents by id", () => {
  const merged = mergeYamlLayers(
    { agents: { a: { tools: ["x"] } } },
    { agents: { a: { tools: ["y"] }, b: { tools: ["z"] } } },
  );
  assert.deepEqual(merged.agents, {
    a: { tools: ["y"] },
    b: { tools: ["z"] },
  });
});

test("mergeInterop deep-merges mcp and skills maps", () => {
  assert.deepEqual(
    mergeInterop(
      { mcp: { servers: ["a"] }, skills: { s1: 1 }, other: 1 },
      { mcp: { tools: ["t"] }, skills: { s2: 2 }, other: 2 },
    ),
    {
      mcp: { servers: ["a"], tools: ["t"] },
      skills: { s1: 1, s2: 2 },
      other: 2,
    },
  );
});
