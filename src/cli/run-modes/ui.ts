import { createInteractiveExecutionSession } from "../../application/execution-controller.js";
import { PurposeRoutingLanguageModel } from "../../application/model-provider.js";
import { ModelLibraryService } from "../../application/model-library.js";
import {
  restoreSessionMemory,
  restoreGraphWorkflowMetadata,
} from "../../application/session-memory-bridge.js";
import {
  resolveHostConfig,
  resolveRuntimeHostSelection,
} from "../../application/project-config.js";
import { createUiExecutionRunner } from "../../application/ui-execution-runner.js";
import { selectAgent } from "../../application/agent-registry.js";
import {
  buildStartControlServerInput,
  startControlServer,
  type SessionRuntimeRef,
} from "../../application/control-server/index.js";
import { createPluginRegistryService } from "../../application/plugins/index.js";
import { resolveUiDistDir } from "../ui-dist-dir.js";
import type { RuntimeContext } from "../../application/bootstrap/types.js";

/**
 * @param entryPath Absolute path of the CLI entry file (typically `dist/src/index.js`).
 * Passed explicitly so ui-dist inference matches packaged layout (`dist/src/...` depth).
 */
export async function runUiMode(ctx: RuntimeContext, entryPath: string): Promise<void> {
  const {
    options,
    registry,
    createModel,
    projectConfig,
    runtimeConfig,
    loadedConfig,
    sessionStore,
    memoryStore,
    vectorIndex,
    cleanup,
    runState,
    memoryRef,
    createMemoryForRun,
    memoryManager,
    logger,
  } = ctx;

  let runId = ctx.runState.runId;

  const createPurposeRoutingModel = (): PurposeRoutingLanguageModel =>
    new PurposeRoutingLanguageModel({
      config: projectConfig,
      agent: selectAgent(registry, options.prompt, options.agent).config,
      hostSelection: resolveRuntimeHostSelection(projectConfig, {
        cliHostId: options.host,
        env: process.env,
      }),
      createModel,
      logger,
    });

  const session = createInteractiveExecutionSession({
    seedRootPrompt: options.prompt,
    planModel: createPurposeRoutingModel(),
  });

  if (options.openSession) {
    const saved = await sessionStore.load(options.openSession);
    if (saved.verification.status !== "complete") {
      console.error(
        `Saved session ${saved.id} has ${saved.verification.status} verification; unsafe continuation is blocked.`,
      );
      process.exitCode = 1;
      return;
    }
    runId = await restoreSessionMemory({
      payload: saved.payload,
      memoryStore,
      vectorIndex,
    });
    ctx.runState.runId = runId;
    ctx.runState.capabilityToken = `${runId}:runtime`;
    memoryRef.current = createMemoryForRun(runId);
    session.restoreSnapshot(saved.payload.session as ReturnType<typeof session.snapshot>);
    const metadataRestore = restoreGraphWorkflowMetadata(saved.payload);
    session.setGraphWorkflowMetadata(metadataRestore.metadata);
  }

  const sessionRuntime: SessionRuntimeRef = {
    getRunId: () => runId,
    setRunId: (nextRunId) => {
      runId = nextRunId;
      ctx.runState.runId = nextRunId;
      ctx.runState.capabilityToken = `${nextRunId}:runtime`;
    },
    memoryStore,
    vectorIndex,
    getMemory: () => memoryRef.current,
    setMemory: (memory) => {
      memoryRef.current = memory;
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
    resolveMemory: () => memoryRef.current,
  });
  const uiDistDir = resolveUiDistDir(entryPath, process.env);
  const pluginRegistry = createPluginRegistryService({
    projectRoot: ctx.cwd,
    loadedConfig,
  });
  const server = await startControlServer(
    buildStartControlServerInput(ctx, {
      session,
      port: options.uiPort,
      uiDistDir,
      modelLibrary,
      memory: memoryRef.current,
      sessionRuntime,
      pluginRegistry,
      onConfirmRun: (activeSession) => uiRunner.start(activeSession),
    }),
  );
  cleanup.track({
    close: () => server.close(),
  });
  console.error(`RLM UI listening at ${server.url}`);
  await new Promise<void>(() => {
    // UI mode keeps the control server alive.
  });
}
