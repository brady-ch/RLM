import type { AgentProfile } from "../domain/agents.js";
import type { RecursiveModelConfig, RuntimeMemory } from "../domain/types.js";
import type { LanguageModelPort } from "../ports/language-model-port.js";
import type { RuntimeLogger } from "../ports/runtime-logger-port.js";
import { runConfiguredAgent } from "./agent-runner.js";
import type { InteractiveExecutionSession } from "./execution-controller.js";
import { MemoryManager } from "./memory-manager.js";
import type { ModelRuntimeSelection } from "./model-provider.js";
import type { ProjectConfig } from "./project-config.js";

export interface UiExecutionRunnerInput {
  projectConfig: ProjectConfig;
  runtimeConfig: RecursiveModelConfig;
  configPath?: string | undefined;
  selectAgent: (prompt: string) => AgentProfile;
  agentSource: "auto" | "override";
  memoryManager: MemoryManager;
  hostId?: string | undefined;
  createModel: (model: string, runtime: ModelRuntimeSelection) => LanguageModelPort;
  logger?: RuntimeLogger | undefined;
  runState?: Parameters<typeof runConfiguredAgent>[0]["runState"];
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

      const prompt = resolveSessionRootPrompt(session);
      if (!prompt) {
        input.logger?.log({
          stage: "ui",
          message: "skipped ui execution: empty root prompt",
        });
        return;
      }

      session.beginConfirmedExecution();
      const agent = input.selectAgent(prompt);
      activeRun = (async () => {
        try {
          await runConfiguredAgent({
            prompt,
            config: input.runtimeConfig,
            projectConfig: input.projectConfig,
            configPath: input.configPath,
            agent,
            agentSource: input.agentSource,
            hostId: input.hostId,
            memoryManager: input.memoryManager,
            createModel: input.createModel,
            logger: input.logger,
            execution: session.control,
            runState: input.runState,
            memory: input.resolveMemory?.() ?? input.memory,
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
