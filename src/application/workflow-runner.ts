import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AgentRegistry } from "./agent-registry.js";
import type { ProjectConfig } from "./project-config.js";
import type {
  RecursiveModelConfig,
  RecursivePromptResult,
  TraceEvent,
  ValidationCommandResult,
  WorkflowTaskQueue,
  WorkflowTaskQueueItem,
} from "../domain/types.js";
import type { LanguageModelPort } from "../ports/language-model-port.js";
import { MemoryManager } from "./memory-manager.js";
import { runConfiguredAgent } from "./agent-runner.js";

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
  createModel: (model: string) => LanguageModelPort;
  runValidationCommand?: ((command: string) => Promise<ValidationCommandResult>) | undefined;
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

  const validationResults = workflow.qa
    ? await runValidationCommands(workflow.qa.validationCommands, input.runValidationCommand)
    : [];
  let qaResult: RecursivePromptResult | undefined;
  if (workflow.qa) {
    try {
      qaResult = await runConfiguredAgent({
        prompt: buildQaPrompt(input.prompt, successfulResults.filter(Boolean), validationResults),
        config: input.config,
        projectConfig: input.projectConfig,
        configPath: input.configPath,
        agent: findWorkflowAgent(input.registry, input.workflowId, workflow.qa.agent),
        agentSource: "auto",
        baseUrl: input.baseUrl,
        memoryManager: input.memoryManager,
        createModel: input.createModel,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${workflow.qa.agent}: ${message}`);
      if (!workflow.continueOnError) {
        throw new Error(`Workflow "${input.workflowId}" failed: ${errors.join("; ")}`);
      }
    }
  }
  if (qaResult) {
    successfulResults.push(qaResult);
  }

  const queues = workflow.qa
    ? [buildBugfixQueue(workflow.qa.bugfixQueue, qaResult?.answer ?? "", workflow.qa.agent)]
    : [];

  return combineWorkflowResults(
    input.workflowId,
    [
      ...agents.map((agent) => agent.id),
      ...(workflow.qa ? [workflow.qa.agent] : []),
    ],
    successfulResults.filter(Boolean),
    errors,
    workflow.qa
      ? {
        agent: workflow.qa.agent,
        validationCommands: validationResults,
      }
      : undefined,
    queues,
  );
}

function combineWorkflowResults(
  workflowId: string,
  agents: string[],
  results: RecursivePromptResult[],
  errors: string[],
  qa: { agent: string; validationCommands: ValidationCommandResult[] } | undefined,
  queues: WorkflowTaskQueue[],
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
      qa,
    },
    workflowQueues: queues,
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

async function runValidationCommands(
  commands: string[],
  runner: ((command: string) => Promise<ValidationCommandResult>) | undefined,
): Promise<ValidationCommandResult[]> {
  const run = runner ?? runValidationCommand;
  const results: ValidationCommandResult[] = [];
  for (const command of commands) {
    results.push(await run(command));
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
