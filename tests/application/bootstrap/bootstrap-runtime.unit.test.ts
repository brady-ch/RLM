import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileMemoryStore, FileSessionStore } from "../../../src/adapters/index.js";
import { buildRuntimeContext } from "../../../src/application/bootstrap/index.js";
import {
  DEFAULT_PROJECT_CONFIG,
  applyModelOverride,
  resolveRuntimeConfig,
} from "../../../src/application/project-config.js";
import { parseArgs } from "../../../src/cli/args.js";

test("buildRuntimeContext registers default+coding profiles and skill interop helper", async () => {
  const root = mkdtempSync(join(tmpdir(), "rlm-boot-"));
  const options = parseArgs(["ask", "unit-test-bootstrap"]);
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

  const ctx = await buildRuntimeContext({
    options,
    loadedConfig,
    projectConfig,
    runtimeConfig,
    sessionStore,
    memoryStore,
    cwd: root,
  });

  const profileIds = ctx.registry.profiles.map((p) => p.id);
  assert.ok(profileIds.includes("default"));
  assert.ok(profileIds.includes("coding"));
  assert.equal(ctx.extensionHost.tools.get("skill")?.name, "skill");

  await ctx.cleanup.closeAll("complete");
});
