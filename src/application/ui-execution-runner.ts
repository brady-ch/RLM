import type { AgentProfile } from "../domain/agents.js";
import type { RecursiveModelConfig, RuntimeMemory, RuntimeRunState } from "../domain/types.js";
import type { LanguageModelPort } from "../ports/language-model-port.js";
import type { RuntimeLogger } from "../ports/runtime-logger-port.js";
import { executeGraph } from "./graph-executor.js";
import type { InteractiveExecutionSession } from "./execution-controller.js";
import type { AgentRegistry } from "./agent-registry.js";
import { MemoryManager } from "./memory-manager.js";
import type { ModelRuntimeSelection } from "./model-provider.js";
import type { ProjectConfig } from "./project-config.js";

export interface UiExecutionRunnerInput {
  projectConfig: ProjectConfig;
  runtimeConfig: RecursiveModelConfig;
  configPath?: string | undefined;
  registry: AgentRegistry;
  selectAgent?: (prompt: string) => AgentProfile;
  agentSource: "auto" | "override";
  memoryManager: MemoryManager;
  hostId?: string | undefined;
  createModel: (model: string, runtime: ModelRuntimeSelection) => LanguageModelPort;
  logger?: RuntimeLogger | undefined;
  runState?: RuntimeRunState | undefined;
  resolveMemory?: () => RuntimeMemory | undefined;
  memory?: RuntimeMemory | undefined;
}

export interface UiExecutionRunner {
  start(session: InteractiveExecutionSession): Promise<void>;
  isRunning(): boolean;
}

export function resolveSessionRootPrompt(session: InteractiveExecutionSession): string {
  const nodes = session.snapshot().graph.nodes;
  const roots = nodes.filter((node) => !node.parentId);
  const preferred = roots.find((node) => node.id === "root-composer") ?? roots[0];
  return (preferred?.prompt ?? preferred?.label ?? "").trim();
}

export function createUiExecutionRunner(input: UiExecutionRunnerInput): UiExecutionRunner {
  let activeRun: Promise<void> | undefined;

  return {
    isRunning(): boolean {
      return activeRun !== undefined;
    },
    async start(session: InteractiveExecutionSession): Promise<void> {
      if (activeRun) {
        return;
      }

      const graph = session.snapshot().graph;
      if (graph.nodes.length === 0) {
        input.logger?.log({
          stage: "ui",
          message: "skipped ui execution: empty graph",
        });
        return;
      }

      session.beginConfirmedExecution();
      activeRun = (async () => {
        try {
          input.logger?.log({
            stage: "ui",
            message: "graph execution started",
            data: { nodeCount: graph.nodes.length },
          });
          await executeGraph(session, {
            projectConfig: input.projectConfig,
            runtimeConfig: input.runtimeConfig,
            configPath: input.configPath,
            registry: input.registry,
            agentSource: input.agentSource,
            memoryManager: input.memoryManager,
            hostId: input.hostId,
            createModel: input.createModel,
            logger: input.logger,
            runState: input.runState,
            ...(input.resolveMemory ? { resolveMemory: input.resolveMemory } : {}),
            ...(input.memory ? { memory: input.memory } : {}),
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          input.logger?.log({
            stage: "ui",
            message: "ui execution failed",
            data: { error: message },
          });
        } finally {
          session.finishConfirmedExecution();
          activeRun = undefined;
        }
      })();
      await activeRun;
    },
  };
}
