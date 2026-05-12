import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AgentRegistry } from "./agent-registry.js";
import type { AgentProfile } from "../domain/agents.js";
import type { ProjectConfig } from "./project-config.js";
import type {
  ExecutionControl,
  ExecutionGraphNode,
  ExecutionStatus,
  RecursiveModelConfig,
  RecursivePromptResult,
  TraceEvent,
  ValidationCommandResult,
  WorkflowTaskQueue,
  WorkflowTaskQueueItem,
} from "../domain/types.js";
import type { LanguageModelPort } from "../ports/language-model-port.js";
import type { ModelRuntimeSelection } from "./model-provider.js";
import { MemoryManager } from "./memory-manager.js";
import { estimatePromptDepth, runConfiguredAgent } from "./agent-runner.js";
import type { RuntimeLogger } from "../ports/runtime-logger-port.js";
import type { RuntimeRunState } from "../domain/types.js";

const execFileAsync = promisify(execFile);

export interface RunWorkflowInput {
  workflowId: string;
  prompt: string;
  config: RecursiveModelConfig;
  projectConfig: ProjectConfig;
  configPath?: string | undefined;
  registry: AgentRegistry;
  memoryManager: MemoryManager;
  baseUrl?: string | undefined;
  hostId?: string | undefined;
  createModel: (model: string, runtime: ModelRuntimeSelection) => LanguageModelPort;
  runValidationCommand?: ((command: string) => Promise<ValidationCommandResult>) | undefined;
  logger?: RuntimeLogger | undefined;
  execution?: ExecutionControl | undefined;
  runState?: RuntimeRunState | undefined;
}

export async function runWorkflow(input: RunWorkflowInput): Promise<RecursivePromptResult> {
  const workflow = input.projectConfig.workflows[input.workflowId];
  if (!workflow) {
    throw new Error(`Unknown workflow "${input.workflowId}". Available workflows: ${Object.keys(input.projectConfig.workflows).join(", ")}`);
  }

  const dispatch = selectWorkflowDispatch(workflow, input.prompt);
  const agents = dispatch.agents.map((agentId) => {
    const agent = input.registry.profiles.find((profile) => profile.id === agentId);
    if (!agent) {
      throw new Error(`Workflow "${input.workflowId}" references unavailable agent "${agentId}".`);
    }

    return agent;
  });
  input.logger?.log({
    stage: "workflow",
    message: "starting workflow",
    data: {
      workflow: input.workflowId,
      dispatchTier: dispatch.tierName,
      estimatedDepth: dispatch.estimatedDepth,
      agents: agents.map((agent) => agent.id),
      qaAgent: dispatch.qa?.agent,
    },
  });
  input.execution?.onEvent?.({
    type: "execution",
    status: input.execution.planOnly ? "planned" : "running",
    message: `workflow ${input.workflowId} ${input.execution.planOnly ? "planned" : "started"}`,
  });

  if (input.execution?.planOnly) {
    const planSlots = buildWorkflowGraphSlots(agents, dispatch.qa, "ready");
    return combineWorkflowResults(
      input.workflowId,
      planSlots,
      [],
      [],
      dispatch.qa
        ? {
          agent: dispatch.qa.agent,
          validationCommands: [],
        }
        : undefined,
      [],
      "planned",
      input.config.maxModelCalls,
      input.config.maxToolRounds,
    );
  }

  const settled = await Promise.allSettled(
    agents.map((agent) => {
      input.logger?.log({
        stage: "workflow",
        message: "dispatching workflow agent",
        data: {
          workflow: input.workflowId,
          agent: agent.id,
        },
      });
      return runConfiguredAgent({
        prompt: input.prompt,
        config: input.config,
        projectConfig: input.projectConfig,
        configPath: input.configPath,
        agent,
        agentSource: "auto",
        baseUrl: input.baseUrl,
        hostId: input.hostId,
        memoryManager: input.memoryManager,
        createModel: input.createModel,
        logger: input.logger,
        execution: input.execution,
        runState: input.runState,
      });
    }),
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
      input.logger?.log({
        stage: "workflow",
        message: "workflow agent completed",
        data: {
          workflow: input.workflowId,
          agent: agents[index]?.id,
          modelCalls: result.value.metadata.modelCalls,
          toolCalls: result.value.metadata.toolCalls.length,
        },
      });
      continue;
    }

    const agentId = agents[index]?.id ?? `agent-${index + 1}`;
    const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
    input.logger?.log({
      stage: "workflow",
      message: "workflow agent failed",
      data: {
        workflow: input.workflowId,
        agent: agentId,
        error: message,
      },
    });
    errors.push(`${agentId}: ${message}`);
    if (!workflow.continueOnError) {
      throw new Error(`Workflow "${input.workflowId}" failed: ${errors.join("; ")}`);
    }
  }

  const validationResults = dispatch.qa
    ? await runValidationCommands(dispatch.qa.validationCommands, input.runValidationCommand, input.logger)
    : [];
  for (const validation of validationResults) {
    if (validation.status === "error") {
      errors.push(`validation ${validation.command}: ${validation.output}`);
    }
  }

  const graphSlots = buildWorkflowGraphSlots(agents, dispatch.qa, "completed");
  if (dispatch.qa && validationResults.some((v) => v.status === "error")) {
    const qaSlot = graphSlots[graphSlots.length - 1];
    if (qaSlot) {
      qaSlot.terminalStatus = "failed";
    }
  }

  let qaResult: RecursivePromptResult | undefined;
  let qaRejected = false;
  if (dispatch.qa) {
    try {
      qaResult = await runConfiguredAgent({
        prompt: buildQaPrompt(input.prompt, successfulResults.filter(Boolean), validationResults),
        config: input.config,
        projectConfig: input.projectConfig,
        configPath: input.configPath,
        agent: findWorkflowAgent(input.registry, input.workflowId, dispatch.qa.agent),
        agentSource: "auto",
        baseUrl: input.baseUrl,
        hostId: input.hostId,
        memoryManager: input.memoryManager,
        createModel: input.createModel,
        logger: input.logger,
        execution: input.execution,
        runState: input.runState,
      });
    } catch (error: unknown) {
      qaRejected = true;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${dispatch.qa.agent}: ${message}`);
      if (!workflow.continueOnError) {
        throw new Error(`Workflow "${input.workflowId}" failed: ${errors.join("; ")}`);
      }
    }
  }
  if (qaResult) {
    successfulResults.push(qaResult);
  }

  const queues = dispatch.qa
    ? [buildBugfixQueue(dispatch.qa.bugfixQueue, qaResult?.answer ?? "", dispatch.qa.agent)]
    : [];

  for (let index = 0; index < settled.length; index += 1) {
    const slot = graphSlots[index];
    const outcome = settled[index];
    if (!slot || !outcome) {
      continue;
    }

    if (outcome.status === "rejected") {
      slot.terminalStatus = "failed";
      continue;
    }

    const value = outcome.value;
    if (value.metadata.errors.length > 0 || value.metadata.executionStatus === "failed") {
      slot.terminalStatus = "failed";
    }
  }

  if (dispatch.qa) {
    const qaIndex = graphSlots.length - 1;
    const qaSlot = graphSlots[qaIndex];
    if (qaSlot) {
      if (qaRejected || !qaResult) {
        qaSlot.terminalStatus = "failed";
      } else if (qaResult.metadata.errors.length > 0 || qaResult.metadata.executionStatus === "failed") {
        qaSlot.terminalStatus = "failed";
      }
    }
  }

  const combined = combineWorkflowResults(
    input.workflowId,
    graphSlots,
    successfulResults.filter(Boolean),
    errors,
    dispatch.qa
      ? {
        agent: dispatch.qa.agent,
        validationCommands: validationResults,
      }
      : undefined,
    queues,
    "executed",
    input.config.maxModelCalls,
    input.config.maxToolRounds,
  );
  input.logger?.log({
    stage: "workflow",
    message: "completed workflow",
    data: {
      workflow: input.workflowId,
      agents: combined.metadata.workflow?.agents,
      modelCalls: combined.metadata.modelCalls,
      toolCalls: combined.metadata.toolCalls.length,
      errors: combined.metadata.errors.length,
    },
  });
  return combined;
}

function selectWorkflowDispatch(
  workflow: ProjectConfig["workflows"][string],
  prompt: string,
): {
  agents: string[];
  qa: ProjectConfig["workflows"][string]["qa"] | undefined;
  tierName: string | undefined;
  estimatedDepth: number | undefined;
} {
  if (!workflow.dispatch) {
    return {
      agents: workflow.agents,
      qa: workflow.qa,
      tierName: undefined,
      estimatedDepth: undefined,
    };
  }

  const estimatedDepth = estimatePromptDepth(prompt);
  const tier = workflow.dispatch.tiers.find((candidate) =>
    candidate.maxEstimatedDepth === undefined || estimatedDepth <= candidate.maxEstimatedDepth
  ) ?? workflow.dispatch.tiers.at(-1);

  if (!tier) {
    return {
      agents: workflow.agents,
      qa: workflow.qa,
      tierName: undefined,
      estimatedDepth,
    };
  }

  return {
    agents: tier.agents,
    qa: tier.qa ? workflow.qa : undefined,
    tierName: tier.name,
    estimatedDepth,
  };
}

type WorkflowGraphSlot = {
  agentId: string;
  kind: ExecutionGraphNode["kind"];
  terminalStatus: ExecutionStatus;
};

function buildWorkflowGraphSlots(
  agents: AgentProfile[],
  qa: ProjectConfig["workflows"][string]["qa"] | undefined,
  initialStatus: ExecutionStatus,
): WorkflowGraphSlot[] {
  const slots: WorkflowGraphSlot[] = agents.map((agent) => ({
    agentId: agent.id,
    kind: "workflow-agent",
    terminalStatus: initialStatus,
  }));
  if (qa) {
    slots.push({
      agentId: qa.agent,
      kind: "workflow-qa",
      terminalStatus: initialStatus,
    });
  }

  return slots;
}

function combineWorkflowResults(
  workflowId: string,
  graphSlots: WorkflowGraphSlot[],
  results: RecursivePromptResult[],
  errors: string[],
  qa: { agent: string; validationCommands: ValidationCommandResult[] } | undefined,
  queues: WorkflowTaskQueue[],
  planExecutionStatus: "planned" | "executed",
  maxModelCalls: number,
  maxToolRounds: number,
): RecursivePromptResult {
  const trace: TraceEvent[] = results.flatMap((result) => result.trace);
  const answer = planExecutionStatus === "planned"
    ? ""
    : graphSlots
      .map((slot) => {
        const match = results.find((result) => result.metadata.agent.id === slot.agentId);
        if (match) {
          return `## ${slot.agentId}\n${match.answer}`;
        }
        const errLine = errors.find((line) => line.startsWith(`${slot.agentId}:`));
        return `## ${slot.agentId}\n${errLine ?? "(agent did not return a result)"}`;
      })
      .join("\n\n");
  const first = results.find(Boolean);
  const agents = graphSlots.map((slot) => slot.agentId);
  const anySlotFailed = graphSlots.some((slot) => slot.terminalStatus === "failed");
  const executionStatus =
    planExecutionStatus === "planned"
      ? "planned"
      : errors.length > 0 || anySlotFailed
        ? "failed"
        : "completed";

  const metadata: RecursivePromptResult["metadata"] = {
    agent: {
      id: "workflow",
      source: "auto",
    },
    workflow: {
      id: workflowId,
      agents,
      qa,
    },
    workflowQueues: queues,
    executionStatus,
    executionGraph: {
      nodes: graphSlots.map((slot, index) => ({
        id: `workflow-agent-${index + 1}`,
        kind: slot.kind,
        label: slot.agentId,
        depth: 0,
        status: planExecutionStatus === "planned" ? "ready" : slot.terminalStatus,
      })),
      edges: [],
    },
    budget: {
      estimatedModelCalls: maxModelCalls * Math.max(1, agents.length),
      estimatedToolRounds: maxToolRounds,
      modelCallsUsed: results.reduce((total, result) => total + result.metadata.modelCalls, 0),
      modelCallsRemaining: Math.max(
        0,
        maxModelCalls * Math.max(1, agents.length) - results.reduce((total, result) => total + result.metadata.modelCalls, 0),
      ),
      toolCallsUsed: results.flatMap((result) => result.metadata.toolCalls).length,
    },
    depth: first?.metadata.depth ?? {
      selected: 0,
      source: "fallback",
    },
    modelSelections: results.flatMap((result) => result.metadata.modelSelections),
    memoryReservations: results.flatMap((result) => result.metadata.memoryReservations),
    modelCalls: results.reduce((total, result) => total + result.metadata.modelCalls, 0),
    tokenUsage: results.reduce(
      (total, result) => ({
        inputTokens: total.inputTokens + result.metadata.tokenUsage.inputTokens,
        outputTokens: total.outputTokens + result.metadata.tokenUsage.outputTokens,
        totalTokens: total.totalTokens + result.metadata.tokenUsage.totalTokens,
        unknownCompletions: total.unknownCompletions + result.metadata.tokenUsage.unknownCompletions,
      }),
      {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        unknownCompletions: 0,
      },
    ),
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

async function runValidationCommands(
  commands: string[],
  runner: ((command: string) => Promise<ValidationCommandResult>) | undefined,
  logger: RuntimeLogger | undefined,
): Promise<ValidationCommandResult[]> {
  const run = runner ?? runValidationCommand;
  const results: ValidationCommandResult[] = [];
  for (const command of commands) {
    logger?.log({
      stage: "validation",
      message: "starting validation command",
      data: {
        command,
      },
    });
    const startedAt = Date.now();
    const result = await run(command);
    logger?.log({
      stage: "validation",
      message: "completed validation command",
      data: {
        command,
        status: result.status,
        durationMs: Date.now() - startedAt,
        output: preview(result.output),
      },
    });
    results.push(result);
  }

  return results;
}

async function runValidationCommand(command: string): Promise<ValidationCommandResult> {
  const [executable, ...args] = parseCommand(command);
  if (!executable) {
    return {
      command,
      status: "error",
      output: "Empty validation command.",
    };
  }

  try {
    const result = await execFileAsync(executable, args, {
      cwd: process.cwd(),
      timeout: 120_000,
      maxBuffer: 2_000_000,
    });
    return {
      command,
      status: "success",
      output: formatCommandOutput(result.stdout, result.stderr, 0),
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      const execError = error as Error & { code?: number; stdout?: string; stderr?: string };
      return {
        command,
        status: "error",
        output: formatCommandOutput(execError.stdout ?? "", execError.stderr ?? execError.message, execError.code ?? 1),
      };
    }

    return {
      command,
      status: "error",
      output: String(error),
    };
  }
}

function buildQaPrompt(
  prompt: string,
  results: RecursivePromptResult[],
  validationResults: ValidationCommandResult[],
): string {
  const agentSummaries = results.map((result) => `## ${result.metadata.agent.id}\n${result.answer}`).join("\n\n");
  const validations = validationResults
    .map((result) => `- ${result.command}: ${result.status}\n${result.output}`)
    .join("\n\n");

  return [
    "Perform QA for this workflow.",
    "Validate expected functionality against the original prompt, implementation/research results, and command output.",
    "If defects require follow-up work, schedule them as BUGFIX[keyword1, keyword2]: concise task.",
    "",
    `Original prompt:\n${prompt}`,
    "",
    `Workflow results:\n${agentSummaries || "(none)"}`,
    "",
    `Validation commands:\n${validations || "(none)"}`,
  ].join("\n");
}

export function buildBugfixQueue(
  config: { id: string; priority: number; highestPriorityKeywords: string[] },
  qaAnswer: string,
  sourceAgent: string,
): WorkflowTaskQueue {
  const items: WorkflowTaskQueueItem[] = [];
  for (const task of extractBugfixTasks(qaAnswer)) {
    const keywords = task.keywords.length > 0 ? task.keywords : inferTaskKeywords(task.task, config.highestPriorityKeywords);
    if (hasExistingHighestPriorityKeyword(items, keywords, config.highestPriorityKeywords)) {
      continue;
    }

    items.push({
      id: `${config.id}-${items.length + 1}`,
      task: task.task,
      keywords,
      sourceAgent,
    });
  }

  return {
    id: config.id,
    priority: config.priority,
    items,
  };
}

function extractBugfixTasks(answer: string): Array<{ task: string; keywords: string[] }> {
  const tasks: Array<{ task: string; keywords: string[] }> = [];
  const lines = answer.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*(?:[-*]\s*)?BUGFIX(?:\[(?<keywords>[^\]]+)\])?\s*:\s*(?<task>.+?)\s*$/i);
    if (!match?.groups) {
      continue;
    }

    tasks.push({
      task: match.groups["task"] ?? "",
      keywords: (match.groups["keywords"] ?? "")
        .split(",")
        .map((keyword) => keyword.trim().toLowerCase())
        .filter(Boolean),
    });
  }

  return tasks;
}

function inferTaskKeywords(task: string, highestPriorityKeywords: string[]): string[] {
  const normalized = task.toLowerCase();
  return highestPriorityKeywords.filter((keyword) => normalized.includes(keyword.toLowerCase()));
}

function hasExistingHighestPriorityKeyword(
  items: WorkflowTaskQueueItem[],
  candidateKeywords: string[],
  highestPriorityKeywords: string[],
): boolean {
  const candidateHighest = new Set(
    candidateKeywords
      .map((keyword) => keyword.toLowerCase())
      .filter((keyword) => highestPriorityKeywords.some((priorityKeyword) => priorityKeyword.toLowerCase() === keyword)),
  );
  if (candidateHighest.size === 0) {
    return false;
  }

  return items.some((item) => item.keywords.some((keyword) => candidateHighest.has(keyword.toLowerCase())));
}

function findWorkflowAgent(registry: AgentRegistry, workflowId: string, agentId: string) {
  const agent = registry.profiles.find((profile) => profile.id === agentId);
  if (!agent) {
    throw new Error(`Workflow "${workflowId}" references unavailable agent "${agentId}".`);
  }

  return agent;
}

function parseCommand(command: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "\"" | "'" | undefined;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (!char) {
      continue;
    }

    if ((char === "\"" || char === "'") && !quote) {
      quote = char;
      continue;
    }

    if (char === quote) {
      quote = undefined;
      continue;
    }

    if (/\s/.test(char) && !quote) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function formatCommandOutput(stdout: string, stderr: string, exitCode: number): string {
  return [`exitCode: ${exitCode}`, `stdout:\n${stdout.trim()}`, `stderr:\n${stderr.trim()}`].join("\n");
}

function preview(value: string, maxLength = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}
