import test from "node:test";
import assert from "node:assert/strict";
import { ModelLibraryService } from "../../../src/application/model-library.js";
import type { ProjectConfig } from "../../../src/application/project-config.js";

function buildProject(): ProjectConfig {
  return {
    models: {
      default: "granite4.1:3b",
      tiers: {
        small: { name: "granite4.1:3b", estimatedRamMb: 4096 },
        medium: { name: "llama3.1:8b", estimatedRamMb: 8192 },
      },
    },
    memory: {
      maxRamMb: "auto",
      reserveSystemRamMb: 2048,
      waitForCapacity: false,
      capacityCheckIntervalMs: 1,
    },
    runtime: {
      maxDynamicDepth: 2,
      maxBranches: 2,
      maxPromptCharacters: 500,
      maxModelCalls: 6,
      maxToolRounds: 1,
    },
    agents: {},
    workflows: {},
  };
}

test("model library keeps RAM-ineligible curated models visible but disabled", async () => {
  const service = new ModelLibraryService({
    config: buildProject(),
    ollamaBaseUrl: "http://127.0.0.1:11434",
    fetch: async (input) => {
      if (String(input).endsWith("/api/tags")) {
        return Response.json({ models: [{ name: "qwen2.5-coder:14b" }] });
      }
      return new Response("not found", { status: 404 });
    },
    memorySnapshot: () => ({
      totalRamMb: 16_384,
      freeRamMb: 10_000,
      usableRamMb: 7952,
      reservedRamMb: 0,
      availableRamMb: 7952,
    }),
  });

  const snapshot = await service.snapshot();
  const large = snapshot.curated.find((entry) => entry.id === "qwen2.5-coder:14b");

  assert.equal(large?.status, "installed");
  assert.equal(large?.disabled, true);
  assert.match(large?.disabledReason ?? "", /requires 16000 MB but only 7952 MB is available/i);
  const installedLarge = snapshot.installed.find((entry) => entry.id === "qwen2.5-coder:14b");
  assert.equal(installedLarge?.status, "installed");
  assert.equal(installedLarge?.disabled, true);
  assert.match(
    installedLarge?.disabledReason ?? "",
    /requires 16000 MB but only 7952 MB is available/i,
  );
});

test("model library rejects assigning a RAM-ineligible model to a tier", () => {
  const service = new ModelLibraryService({
    config: buildProject(),
    ollamaBaseUrl: "http://127.0.0.1:11434",
    memorySnapshot: () => ({
      totalRamMb: 16_384,
      freeRamMb: 10_000,
      usableRamMb: 7952,
      reservedRamMb: 0,
      availableRamMb: 7952,
    }),
  });

  assert.throws(
    () => service.selectTier({ tier: "medium", model: "qwen2.5-coder:14b" }),
    /requires 16000 MB but only 7952 MB is available/i,
  );
});

test("model library rejects installing a RAM-ineligible curated model", () => {
  const service = new ModelLibraryService({
    config: buildProject(),
    ollamaBaseUrl: "http://127.0.0.1:11434",
    memorySnapshot: () => ({
      totalRamMb: 16_384,
      freeRamMb: 10_000,
      usableRamMb: 7952,
      reservedRamMb: 0,
      availableRamMb: 7952,
    }),
  });

  assert.throws(
    () => service.startInstall("qwen2.5-coder:14b"),
    /requires 16000 MB but only 7952 MB is available/i,
  );
});
