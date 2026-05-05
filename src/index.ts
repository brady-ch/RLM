#!/usr/bin/env node
import { OllamaLanguageModelAdapter } from "./adapters/ollama-language-model.js";
import { GuardedShellTool } from "./adapters/guarded-shell-tool.js";
import { SerpApiGoogleSearchTool } from "./adapters/serpapi-google-search-tool.js";
import { WorkspaceFileWriteTool } from "./adapters/workspace-file-write-tool.js";
import { runConfiguredAgent } from "./application/agent-runner.js";
import { createAgentRegistry, selectAgent } from "./application/agent-registry.js";
import { MemoryManager } from "./application/memory-manager.js";
import { applyModelOverride, loadProjectConfig } from "./application/project-config.js";
import { runWorkflow } from "./application/workflow-runner.js";
import { helpText, parseArgs } from "./cli/args.js";
import { renderResult } from "./cli/render.js";
import type { ToolPort } from "./ports/tool-port.js";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "help") {
    console.log(helpText());
    return;
  }

  const loadedConfig = await loadProjectConfig(options.configPath);
  const projectConfig = applyModelOverride(loadedConfig.config, options.model);
  const memoryManager = new MemoryManager({
    config: projectConfig.memory,
  });
  const shellTool = new GuardedShellTool({
    workspaceRoot: process.cwd(),
  });
  const writeFileTool = new WorkspaceFileWriteTool({
    workspaceRoot: process.cwd(),
  });
  const googleSearchTool = new SerpApiGoogleSearchTool();
  const toolsByName = new Map<string, ToolPort>([
    [shellTool.name, shellTool],
    [writeFileTool.name, writeFileTool],
    [googleSearchTool.name, googleSearchTool],
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
    productDesignerTools: toolsFor("product_designer"),
    agentConfigs: projectConfig.agents,
  });
  const createModel = (model: string) => {
    const modelOptions: ConstructorParameters<typeof OllamaLanguageModelAdapter>[0] = {
      model,
    };
    if (options.baseUrl) {
      modelOptions.baseUrl = options.baseUrl;
    }

    return new OllamaLanguageModelAdapter(modelOptions);
  };
  const result = options.workflow
    ? await runWorkflow({
      workflowId: options.workflow,
      prompt: options.prompt,
      config: options.config,
      projectConfig,
      registry,
      memoryManager,
      createModel,
    })
    : await runConfiguredAgent({
      prompt: options.prompt,
      config: options.config,
      projectConfig,
      agent: selectAgent(registry, options.prompt, options.agent),
      agentSource: options.agent ? "override" : "auto",
      memoryManager,
      createModel,
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
