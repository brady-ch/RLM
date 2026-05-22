#!/usr/bin/env node
import { FileRunStateStore } from "./adapters/file-run-state-store.js";
import { FileMemoryStore } from "./adapters/file-memory-store.js";
import { FileVectorIndex } from "./adapters/file-vector-index.js";
import { OllamaEmbeddingModel } from "./adapters/ollama-embedding-model.js";
import { FileSessionStore } from "./adapters/file-session-store.js";
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
import { MemoryResolver } from "./application/memory-resolver.js";
import { PurposeRoutingLanguageModel } from "./application/model-provider.js";
import { SemanticMemoryIndex } from "./application/semantic-memory-index.js";
import { createMcpTools, createSkillTool } from "./application/interop-runtime.js";
import {
  applyModelOverride,
  loadProjectConfig,
  resolveHostConfig,
  resolveRuntimeConfig,
  resolveRuntimeHostSelection,
  seedProjectRlmStarter,
} from "./application/project-config.js";
import { ResourceCleanup } from "./application/resource-cleanup.js";
import { createModelFactory, createToolsResolver, readablePath } from "./application/runtime-composition.js";
import { runWorkflow } from "./application/workflow-runner.js";
import * as guardedShellExtension from "./extensions/tools/guarded-shell.extension.js";
import * as webFetchExtension from "./extensions/tools/web-fetch.extension.js";
import * as webSearchExtension from "./extensions/tools/web-search.extension.js";
import * as workspaceFileWriteExtension from "./extensions/tools/workspace-file-write.extension.js";
import { CancellationController, createExecutionControl, createInteractiveExecutionSession } from "./application/execution-controller.js";
import { startControlServer, type SessionRuntimeRef } from "./application/control-server.js";
import { restoreSessionMemory } from "./application/session-memory-bridge.js";
import { ModelLibraryService } from "./application/model-library.js";
import { createUiExecutionRunner } from "./application/ui-execution-runner.js";
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
import type { ExecutionEvent, RecursivePromptResult } from "./domain/types.js";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

  const sessionStore = new FileSessionStore({
    baseDir: join(process.cwd(), ".rlm", "sessions"),
  });
  const memoryStore = new FileMemoryStore({
    baseDir: join(process.cwd(), ".rlm", "memory"),
  });
  if (options.sessionList) {
    console.log(JSON.stringify({ sessions: await sessionStore.list() }, null, 2));
    return;
  }
  if (options.sessionInspect) {
    console.log(JSON.stringify(await sessionStore.inspect(options.sessionInspect), null, 2));
    return;
  }
  if (options.memoryInspect) {
    const inspector = new MemoryResolver(memoryStore, { sessionId: options.memoryInspect });
    console.log(JSON.stringify(await inspector.inspect(), null, 2));
    return;
  }
  if (options.preferenceSet) {
    const { key, value } = parsePreferenceAssignment(options.preferenceSet);
    const preferences = new MemoryResolver(memoryStore, { sessionId: "preferences-cli" });
    await preferences.setPreference({ key, value, source: "cli", lifetime: "project" });
    console.log(JSON.stringify(await preferences.inspect(), null, 2));
    return;
  }
  if (options.preferenceDelete) {
    const preferences = new MemoryResolver(memoryStore, { sessionId: "preferences-cli" });
    await preferences.deletePreference({ key: options.preferenceDelete });
    console.log(JSON.stringify(await preferences.inspect(), null, 2));
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
  let runId = `run-${Date.now()}`;
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
    runId,
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
  const interopTools = [
    createSkillTool(runtimeEvents),
    ...await createMcpTools(projectConfig.interop?.mcp.servers ?? [], runtimeEvents, (child) => {
      cleanup.track({
        close: async () => {
          child.kill();
        },
      });
    }),
  ];
  for (const tool of interopTools) {
    extensionHost.tools.register(tool);
  }
  const toolsFor = createToolsResolver({ projectConfig, extensionHost, interopTools });
  const runStateStore = new FileRunStateStore({
    baseDir: join(process.cwd(), ".planning", "runs"),
  });
  const runState = {
    runId,
    store: runStateStore,
    actor: "runtime",
    capabilityToken: `${runId}:runtime`,
  };
  await memoryStore.patchScope({
    sessionId: runId,
    scopeId: "run-manifest",
    actor: "runtime",
    expectedVersion: 0,
    allowedScopes: ["run-manifest"],
    writes: ["memory updates"],
    patch: {
      runId,
      promptPreview: options.prompt.slice(0, 240),
      createdAt: new Date().toISOString(),
    },
    lifetime: "session",
  });
  const existingPreferences = await memoryStore.readScope(runId, "project-preferences");
  if (!existingPreferences) {
    await memoryStore.patchScope({
      sessionId: runId,
      scopeId: "project-preferences",
      actor: "runtime",
      expectedVersion: 0,
      allowedScopes: ["project-preferences"],
      writes: ["preferences"],
      patch: {},
      lifetime: "project",
    });
  }
  const vectorIndex = new FileVectorIndex({ path: join(process.cwd(), ".rlm", "memory", "vector-index.json") });
  const embeddingModel = new OllamaEmbeddingModel({
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    ...(process.env.RLM_EMBED_MODEL ? { model: process.env.RLM_EMBED_MODEL } : {}),
  });
  const createMemoryForRun = (sessionId: string): MemoryResolver => new MemoryResolver(
    memoryStore,
    { sessionId },
    new SemanticMemoryIndex({
      sessionId,
      store: memoryStore,
      embeddings: embeddingModel,
      index: vectorIndex,
    }),
  );
  let runtimeMemory = createMemoryForRun(runId);
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
  const createModel = createModelFactory({
    modelCache: createdModels,
    baseUrlOverride: options.baseUrl,
    trackCleanup: (model) => cleanup.track(model),
  });
  try {
    const defaultAgent = selectAgent(registry, options.prompt, options.agent);
    const createPurposeRoutingModel = (): PurposeRoutingLanguageModel => new PurposeRoutingLanguageModel({
      config: projectConfig,
      agent: defaultAgent.config,
      hostSelection: resolveRuntimeHostSelection(projectConfig, {
        cliHostId: options.host,
        env: process.env,
      }),
      createModel,
      logger,
    });

    if (options.command === "plan-node") {
      const session = createInteractiveExecutionSession({
        seedRootPrompt: options.prompt,
        planModel: createPurposeRoutingModel(),
      });
      try {
        const plan = await session.planNode(options.nodeId ?? "root-composer", { replan: options.replan });
        const graph = session.snapshot().graph;
        console.log(JSON.stringify({ plannedNodeIds: plan.plannedNodeIds, budget: plan.budget, graphNodeCount: graph.nodes.length }, null, 2));
      } catch (error: unknown) {
        const mutationError = session.toMutationError(error);
        console.error(JSON.stringify(mutationError ?? { error: error instanceof Error ? error.message : String(error) }, null, 2));
        process.exitCode = 1;
      }
      return;
    }

    if (options.command === "ui") {
      const session = createInteractiveExecutionSession({ seedRootPrompt: options.prompt, planModel: createPurposeRoutingModel() });
      if (options.openSession) {
        const saved = await sessionStore.load(options.openSession);
        if (saved.verification.status !== "complete") {
          console.error(`Saved session ${saved.id} has ${saved.verification.status} verification; unsafe continuation is blocked.`);
          process.exitCode = 1;
          return;
        }
        runId = await restoreSessionMemory({
          payload: saved.payload,
          memoryStore,
          vectorIndex,
        });
        runState.runId = runId;
        runState.capabilityToken = `${runId}:runtime`;
        runtimeMemory = createMemoryForRun(runId);
        session.restoreSnapshot(saved.payload.session as ReturnType<typeof session.snapshot>);
      }
      const sessionRuntime: SessionRuntimeRef = {
        getRunId: () => runId,
        setRunId: (nextRunId) => {
          runId = nextRunId;
          runState.runId = nextRunId;
          runState.capabilityToken = `${nextRunId}:runtime`;
        },
        memoryStore,
        vectorIndex,
        getMemory: () => runtimeMemory,
        setMemory: (memory) => {
          runtimeMemory = memory;
        },
        createMemory: createMemoryForRun,
        embedProvider: process.env.RLM_EMBED_MODEL ?? "ollama",
      };
      const runtimeHost = resolveRuntimeHostSelection(projectConfig, {
        cliHostId: options.host,
        env: process.env,
      });
      const hostConfig = resolveHostConfig(projectConfig, runtimeHost.hostId);
      const modelLibrary = new ModelLibraryService({
        config: projectConfig,
        ollamaBaseUrl: options.baseUrl ?? hostConfig.baseUrl,
      });
      const uiRunner = createUiExecutionRunner({
        projectConfig,
        runtimeConfig,
        configPath: loadedConfig.path,
        registry,
        agentSource: options.agent ? "override" : "auto",
        memoryManager,
        hostId: options.host,
        createModel,
        logger,
        runState,
        resolveMemory: () => runtimeMemory,
      });
      const uiDistDir = resolveUiDistDir(fileURLToPath(import.meta.url), process.env);
      const server = await startControlServer({
        session,
        port: options.uiPort,
        uiDistDir,
        modelLibrary,
        sessionStore,
        memory: runtimeMemory,
        sessionRuntime,
        onConfirmRun: (activeSession) => uiRunner.start(activeSession),
      });
      cleanup.track({
        close: () => server.close(),
      });
      console.error(`RLM UI listening at ${server.url}`);
      await new Promise<void>(() => {
        // UI mode keeps the control server alive. Execution starts when the user
        // confirms the graph through POST /api/chat/confirm-run.
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
      runState,
      memory: runtimeMemory,
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
        runState,
        memory: runtimeMemory,
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
          runState,
          memory: runtimeMemory,
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
          runState,
          memory: runtimeMemory,
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

function parsePreferenceAssignment(value: string): { key: string; value: string } {
  const separator = value.indexOf("=");
  if (separator <= 0) {
    throw new Error("--preference-set must use key=value.");
  }
  const key = value.slice(0, separator).trim();
  const preferenceValue = value.slice(separator + 1).trim();
  if (!key || !preferenceValue) {
    throw new Error("--preference-set requires non-empty key and value.");
  }
  return { key, value: preferenceValue };
}
