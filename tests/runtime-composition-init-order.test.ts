import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileMemoryStore, FileSessionStore } from "../src/adapters/index.js";
import { buildRuntimeContext } from "../src/application/bootstrap/index.js";
import {
  DEFAULT_PROJECT_CONFIG,
  applyModelOverride,
  resolveRuntimeConfig,
} from "../src/application/project-config.js";
import { parseArgs } from "../src/cli/args.js";
import { COMPOSITION_INIT_ORDER } from "../src/runtime/composition/init-order.js";

test("buildRuntimeContext records composition init order without CLI or control-server", async () => {
  const root = mkdtempSync(join(tmpdir(), "rlm-init-order-"));
  const options = parseArgs(["ask", "unit-test-init-order"]);
  const loadedConfig = {
    config: structuredClone(DEFAULT_PROJECT_CONFIG),
    path: undefined as string | undefined,
  };
  const projectConfig = applyModelOverride(loadedConfig.config, undefined);
  const runtimeConfig = resolveRuntimeConfig(projectConfig, {});
  const sessionStore = new FileSessionStore({
    baseDir: join(root, ".rlm", "sessions"),
  });
  const memoryStore = new FileMemoryStore({
    baseDir: join(root, ".rlm", "memory"),
  });

  const stages: string[] = [];
  const ctx = await buildRuntimeContext(
    {
      options,
      loadedConfig,
      projectConfig,
      runtimeConfig,
      sessionStore,
      memoryStore,
      cwd: root,
    },
    {
      onInitStage: (stage) => {
        stages.push(stage);
      },
    },
  );

  assert.deepEqual(stages, [...COMPOSITION_INIT_ORDER]);
  assert.ok(ctx.extensionHost.tools.get("skill"));
  assert.ok(ctx.registry.profiles.length > 0);
  assert.equal(typeof ctx.createModel, "function");

  await ctx.cleanup.closeAll("complete");
});
