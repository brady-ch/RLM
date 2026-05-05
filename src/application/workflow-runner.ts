import type { AgentRegistry } from "./agent-registry.js";
import type { ProjectConfig } from "./project-config.js";
import type { RecursiveModelConfig, RecursivePromptResult, TraceEvent } from "../domain/types.js";
import type { LanguageModelPort } from "../ports/language-model-port.js";
import { MemoryManager } from "./memory-manager.js";
import { runConfiguredAgent } from "./agent-runner.js";

export interface RunWorkflowInput {
  workflowId: string;
  prompt: string;
  config: RecursiveModelConfig;
  projectConfig: ProjectConfig;
  configPath?: string | undefined;
  registry: AgentRegistry;
  memoryManager: MemoryManager;
  baseUrl?: string | undefined;
  createModel: (model: string) => LanguageModelPort;
}

export async function runWorkflow(input: RunWorkflowInput): Promise<RecursivePromptResult> {
  const workflow = input.projectConfig.workflows[input.workflowId];
  if (!workflow) {
    throw new Error(`Unknown workflow "${input.workflowId}". Available workflows: ${Object.keys(input.projectConfig.workflows).join(", ")}`);
  }

  const agents = workflow.agents.map((agentId) => {
    const agent = input.registry.profiles.find((profile) => profile.id === agentId);
    if (!agent) {
      throw new Error(`Workflow "${input.workflowId}" references unavailable agent "${agentId}".`);
    }

    return agent;
  });

  const settled = await Promise.allSettled(
    agents.map((agent) => runConfiguredAgent({
      prompt: input.prompt,
      config: input.config,
      projectConfig: input.projectConfig,
      configPath: input.configPath,
      agent,
      agentSource: "auto",
      baseUrl: input.baseUrl,
      memoryManager: input.memoryManager,
      createModel: input.createModel,
    })),
  );

  const errors: string[] = [];
  const successfulResults: RecursivePromptResult[] = [];
  for (let index = 0; index < settled.length; index += 1) {
    const result = settled[index];
    if (!result) {
      continue;
    }

    if (result.status === "fulfilled") {
      successfulResults[index] = result.value;
      continue;
    }

    const agentId = agents[index]?.id ?? `agent-${index + 1}`;
    const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
    errors.push(`${agentId}: ${message}`);
    if (!workflow.continueOnError) {
      throw new Error(`Workflow "${input.workflowId}" failed: ${errors.join("; ")}`);
    }
  }

  return combineWorkflowResults(input.workflowId, agents.map((agent) => agent.id), successfulResults.filter(Boolean), errors);
}

function combineWorkflowResults(
  workflowId: string,
  agents: string[],
  results: RecursivePromptResult[],
  errors: string[],
): RecursivePromptResult {
  const trace: TraceEvent[] = results.flatMap((result) => result.trace);
  const answer = results.map((result) => `## ${result.metadata.agent.id}\n${result.answer}`).join("\n\n");
  const first = results[0];

  const metadata: RecursivePromptResult["metadata"] = {
    agent: {
      id: "workflow",
      source: "auto",
    },
    workflow: {
      id: workflowId,
      agents,
    },
    depth: first?.metadata.depth ?? {
      selected: 0,
      source: "fallback",
    },
    modelSelections: results.flatMap((result) => result.metadata.modelSelections),
    memoryReservations: results.flatMap((result) => result.metadata.memoryReservations),
    toolCalls: results.flatMap((result) => result.metadata.toolCalls),
    errors: [
      ...results.flatMap((result) => result.metadata.errors),
      ...errors,
    ],
  };
  if (first?.metadata.configPath) {
    metadata.configPath = first.metadata.configPath;
  }

  return {
    answer,
    trace,
    metadata,
  };
}
