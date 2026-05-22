import type {
  FileMemoryStore,
  FileRunStateStore,
  FileSessionStore,
  FileVectorIndex,
  OllamaEmbeddingModel,
} from "./adapters.js";
import type { CliOptions } from "../../cli/args.js";
import type { ShutdownController } from "../../cli/shutdown.js";
import type { RecursiveModelConfig, ExecutionControl } from "../../domain/types.js";
import type { LanguageModelPort } from "../../ports/language-model-port.js";
import type { RuntimeLogger } from "../../ports/runtime-logger-port.js";
import type { ToolPort } from "../../ports/tool-port.js";
import type { AgentRegistry } from "../agent-registry.js";
import type { ExtensionHost } from "../extension-host.js";
import type { MemoryManager } from "../memory-manager.js";
import type { MemoryResolver } from "../memory-resolver.js";
import type { McpSkillRuntime } from "../mcp-skill-runtime.js";
import type { ModelRuntimeSelection } from "../model-provider.js";
import type { LoadedProjectConfig, ProjectConfig } from "../project-config.js";
import type { ResourceCleanup } from "../resource-cleanup.js";
import type { CancellationController } from "../execution-controller.js";

export type BuildRuntimeContextInput = {
  options: CliOptions;
  loadedConfig: LoadedProjectConfig;
  projectConfig: ProjectConfig;
  runtimeConfig: RecursiveModelConfig;
  sessionStore: FileSessionStore;
  memoryStore: FileMemoryStore;
  cwd?: string | undefined;
};

export type RuntimeContext = {
  cwd: string;
  options: CliOptions;
  loadedConfig: LoadedProjectConfig;
  projectConfig: ProjectConfig;
  runtimeConfig: RecursiveModelConfig;
  sessionStore: FileSessionStore;
  memoryStore: FileMemoryStore;
  logger: RuntimeLogger | undefined;
  cleanup: ResourceCleanup;
  memoryManager: MemoryManager;
  cancellation: CancellationController;
  execution: ExecutionControl;
  shutdown: ShutdownController;
  extensionHost: ExtensionHost;
  interopTools: ToolPort[];
  toolsFor: (agentId: string) => ToolPort[];
  runtimeEvents: McpSkillRuntime;
  runStateStore: FileRunStateStore;
  runState: {
    runId: string;
    store: FileRunStateStore;
    actor: string;
    capabilityToken: string;
  };
  vectorIndex: FileVectorIndex;
  embeddingModel: OllamaEmbeddingModel;
  createMemoryForRun: (sessionId: string) => MemoryResolver;
  memoryRef: { current: MemoryResolver };
  registry: AgentRegistry;
  createdModels: Map<string, LanguageModelPort>;
  createModel: (model: string, runtime: ModelRuntimeSelection) => LanguageModelPort;
};
