#!/usr/bin/env node
import { OllamaLanguageModelAdapter } from "./adapters/ollama-language-model.js";
import { GuardedShellTool } from "./adapters/guarded-shell-tool.js";
import { SerpApiGoogleSearchTool } from "./adapters/serpapi-google-search-tool.js";
import { WebFetchTool } from "./adapters/web-fetch-tool.js";
import { WorkspaceFileWriteTool } from "./adapters/workspace-file-write-tool.js";
import { runConfiguredAgent } from "./application/agent-runner.js";
import { createAgentRegistry, selectAgent } from "./application/agent-registry.js";
import { MemoryManager } from "./application/memory-manager.js";
import { applyModelOverride, loadProjectConfig, resolveRuntimeConfig } from "./application/project-config.js";
import { ResourceCleanup } from "./application/resource-cleanup.js";
import { runWorkflow } from "./application/workflow-runner.js";
import { helpText, parseArgs } from "./cli/args.js";
import { renderResult } from "./cli/render.js";
import { createStderrRuntimeLogger } from "./cli/runtime-logger.js";
import { installShutdownHandlers } from "./cli/shutdown.js";
import type { LanguageModelPort } from "./ports/language-model-port.js";
import type { ToolPort } from "./ports/tool-port.js";

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
  const shutdown = installShutdownHandlers({
    json: options.json,
    logger,
    cleanup: async (reason) => {
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
  const googleSearchTool = new SerpApiGoogleSearchTool();
  const webFetchTool = new WebFetchTool();
  const toolsByName = new Map<string, ToolPort>([
    [shellTool.name, shellTool],
    [writeFileTool.name, writeFileTool],
    [googleSearchTool.name, googleSearchTool],
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
      });
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
