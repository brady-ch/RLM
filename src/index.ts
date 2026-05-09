#!/usr/bin/env node
import { OllamaLanguageModelAdapter } from "./adapters/ollama-language-model.js";
import { GuardedShellTool } from "./adapters/guarded-shell-tool.js";
import { WebSearchTool } from "./adapters/web-search-tool.js";
import { WebFetchTool } from "./adapters/web-fetch-tool.js";
import { WorkspaceFileWriteTool } from "./adapters/workspace-file-write-tool.js";
import { runConfiguredAgent } from "./application/agent-runner.js";
import { createAgentRegistry, selectAgent } from "./application/agent-registry.js";
import { MemoryManager } from "./application/memory-manager.js";
import { applyModelOverride, loadProjectConfig, resolveRuntimeConfig } from "./application/project-config.js";
import { ResourceCleanup } from "./application/resource-cleanup.js";
import { runWorkflow } from "./application/workflow-runner.js";
import { CancellationController, createExecutionControl, createInteractiveExecutionSession } from "./application/execution-controller.js";
import { startControlServer } from "./application/control-server.js";
import { helpText, parseArgs } from "./cli/args.js";
import { renderResult } from "./cli/render.js";
import { createStderrRuntimeLogger } from "./cli/runtime-logger.js";
import { installShutdownHandlers } from "./cli/shutdown.js";
import type { LanguageModelPort } from "./ports/language-model-port.js";
import type { ToolPort } from "./ports/tool-port.js";
import type { ExecutionEvent, RecursivePromptResult } from "./domain/types.js";
import { join } from "node:path";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "help") {
    console.log(helpText());
    return;
  }

  const loadedConfig = await loadProjectConfig(options.configPath);
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
  const shellTool = new GuardedShellTool({
    workspaceRoot: process.cwd(),
  });
  const writeFileTool = new WorkspaceFileWriteTool({
    workspaceRoot: process.cwd(),
  });
  const webSearchTool = new WebSearchTool();
  const webFetchTool = new WebFetchTool();
  const toolsByName = new Map<string, ToolPort>([
    [shellTool.name, shellTool],
    [writeFileTool.name, writeFileTool],
    [webSearchTool.name, webSearchTool],
    [webFetchTool.name, webFetchTool],
  ]);
  const toolsFor = (agentId: string) => {
    const agentConfig = projectConfig.agents[agentId];
    if (!agentConfig) {
      throw new Error(`Missing configuration for agent "${agentId}".`);
    }

    return agentConfig.tools.map((toolName) => {
      const tool = toolsByName.get(toolName);
      if (!tool) {
        throw new Error(`Agent "${agentId}" references unknown tool "${toolName}".`);
      }

      return tool;
    });
  };
  const registry = createAgentRegistry({
    defaultTools: toolsFor("default"),
    researchTools: toolsFor("research"),
    codingTools: toolsFor("coding"),
    qaTools: projectConfig.agents["qa"] ? toolsFor("qa") : toolsFor("coding"),
    productDesignerTools: toolsFor("product_designer"),
    agentConfigs: projectConfig.agents,
  });
  const createdModels = new Map<string, LanguageModelPort>();
  const createModel = (model: string) => {
    const existing = createdModels.get(model);
    if (existing) {
      return existing;
    }

    const modelOptions: ConstructorParameters<typeof OllamaLanguageModelAdapter>[0] = {
      model,
    };
    if (options.baseUrl) {
      modelOptions.baseUrl = options.baseUrl;
    }

    const created = new OllamaLanguageModelAdapter(modelOptions);
    createdModels.set(model, cleanup.track(created));
    return created;
  };
  try {
    if (options.command === "ui") {
      const session = createInteractiveExecutionSession();
      const uiDistDir = join(process.cwd(), "ui", "dist");
      const server = await startControlServer({
        session,
        port: options.uiPort,
        uiDistDir,
      });
      cleanup.track({
        close: () => server.close(),
      });
      console.error(`RLM UI listening at ${server.url}`);
      const uiExecution = session.control;
      const result = options.workflow
        ? await runWorkflow({
          workflowId: options.workflow,
          prompt: options.prompt,
          config: runtimeConfig,
          projectConfig,
          registry,
          memoryManager,
          createModel,
          logger,
          execution: uiExecution,
        })
        : await runConfiguredAgent({
          prompt: options.prompt,
          config: runtimeConfig,
          projectConfig,
          agent: selectAgent(registry, options.prompt, options.agent),
          agentSource: options.agent ? "override" : "auto",
          memoryManager,
          createModel,
          logger,
          execution: uiExecution,
        });
      if (loadedConfig.path) {
        result.metadata.configPath = loadedConfig.path;
      }
      console.log(renderResult(result, {
        compact: options.compact,
        json: options.json,
        includeTrace: options.trace,
        model: projectConfig.models.default,
      }));
      setExitCodeIfRunFailed(result);
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
      })
      : await runConfiguredAgent({
        prompt: runInputBase.prompt,
        config: runInputBase.config,
        projectConfig: runInputBase.projectConfig,
        agent: selectAgent(registry, options.prompt, options.agent),
        agentSource: options.agent ? "override" : "auto",
        memoryManager: runInputBase.memoryManager,
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
          execution: executeControl,
        })
        : await runConfiguredAgent({
          prompt: runInputBase.prompt,
          config: runInputBase.config,
          projectConfig: runInputBase.projectConfig,
          agent: selectAgent(registry, options.prompt, options.agent),
          agentSource: options.agent ? "override" : "auto",
          memoryManager: runInputBase.memoryManager,
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
