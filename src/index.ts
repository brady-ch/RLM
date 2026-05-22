#!/usr/bin/env node
import { FileMemoryStore } from "./adapters/file-memory-store.js";
import { FileSessionStore } from "./adapters/file-session-store.js";
import { buildRuntimeContext } from "./application/bootstrap/index.js";
import {
  applyModelOverride,
  loadProjectConfig,
  resolveRuntimeConfig,
  seedProjectRlmStarter,
} from "./application/project-config.js";
import { readablePath } from "./application/runtime-composition.js";
import { helpText, parseArgs } from "./cli/args.js";
import {
  formatLaunchModeBanner,
  injectLaunchArgv,
  promptLaunchChoice,
  resolveLaunchMode,
  shouldSkipLaunchWizard,
} from "./cli/first-run.js";
import { runAskWorkflowOrApprove } from "./cli/run-modes/agent-workflow.js";
import { runPlanNodeMode } from "./cli/run-modes/plan-node.js";
import { handleSessionCommands } from "./cli/run-modes/session-commands.js";
import { handleWorkflowExport, handleWorkflowImport } from "./cli/run-modes/workflow-graph-io.js";
import { runUiMode } from "./cli/run-modes/ui.js";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_ENTRY_PATH = fileURLToPath(import.meta.url);

async function main(): Promise<void> {
  let cliArgv = process.argv.slice(2);
  const ttyCombined = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  if (!shouldSkipLaunchWizard(cliArgv)) {
    const preliminary = resolveLaunchMode(process.env, ttyCombined);
    if (preliminary.shouldPrompt) {
      process.stderr.write(formatLaunchModeBanner());
      const answer = await promptLaunchChoice();
      const settled = resolveLaunchMode(process.env, ttyCombined, answer);
      cliArgv = injectLaunchArgv(cliArgv, settled.mode);
    } else {
      cliArgv = injectLaunchArgv(cliArgv, preliminary.mode);
    }
  }

  const options = parseArgs(cliArgv);
  if (options.command === "help") {
    console.log(helpText());
    return;
  }

  const cwd = process.cwd();
  const sessionStore = new FileSessionStore({
    baseDir: join(cwd, ".rlm", "sessions"),
  });
  const memoryStore = new FileMemoryStore({
    baseDir: join(cwd, ".rlm", "memory"),
  });

  if (await handleSessionCommands(options, sessionStore, memoryStore)) {
    return;
  }

  if (options.command === "workflow-export") {
    await handleWorkflowExport(options, sessionStore, cwd);
    return;
  }
  if (options.command === "workflow-import") {
    await handleWorkflowImport(options, cwd);
    return;
  }

  let loadedConfig = await loadProjectConfig(options.configPath);
  const legacyMonoConfig = resolve(cwd, "rlm.config.yaml");
  if (
    options.command === "ui" &&
    options.configPath === undefined &&
    process.env.RLM_SKIP_STARTER_SEED !== "1" &&
    !(await readablePath(legacyMonoConfig))
  ) {
    const seeded = await seedProjectRlmStarter(cwd);
    if (seeded) {
      loadedConfig = await loadProjectConfig(options.configPath);
    }
  }

  const projectConfig = applyModelOverride(loadedConfig.config, options.modelOverride);
  const runtimeConfig = resolveRuntimeConfig(projectConfig, options.configOverrides);

  const ctx = await buildRuntimeContext({
    options,
    loadedConfig,
    projectConfig,
    runtimeConfig,
    sessionStore,
    memoryStore,
    cwd,
  });

  try {
    if (options.command === "plan-node") {
      await runPlanNodeMode(ctx);
      return;
    }
    if (options.command === "ui") {
      await runUiMode(ctx, CLI_ENTRY_PATH);
      return;
    }
    await runAskWorkflowOrApprove(ctx);
  } finally {
    ctx.shutdown.markCompleted();
    ctx.memoryManager.releaseAll();
    await ctx.cleanup.closeAll("complete");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes("--json")) {
    console.error(JSON.stringify({ error: message }));
  } else {
    console.error(`RLM failed: ${message}`);
  }
  process.exitCode = 1;
});
