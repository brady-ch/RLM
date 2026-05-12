#!/usr/bin/env node
import { OllamaLanguageModelAdapter } from "./adapters/ollama-language-model.js";
import { HttpLanguageModelAdapter } from "./adapters/http-language-model.js";
import { runConfiguredAgent } from "./application/agent-runner.js";
import { createAgentRegistry, selectAgent } from "./application/agent-registry.js";
import { ExtensionHost } from "./application/extension-host.js";
import {
  CentralAtomicSequenceAllocator,
  CompositeEventSink,
  EventStoreSink,
  FileEventExportSink,
  InMemoryEventStore,
  McpSkillRuntime,
} from "./application/mcp-skill-runtime.js";
import { MemoryManager } from "./application/memory-manager.js";
import { applyModelOverride, loadProjectConfig, resolveRuntimeConfig, seedProjectRlmStarter } from "./application/project-config.js";
import { ResourceCleanup } from "./application/resource-cleanup.js";
import { runWorkflow } from "./application/workflow-runner.js";
import * as guardedShellExtension from "./extensions/tools/guarded-shell.extension.js";
import * as webFetchExtension from "./extensions/tools/web-fetch.extension.js";
import * as webSearchExtension from "./extensions/tools/web-search.extension.js";
import * as workspaceFileWriteExtension from "./extensions/tools/workspace-file-write.extension.js";
import { CancellationController, createExecutionControl, createInteractiveExecutionSession } from "./application/execution-controller.js";
import { startControlServer } from "./application/control-server.js";
import { helpText, parseArgs } from "./cli/args.js";
import {
  formatLaunchModeBanner,
  injectLaunchArgv,
  promptLaunchChoice,
  resolveLaunchMode,
  shouldSkipLaunchWizard,
} from "./cli/first-run.js";
import { resolveUiDistDir } from "./cli/ui-dist-dir.js";
import { renderResult } from "./cli/render.js";
import { createStderrRuntimeLogger } from "./cli/runtime-logger.js";
import { installShutdownHandlers } from "./cli/shutdown.js";
import type { LanguageModelPort } from "./ports/language-model-port.js";
import type { ModelRuntimeSelection } from "./application/model-provider.js";
import type { ExecutionEvent, RecursivePromptResult } from "./domain/types.js";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { constants } from "node:fs";
import { access } from "node:fs/promises";

async function readablePath(pathLike: string): Promise<boolean> {
  try {
    await access(pathLike, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

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
    }
    else {
      cliArgv = injectLaunchArgv(cliArgv, preliminary.mode);
    }
  }

  const options = parseArgs(cliArgv);
  if (options.command === "help") {
    console.log(helpText());
    return;
  }

  let loadedConfig = await loadProjectConfig(options.configPath);
  const legacyMonoConfig = resolve(process.cwd(), "rlm.config.yaml");
  if (
    options.command === "ui"
    && options.configPath === undefined
    && process.env.RLM_SKIP_STARTER_SEED !== "1"
    && !(await readablePath(legacyMonoConfig))
  ) {
    const seeded = await seedProjectRlmStarter(process.cwd());
    if (seeded) {
      loadedConfig = await loadProjectConfig(options.configPath);
    }
  }
  const projectConfig = applyModelOverride(loadedConfig.config, options.modelOverride);
  const runtimeConfig = resolveRuntimeConfig(projectConfig, options.configOverrides);
  const logger = options.verbose ? createStderrRuntimeLogger() : undefined;
  const cleanup = new ResourceCleanup(logger);
  logger?.log({
    stage: "cli",
    message: "starting request",
    data: {
      agent: options.agent ?? "auto",
      workflow: options.workflow,
      model: projectConfig.models.default,
      json: options.json,
      trace: options.trace,
    },
  });
  const memoryManager = new MemoryManager({
    config: projectConfig.memory,
  });
  const cancellation = new CancellationController();
  const onExecutionEvent = options.jsonStream ? (event: ExecutionEvent) => {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  } : undefined;
  const execution = createExecutionControl({
    planOnly: options.planOnly || options.requireApproval,
    cancellation,
    onEvent: onExecutionEvent,
  });
  const shutdown = installShutdownHandlers({
    json: options.json,
    logger,
    cleanup: async (reason) => {
      cancellation.cancel(reason);
      memoryManager.releaseAll();
      await cleanup.closeAll(reason);
    },
  });
  const extensionHost = new ExtensionHost();
  const runtimeEventsStore = new InMemoryEventStore();
  const runtimeEvents = new McpSkillRuntime(
    projectConfig.interop ?? {
      mcp: { servers: [] },
      skills: {
        searchPaths: [".codex/skills", ".agents/skills"],
        duplicateStrategy: "first_match",
        cache: false,
        pathPolicies: [],
      },
    },
    `run-${Date.now()}`,
    new CentralAtomicSequenceAllocator(),
    new CompositeEventSink([
      new EventStoreSink(runtimeEventsStore),
      new FileEventExportSink(join(process.cwd(), ".planning", "runs", "latest", "warnings.jsonl")),
    ]),
  );
  extensionHost.loadBuiltins([
    { path: "src/extensions/tools/guarded-shell.extension.ts", register: guardedShellExtension.register },
    { path: "src/extensions/tools/workspace-file-write.extension.ts", register: workspaceFileWriteExtension.register },
    { path: "src/extensions/tools/web-search.extension.ts", register: webSearchExtension.register },
    { path: "src/extensions/tools/web-fetch.extension.ts", register: webFetchExtension.register },
  ]);
  const configFilePath = loadedConfig.path ?? join(process.cwd(), "rlm.config.yaml");
  const configuredExtensions = projectConfig.extensions?.load ?? [];
  if (configuredExtensions.length > 0) {
    const configuredAllowlist = projectConfig.extensions?.allowlist;
    const extensionOptions: {
      configFilePath: string;
      allowlistPath?: string;
      interactive: boolean;
    } = {
      configFilePath,
      interactive: process.stdin.isTTY && process.stdout.isTTY,
    };
    if (configuredAllowlist) {
      extensionOptions.allowlistPath = isAbsolute(configuredAllowlist)
        ? configuredAllowlist
        : resolve(dirname(configFilePath), configuredAllowlist);
    }

    await extensionHost.loadExternal(configuredExtensions, extensionOptions);
  }
  const toolsFor = (agentId: string) => {
    const agentConfig = projectConfig.agents[agentId];
    if (!agentConfig) {
      throw new Error(`Missing configuration for agent "${agentId}".`);
    }

    return agentConfig.tools.map((toolName) => {
      const tool = extensionHost.tools.get(toolName);
      if (!tool) {
        throw new Error(`Agent "${agentId}" references unknown tool "${toolName}".`);
      }

      return tool;
    });
  };
  logger?.log({
    stage: "interop",
    message: "mcp+skill runtime initialized",
    data: {
      mcpServers: (projectConfig.interop?.mcp.servers.length ?? 0),
      skillSearchPaths: runtimeEvents.getSkillSearchPaths(),
      skillCache: runtimeEvents.isSkillCacheEnabled(),
    },
  });
  const registry = createAgentRegistry({
    defaultTools: toolsFor("default"),
    researchTools: toolsFor("research"),
    codingTools: toolsFor("coding"),
    qaTools: projectConfig.agents["qa"] ? toolsFor("qa") : toolsFor("coding"),
    productDesignerTools: toolsFor("product_designer"),
    agentConfigs: projectConfig.agents,
  });
  const createdModels = new Map<string, LanguageModelPort>();
  const createModel = (model: string, runtime: ModelRuntimeSelection) => {
    const modelKey = `${runtime.hostId}:${model}`;
    const existing = createdModels.get(modelKey);
    if (existing) {
      return existing;
    }

    const effectiveBaseUrl = options.baseUrl ?? runtime.baseUrl;
    const created = runtime.hostKind === "http"
      ? new HttpLanguageModelAdapter({ model, baseUrl: effectiveBaseUrl })
      : new OllamaLanguageModelAdapter({ model, baseUrl: effectiveBaseUrl });
    cleanup.track(created);
    createdModels.set(modelKey, created);
    return created;
  };
  try {
    if (options.command === "ui") {
      const session = createInteractiveExecutionSession({ seedRootPrompt: options.prompt });
      const uiDistDir = resolveUiDistDir(fileURLToPath(import.meta.url), process.env);
      const server = await startControlServer({
        session,
        port: options.uiPort,
        uiDistDir,
      });
      cleanup.track({
        close: () => server.close(),
      });
      console.error(`RLM UI listening at ${server.url}`);
      await new Promise<void>(() => {
        // UI mode is an authoring session. Execution must be triggered by an
        // explicit graph-confirmed action, not by merely opening the browser.
      });
      return;
    }

    const runInputBase = {
      prompt: options.prompt,
      config: runtimeConfig,
      projectConfig,
      registry,
      memoryManager,
      createModel,
      logger,
      execution,
    } as const;
    let result = options.workflow
      ? await runWorkflow({
        ...runInputBase,
        workflowId: options.workflow,
        hostId: options.host,
      })
      : await runConfiguredAgent({
        prompt: runInputBase.prompt,
        config: runInputBase.config,
        projectConfig: runInputBase.projectConfig,
        agent: selectAgent(registry, options.prompt, options.agent),
        agentSource: options.agent ? "override" : "auto",
        memoryManager: runInputBase.memoryManager,
        hostId: options.host,
        createModel: runInputBase.createModel,
        logger: runInputBase.logger,
        execution,
      });
    if (options.requireApproval && !options.planOnly) {
      if (!options.approve) {
        await waitForApproval();
      }
      const executeControl = createExecutionControl({
        planOnly: false,
        cancellation,
        onEvent: onExecutionEvent,
      });
      result = options.workflow
        ? await runWorkflow({
          ...runInputBase,
          workflowId: options.workflow,
          hostId: options.host,
          execution: executeControl,
        })
        : await runConfiguredAgent({
          prompt: runInputBase.prompt,
          config: runInputBase.config,
          projectConfig: runInputBase.projectConfig,
          agent: selectAgent(registry, options.prompt, options.agent),
          agentSource: options.agent ? "override" : "auto",
          memoryManager: runInputBase.memoryManager,
          hostId: options.host,
          createModel: runInputBase.createModel,
          logger: runInputBase.logger,
          execution: executeControl,
        });
    }
    if (loadedConfig.path) {
      result.metadata.configPath = loadedConfig.path;
    }

    console.log(
      renderResult(result, {
        compact: options.compact,
        json: options.json,
        includeTrace: options.trace,
        model: projectConfig.models.default,
      }),
    );
    setExitCodeIfRunFailed(result);
  } finally {
    shutdown.markCompleted();
    memoryManager.releaseAll();
    await cleanup.closeAll("complete");
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

function setExitCodeIfRunFailed(result: RecursivePromptResult): void {
  if (result.metadata.executionStatus === "failed" || (result.metadata.errors?.length ?? 0) > 0) {
    process.exitCode = 1;
  }
}

async function waitForApproval(): Promise<void> {
  process.stderr.write("Plan generated. Type 'run' and press Enter to execute, or Ctrl+C to cancel.\n");
  const chunks: string[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk.toString());
    const text = chunks.join("").trim().toLowerCase();
    if (text === "run" || text === "yes" || text === "y") {
      return;
    }
    process.stderr.write("Waiting for approval: type 'run' to continue.\n");
    chunks.length = 0;
  }
}
