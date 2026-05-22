import {
  FileRunStateStore,
  FileVectorIndex,
  OllamaEmbeddingModel,
} from "../../application/bootstrap/adapters.js";
import { MemoryManager } from "../../application/memory-manager.js";
import { MemoryResolver } from "../../application/memory-resolver.js";
import { SemanticMemoryIndex } from "../../application/semantic-memory-index.js";
import {
  CancellationController,
  createExecutionControl,
} from "../../application/execution-controller.js";
import { createAgentRegistry } from "../../application/agent-registry.js";
import { ResourceCleanup } from "../../application/resource-cleanup.js";
import { createStderrRuntimeLogger } from "../../cli/runtime-logger.js";
import { installShutdownHandlers } from "../../cli/shutdown.js";
import * as guardedShellExtension from "../../extensions/tools/guarded-shell.extension.js";
import * as webFetchExtension from "../../extensions/tools/web-fetch.extension.js";
import * as webSearchExtension from "../../extensions/tools/web-search.extension.js";
import * as workspaceFileWriteExtension from "../../extensions/tools/workspace-file-write.extension.js";
import type { ExecutionEvent } from "../../domain/types.js";
import type { LanguageModelPort } from "../../ports/language-model-port.js";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { ExtensionHost } from "./extension-host.js";
import {
  COMPOSITION_INIT_ORDER,
  type CompositionInitStage,
  type CompositionInitStageRecorder,
} from "./init-order.js";
import { createModelFactory, createToolsResolver } from "./runtime-composition.js";
import { createMcpTools, createSkillTool } from "../interop/interop-runtime.js";
import {
  CentralAtomicSequenceAllocator,
  CompositeEventSink,
  EventStoreSink,
  FileEventExportSink,
  InMemoryEventStore,
  McpSkillRuntime,
} from "../interop/mcp-skill-runtime.js";
import type {
  BuildRuntimeContextInput,
  RuntimeContext,
} from "../../application/bootstrap/types.js";

export { COMPOSITION_INIT_ORDER, type CompositionInitStage, type CompositionInitStageRecorder };

export type BuildRuntimeContextOptions = {
  onInitStage?: CompositionInitStageRecorder;
};

export async function buildRuntimeContext(
  input: BuildRuntimeContextInput,
  options?: BuildRuntimeContextOptions,
): Promise<RuntimeContext> {
  const recordStage = (stage: CompositionInitStage): void => {
    options?.onInitStage?.(stage);
  };

  const cwd = input.cwd ?? process.cwd();

  const { options: cliOptions } = input;
  const logger = cliOptions.verbose ? createStderrRuntimeLogger() : undefined;
  const cleanup = new ResourceCleanup(logger);

  logger?.log({
    stage: "cli",
    message: "starting request",
    data: {
      agent: cliOptions.agent ?? "auto",
      workflow: cliOptions.workflow,
      variant: cliOptions.variant,
      model: input.projectConfig.models.default,
      json: cliOptions.json,
      trace: cliOptions.trace,
    },
  });

  const memoryManager = new MemoryManager({
    config: input.projectConfig.memory,
  });
  const cancellation = new CancellationController();
  const onExecutionEvent = cliOptions.jsonStream
    ? (event: ExecutionEvent) => {
        process.stdout.write(`${JSON.stringify(event)}\n`);
      }
    : undefined;
  const execution = createExecutionControl({
    planOnly: cliOptions.planOnly || cliOptions.requireApproval,
    cancellation,
    onEvent: onExecutionEvent,
  });
  const shutdown = installShutdownHandlers({
    json: cliOptions.json,
    logger,
    cleanup: async (reason) => {
      cancellation.cancel(reason);
      memoryManager.releaseAll();
      await cleanup.closeAll(reason);
    },
  });

  const extensionHost = new ExtensionHost();
  const runtimeEventsStore = new InMemoryEventStore();
  const runId = `run-${Date.now()}`;
  const runtimeEvents = new McpSkillRuntime(
    input.projectConfig.interop ?? {
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
      new FileEventExportSink(join(cwd, ".planning", "runs", "latest", "warnings.jsonl")),
    ]),
  );

  extensionHost.loadBuiltins([
    {
      path: "src/extensions/tools/guarded-shell.extension.ts",
      register: guardedShellExtension.register,
    },
    {
      path: "src/extensions/tools/workspace-file-write.extension.ts",
      register: workspaceFileWriteExtension.register,
    },
    { path: "src/extensions/tools/web-search.extension.ts", register: webSearchExtension.register },
    { path: "src/extensions/tools/web-fetch.extension.ts", register: webFetchExtension.register },
  ]);

  const configFilePath = input.loadedConfig.path ?? join(cwd, "rlm.config.yaml");
  const configuredExtensions = input.projectConfig.extensions?.load ?? [];
  if (configuredExtensions.length > 0) {
    const configuredAllowlist = input.projectConfig.extensions?.allowlist;
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

  recordStage("plugins");

  const interopTools = [
    createSkillTool(runtimeEvents),
    ...(await createMcpTools(
      input.projectConfig.interop?.mcp.servers ?? [],
      runtimeEvents,
      (child) => {
        cleanup.track({
          close: async () => {
            child.kill();
          },
        });
      },
    )),
  ];

  for (const tool of interopTools) {
    extensionHost.tools.register(tool);
  }

  recordStage("interop");

  const toolsFor = createToolsResolver({
    projectConfig: input.projectConfig,
    extensionHost,
    interopTools,
  });

  recordStage("tools-resolver");

  const runStateStore = new FileRunStateStore({
    baseDir: join(cwd, ".planning", "runs"),
  });
  const runState = {
    runId,
    store: runStateStore,
    actor: "runtime",
    capabilityToken: `${runId}:runtime`,
  };

  await input.memoryStore.patchScope({
    sessionId: runId,
    scopeId: "run-manifest",
    actor: "runtime",
    expectedVersion: 0,
    allowedScopes: ["run-manifest"],
    writes: ["memory updates"],
    patch: {
      runId,
      promptPreview: cliOptions.prompt.slice(0, 240),
      createdAt: new Date().toISOString(),
    },
    lifetime: "session",
  });

  const existingPreferences = await input.memoryStore.readScope(runId, "project-preferences");
  if (!existingPreferences) {
    await input.memoryStore.patchScope({
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

  const vectorIndex = new FileVectorIndex({
    path: join(cwd, ".rlm", "memory", "vector-index.json"),
  });
  const embeddingModel = new OllamaEmbeddingModel({
    ...(cliOptions.baseUrl ? { baseUrl: cliOptions.baseUrl } : {}),
    ...(process.env.RLM_EMBED_MODEL ? { model: process.env.RLM_EMBED_MODEL } : {}),
  });

  const createMemoryForRun = (sessionId: string): MemoryResolver =>
    new MemoryResolver(
      input.memoryStore,
      { sessionId },
      new SemanticMemoryIndex({
        sessionId,
        store: input.memoryStore,
        embeddings: embeddingModel,
        index: vectorIndex,
      }),
    );

  const memoryRef: { current: MemoryResolver } = {
    current: createMemoryForRun(runId),
  };

  logger?.log({
    stage: "interop",
    message: "mcp+skill runtime initialized",
    data: {
      mcpServers: input.projectConfig.interop?.mcp.servers.length ?? 0,
      skillSearchPaths: runtimeEvents.getSkillSearchPaths(),
      skillCache: runtimeEvents.isSkillCacheEnabled(),
    },
  });

  const registry = createAgentRegistry({
    defaultTools: toolsFor("default"),
    researchTools: toolsFor("research"),
    codingTools: toolsFor("coding"),
    qaTools: input.projectConfig.agents["qa"] ? toolsFor("qa") : toolsFor("coding"),
    productDesignerTools: toolsFor("product_designer"),
    agentConfigs: input.projectConfig.agents,
  });

  recordStage("agent-registry");

  const createdModels = new Map<string, LanguageModelPort>();

  const createModel = createModelFactory({
    modelCache: createdModels,
    baseUrlOverride: cliOptions.baseUrl,
    trackCleanup: (model) => cleanup.track(model),
  });

  recordStage("models");

  return {
    cwd,
    options: cliOptions,
    loadedConfig: input.loadedConfig,
    projectConfig: input.projectConfig,
    runtimeConfig: input.runtimeConfig,
    sessionStore: input.sessionStore,
    memoryStore: input.memoryStore,
    logger,
    cleanup,
    memoryManager,
    cancellation,
    execution,
    shutdown,
    extensionHost,
    interopTools,
    toolsFor,
    runtimeEvents,
    runStateStore,
    runState,
    vectorIndex,
    embeddingModel,
    createMemoryForRun,
    memoryRef,
    registry,
    createdModels,
    createModel,
  };
}
