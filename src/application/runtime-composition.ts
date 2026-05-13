import { constants } from "node:fs";
import { access } from "node:fs/promises";
import type { ExtensionHost } from "./extension-host.js";
import type { ModelRuntimeSelection } from "./model-provider.js";
import type { ProjectConfig } from "./project-config.js";
import { HttpLanguageModelAdapter } from "../adapters/http-language-model.js";
import { OllamaLanguageModelAdapter } from "../adapters/ollama-language-model.js";
import type { LanguageModelPort } from "../ports/language-model-port.js";
import type { ToolPort } from "../ports/tool-port.js";

type ClosableLanguageModel = LanguageModelPort & { close(): Promise<void> };

export async function readablePath(pathLike: string): Promise<boolean> {
  try {
    await access(pathLike, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function createToolsResolver(input: {
  projectConfig: ProjectConfig;
  extensionHost: ExtensionHost;
  interopTools: ToolPort[];
}): (agentId: string) => ToolPort[] {
  return (agentId: string) => {
    const agentConfig = input.projectConfig.agents[agentId];
    if (!agentConfig) {
      throw new Error(`Missing configuration for agent "${agentId}".`);
    }

    const configuredTools = agentConfig.tools.map((toolName) => {
      const tool = input.extensionHost.tools.get(toolName);
      if (!tool) {
        throw new Error(`Agent "${agentId}" references unknown tool "${toolName}".`);
      }

      return tool;
    });
    const configuredNames = new Set(configuredTools.map((tool) => tool.name));
    return [
      ...configuredTools,
      ...input.interopTools.filter((tool) => !configuredNames.has(tool.name)),
    ];
  };
}

export function createModelFactory(input: {
  modelCache: Map<string, LanguageModelPort>;
  baseUrlOverride?: string | undefined;
  trackCleanup: (model: ClosableLanguageModel) => void;
}): (model: string, runtime: ModelRuntimeSelection) => LanguageModelPort {
  return (model: string, runtime: ModelRuntimeSelection) => {
    const modelKey = `${runtime.hostId}:${model}`;
    const existing = input.modelCache.get(modelKey);
    if (existing) {
      return existing;
    }

    const effectiveBaseUrl = input.baseUrlOverride ?? runtime.baseUrl;
    const created = runtime.hostKind === "http"
      ? new HttpLanguageModelAdapter({ model, baseUrl: effectiveBaseUrl })
      : new OllamaLanguageModelAdapter({ model, baseUrl: effectiveBaseUrl });
    input.trackCleanup(created);
    input.modelCache.set(modelKey, created);
    return created;
  };
}
