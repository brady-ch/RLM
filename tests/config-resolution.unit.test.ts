import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PROJECT_CONFIG,
  applyModelOverride,
  resolveModelTier,
  resolveRuntimeConfig,
  resolveRuntimeHostSelection,
} from "../src/application/project-config.js";
import type { ProjectConfig } from "../src/application/project-config.js";

function cloneDefaults(): ProjectConfig {
  return structuredClone(DEFAULT_PROJECT_CONFIG);
}

test("Case A: resolveRuntimeHostSelection prefers RLM_HOST over cli then config", () => {
  const prev = process.env.RLM_HOST;
  process.env.RLM_HOST = " env-host ";
  try {
    const config = cloneDefaults();
    config.runtimeHost = "from-config";
    config.hosts = {
      only: { kind: "ollama", baseUrl: "http://127.0.0.1:11434" },
    };

    const sel = resolveRuntimeHostSelection(config, {
      cliHostId: "cli-host",
      env: process.env,
    });
    assert.equal(sel.hostId, "env-host");
    assert.equal(sel.source, "env");
  } finally {
    if (prev === undefined) {
      delete process.env.RLM_HOST;
    } else {
      process.env.RLM_HOST = prev;
    }
  }
});

test("Case B: empty hosts map falls back to local_ollama default source", () => {
  const config = cloneDefaults();
  config.hosts = {};
  delete config.runtimeHost;

  const sel = resolveRuntimeHostSelection(config, {});
  assert.deepEqual(sel, { hostId: "local_ollama", source: "default" });
});

test("Case C: resolveModelTier hits named tier or falls back estimatedRamMb rule", () => {
  const defaults = cloneDefaults();
  const small = resolveModelTier(defaults, "small");
  assert.equal(small.name, "granite4.1:3b");
  assert.equal(small.estimatedRamMb, 4096);

  const cfgNoSmall = cloneDefaults();
  delete cfgNoSmall.models.tiers["small"];
  const unknown = resolveModelTier(cfgNoSmall, "custom");
  assert.equal(unknown.name, "custom");
  assert.equal(unknown.estimatedRamMb, 4096);

  const cfgCustomSmall = cloneDefaults();
  cfgCustomSmall.models.tiers = {
    small: { name: "x", estimatedRamMb: 2222 },
    medium: { name: "y", estimatedRamMb: 5000 },
  };
  const synthetic = resolveModelTier(cfgCustomSmall, "ghost");
  assert.equal(synthetic.estimatedRamMb, 2222);
});

test("Case D: applyModelOverride sets models.default and small tier name preserving estimatedRamMb", () => {
  const config = cloneDefaults();
  config.models.tiers["small"] = { name: "before", estimatedRamMb: 7777 };
  const next = applyModelOverride(config, "override-model");
  assert.equal(next.models.default, "override-model");
  const smallTier = next.models.tiers["small"];
  assert.ok(smallTier);
  assert.equal(smallTier.name, "override-model");
  assert.equal(smallTier.estimatedRamMb, 7777);
});

test("Case E: resolveRuntimeConfig merges qualityLoop phaseModels without dropping unspecified phases", () => {
  const config = cloneDefaults();
  config.runtime = {
    ...config.runtime,
    qualityLoop: {
      enabled: true,
      maxIterations: 2,
      budgetBehavior: "stop_before_partial_iteration",
      phaseModels: { draft: "medium", refine: "small" },
    },
  };

  const merged = resolveRuntimeConfig(config, {
    qualityLoop: {
      enabled: true,
      maxIterations: 2,
      budgetBehavior: "stop_before_partial_iteration",
      phaseModels: { critique: "large", draft: "small" },
    },
  });

  assert.equal(merged.qualityLoop?.phaseModels?.draft, "small");
  assert.equal(merged.qualityLoop?.phaseModels?.critique, "large");
  assert.equal(merged.qualityLoop?.phaseModels?.refine, "small");
});
