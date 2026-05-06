import type { LanguageModelPort } from "../ports/language-model-port.js";
import type { LanguageModelPurpose } from "../ports/language-model-port.js";
import type { LanguageModelUsage } from "../ports/language-model-port.js";
import type { RuntimeLogger } from "../ports/runtime-logger-port.js";
import type { ToolExecutionResult } from "../ports/tool-port.js";
import type { ToolPort } from "../ports/tool-port.js";
import type { TracePort } from "../ports/trace-port.js";
import type {
  RecursiveModelConfig,
  RecursivePromptMetadata,
  RecursivePromptRequest,
  RecursivePromptResult,
  SolvedTask,
  TaskNode,
  ToolCallRecord,
} from "./types.js";

const DIRECT = "DIRECT";
const RECURSIVE = "RECURSIVE";

export class RecursiveLanguageModel {
  private nextId = 1;
  private modelCalls = 0;
  private maxModelCalls = Number.POSITIVE_INFINITY;
  private toolRoundLimit = 0;
  private agentSystemPrompt = "";
  private metadata: RecursivePromptMetadata = createEmptyMetadata();
  private logger: RuntimeLogger | undefined;
  private readonly toolsByName: Map<string, ToolPort>;

  constructor(
    private readonly model: LanguageModelPort,
    private readonly trace: TracePort,
    tools: ToolPort[] = [],
  ) {
    this.toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  }

  async run(request: RecursivePromptRequest): Promise<RecursivePromptResult> {
    this.nextId = 1;
    this.modelCalls = 0;
    this.maxModelCalls = request.config.maxModelCalls;
    this.toolRoundLimit = request.config.maxToolRounds;
    this.metadata = createEmptyMetadata();
    this.logger = request.logger;
    if (request.agent) {
      this.agentSystemPrompt = request.agent.systemPrompt;
      this.metadata.agent = {
        id: request.agent.id,
        source: request.agent.source,
      };
    } else {
      this.agentSystemPrompt = "";
    }
    const depth = await this.selectDepth(request.prompt, request.config);
    const config: RecursiveModelConfig = {
      ...request.config,
      maxDepth: depth,
    };
    const root: TaskNode = {
      id: this.createId(),
      prompt: this.limitPrompt(request.prompt, config),
      depth: 0,
    };

    const answer = await this.solve(root, config);
    this.metadata.modelCalls = this.modelCalls;
    this.log("run", "completed recursive run", {
      modelCalls: this.metadata.modelCalls,
      inputTokens: this.metadata.tokenUsage.inputTokens,
      outputTokens: this.metadata.tokenUsage.outputTokens,
      totalTokens: this.metadata.tokenUsage.totalTokens,
      unknownCompletions: this.metadata.tokenUsage.unknownCompletions,
    });
    return {
      answer,
      trace: this.trace.events(),
      metadata: this.metadata,
    };
  }

  private async solve(task: TaskNode, config: RecursiveModelConfig): Promise<string> {
    this.log("task", "solving task", {
      id: task.id,
      depth: task.depth,
      maxDepth: config.maxDepth ?? 0,
      prompt: preview(task.prompt),
    });
    const maxDepth = config.maxDepth ?? 0;
    if (task.depth >= maxDepth) {
      const answer = await this.answerDirectly(task, "Depth limit reached; answer directly.");
      this.log("task", "completed task", {
        id: task.id,
        depth: task.depth,
        mode: "direct",
      });
      return answer;
    }

    if (this.remainingModelCalls() <= 1) {
      const answer = await this.answerDirectly(task, "Model call budget is nearly exhausted; answer directly.");
      this.log("task", "completed task", {
        id: task.id,
        depth: task.depth,
        mode: "direct",
      });
      return answer;
    }

    const classification = await this.classify(task);
    this.log("task", "classification received", {
      id: task.id,
      depth: task.depth,
      classification,
    });
    if (classification !== RECURSIVE) {
      const answer = await this.answerDirectly(task, "Task is simple enough for a direct answer.");
      this.log("task", "completed task", {
        id: task.id,
        depth: task.depth,
        mode: "direct",
      });
      return answer;
    }

    if (!this.hasCallReservedForDirectAnswer(config)) {
      const answer = await this.answerDirectly(task, "Model call budget is nearly exhausted; answer directly.");
      this.log("task", "completed task", {
        id: task.id,
        depth: task.depth,
        mode: "direct",
      });
      return answer;
    }

    const children = await this.decompose(task, config);
    this.log("task", "decomposed task", {
      id: task.id,
      children: children.length,
    });
    if (children.length === 0) {
      const answer = await this.answerDirectly(task, "No useful subtasks were found; answer directly.");
      this.log("task", "completed task", {
        id: task.id,
        depth: task.depth,
        mode: "direct",
      });
      return answer;
    }

    const solvedChildren: SolvedTask[] = [];
    for (const child of children) {
      if (this.remainingModelCalls() <= 1) {
        this.recordLimit(task, "model call budget reached before all child tasks could be solved");
        break;
      }

      const answer = await this.solve(child, config);
      const summary = this.remainingModelCalls() > 1 ? await this.summarize(child, answer) : answer;
      solvedChildren.push({
        id: child.id,
        prompt: child.prompt,
        answer,
        summary,
      });
    }

    const answer = await (this.canSpendAnyModelCall()
      ? this.synthesize(task, solvedChildren)
      : this.synthesizeWithoutModel(task, solvedChildren));
    this.log("task", "completed task", {
      id: task.id,
      depth: task.depth,
      mode: "recursive",
      children: solvedChildren.length,
    });
    return answer;
  }

  private async classify(task: TaskNode): Promise<string> {
    const output = await this.complete(task, "classify", [
      {
        role: "system",
        content:
          `Classify whether a prompt needs recursive decomposition. ` +
          `Respond with exactly ${DIRECT} or ${RECURSIVE}, then one short reason.`,
      },
      {
        role: "user",
        content: task.prompt,
      },
    ]);
    this.record(task, "classify", task.prompt, output);
    return output.trim().split(/[\s:.-]+/, 1)[0]?.toUpperCase() ?? DIRECT;
  }

  private async decompose(task: TaskNode, config: RecursiveModelConfig): Promise<TaskNode[]> {
    this.log("phase", "decomposing task", {
      id: task.id,
      depth: task.depth,
      maxBranches: config.maxBranches,
    });
    const output = await this.complete(task, "decompose", [
      {
        role: "system",
        content:
          `Break the user prompt into at most ${config.maxBranches} independent subtasks. ` +
          `Return one subtask per line. Do not number the lines. Keep each line concrete.`,
      },
      {
        role: "user",
        content: task.prompt,
      },
    ]);
    this.record(task, "decompose", task.prompt, output);

    const children = output
      .split("\n")
      .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, config.maxBranches)
      .map((prompt) => ({
        id: this.createId(),
        parentId: task.id,
        prompt: this.limitPrompt(prompt, config),
        depth: task.depth + 1,
      }));
    this.log("plan", "created recursive task plan", {
      parentTask: task.id,
      depth: task.depth,
      children: children.map((child) => ({
        id: child.id,
        prompt: preview(child.prompt),
      })),
    });
    return children;
  }

  private async answerDirectly(task: TaskNode, reason: string): Promise<string> {
    if (!this.canSpendAnyModelCall()) {
      this.recordLimit(task, "model call budget reached before direct answer");
      return fallbackFromMessages([{ role: "user", content: task.prompt }]);
    }

    this.log("phase", "answering task directly", {
      id: task.id,
      depth: task.depth,
      reason,
    });
    const output = await this.complete(task, "answer", [
      {
        role: "system",
        content:
          `Answer the user task directly and concisely. ${reason} ` +
          `Prefer actionable, specific language over broad commentary.`,
      },
      {
        role: "user",
        content: task.prompt,
      },
    ], true);
    this.record(task, "answer", task.prompt, output);
    return output;
  }

  private async summarize(task: TaskNode, answer: string): Promise<string> {
    this.log("phase", "summarizing task answer", {
      id: task.id,
      depth: task.depth,
    });
    const output = await this.complete(task, "summarize", [
      {
        role: "system",
        content: "Compress this solved subtask into the shortest useful summary for a parent synthesis step.",
      },
      {
        role: "user",
        content: `Subtask:\n${task.prompt}\n\nAnswer:\n${answer}`,
      },
    ]);
    this.record(task, "summarize", task.prompt, output);
    return output;
  }

  private async synthesize(task: TaskNode, solvedChildren: SolvedTask[]): Promise<string> {
    this.log("phase", "synthesizing child task summaries", {
      id: task.id,
      depth: task.depth,
      children: solvedChildren.length,
    });
    const childContext = solvedChildren
      .map((child, index) => `Subtask ${index + 1}: ${child.prompt}\nSummary: ${child.summary}`)
      .join("\n\n");

    const output = await this.complete(task, "synthesize", [
      {
        role: "system",
        content:
          "Synthesize the child task summaries into one final answer for the original prompt. " +
          "Resolve conflicts directly and do not mention the recursion process unless it is relevant.",
      },
      {
        role: "user",
        content: `Original prompt:\n${task.prompt}\n\nChild summaries:\n${childContext}`,
      },
    ], true);
    this.record(task, "synthesize", task.prompt, output);
    return output;
  }

  private synthesizeWithoutModel(task: TaskNode, solvedChildren: SolvedTask[]): string {
    const output = solvedChildren
      .map((child) => `${child.prompt}: ${child.summary}`)
      .join("\n");
    this.record(task, "synthesize", task.prompt, output);
    return output;
  }

  private async complete(
    task: TaskNode,
    kind: Parameters<TracePort["record"]>[0]["kind"],
    messages: Parameters<LanguageModelPort["complete"]>[0],
    allowTools = false,
  ): Promise<string> {
    if (!this.canSpendAnyModelCall()) {
      this.recordLimit(task, `model call budget reached before ${kind}`);
      return fallbackFromMessages(messages);
    }

    const conversation = [...messages];
    for (let round = 0; round <= this.maxToolRounds(); round += 1) {
      this.modelCalls += 1;
      const callNumber = this.modelCalls;
      this.log("completion", "starting model completion", {
        call: callNumber,
        task: task.id,
        depth: task.depth,
        kind,
        round,
        toolsEnabled: allowTools,
        prompt: preview(messages.at(-1)?.content ?? ""),
      });
      const response = await this.model.complete(this.withAgentSystemPrompt(conversation), {
        tools: allowTools ? [...this.toolsByName.values()] : [],
        purpose: toModelPurpose(kind),
        complexityDepth: this.metadata.depth.selected,
      });
      this.recordUsage(response.usage);
      this.log("completion", "completed model completion", {
        call: callNumber,
        task: task.id,
        kind,
        model: response.model,
        toolCalls: response.toolCalls.length,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        totalTokens: response.usage?.totalTokens,
        output: preview(response.content),
      });

      if (response.toolCalls.length === 0) {
        return response.content;
      }

      if (!allowTools) {
        const output = `Model requested tools during ${kind}, but tools are disabled for this step.`;
        this.record(task, "error", task.prompt, output);
        this.metadata.errors.push(output);
        return response.content || fallbackFromMessages(conversation);
      }

      if (round >= this.maxToolRounds()) {
        this.recordLimit(task, `tool round limit reached during ${kind}`);
        if (response.content) {
          return response.content;
        }

        return this.canSpendAnyModelCall()
          ? this.completeWithoutTools(task, kind, [
            ...conversation,
            {
              role: "assistant",
              content: response.content,
              toolCalls: response.toolCalls,
            },
            {
              role: "system",
              content: "Tool use is no longer available. Answer directly from the conversation and tool context already present.",
            },
          ])
          : fallbackFromMessages(conversation);
      }

      conversation.push({
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls,
      });

      for (const toolCall of response.toolCalls) {
        const tool = this.toolsByName.get(toolCall.name);
        this.record(task, "tool-call", JSON.stringify(toolCall.args), toolCall.name);
        this.log("tool", "starting tool call", {
          task: task.id,
          depth: task.depth,
          call: toolCall.id,
          name: toolCall.name,
          args: toolCall.args,
        });
        const startedAt = Date.now();
        let result: ToolExecutionResult;
        if (tool) {
          try {
            result = await tool.execute(toolCall.args);
          } catch (error: unknown) {
            result = {
              status: "error" as const,
              output: error instanceof Error ? error.message : String(error),
            };
          }
        } else {
          result = { status: "error" as const, output: `Unknown tool: ${toolCall.name}` };
        }
        const durationMs = Date.now() - startedAt;
        const record: ToolCallRecord = {
          id: toolCall.id,
          name: toolCall.name,
          args: toolCall.args,
          status: result.status,
          output: result.output,
        };
        this.metadata.toolCalls.push(record);
        if (result.status === "error") {
          this.metadata.errors.push(result.output);
        }
        this.log("tool", result.status === "success" ? "completed tool call" : "failed tool call", {
          task: task.id,
          call: toolCall.id,
          name: toolCall.name,
          status: result.status,
          durationMs,
          output: preview(result.output),
        });
        this.record(task, result.status === "success" ? "tool-result" : "error", toolCall.name, result.output);
        conversation.push({
          role: "tool",
          content: result.output,
          toolCallId: toolCall.id,
        });
      }

      if (!this.canSpendAnyModelCall()) {
        this.recordLimit(task, `model call budget reached after tool calls during ${kind}`);
        return response.content || fallbackFromMessages(conversation);
      }
    }

    this.recordLimit(task, `tool round limit reached during ${kind}`);
    return fallbackFromMessages(conversation);
  }

  private async completeWithoutTools(
    task: TaskNode,
    kind: Parameters<TracePort["record"]>[0]["kind"],
    messages: Parameters<LanguageModelPort["complete"]>[0],
  ): Promise<string> {
    if (!this.canSpendAnyModelCall()) {
      this.recordLimit(task, `model call budget reached before direct ${kind} follow-up`);
      return fallbackFromMessages(messages);
    }

    this.modelCalls += 1;
    const callNumber = this.modelCalls;
    this.log("completion", "starting model completion", {
      call: callNumber,
      task: task.id,
      depth: task.depth,
      kind,
      round: "direct",
      toolsEnabled: false,
      prompt: preview(messages.at(-1)?.content ?? ""),
    });
    const response = await this.model.complete(this.withAgentSystemPrompt(messages), {
      tools: [],
      purpose: toModelPurpose(kind),
      complexityDepth: this.metadata.depth.selected,
    });
    this.recordUsage(response.usage);
    this.log("completion", "completed model completion", {
      call: callNumber,
      task: task.id,
      kind,
      model: response.model,
      toolCalls: response.toolCalls.length,
      inputTokens: response.usage?.inputTokens,
      outputTokens: response.usage?.outputTokens,
      totalTokens: response.usage?.totalTokens,
      output: preview(response.content),
    });

    if (response.toolCalls.length > 0) {
      this.recordLimit(task, `ignored tool requests during direct ${kind} follow-up`);
    }

    return response.content || fallbackFromMessages(messages);
  }

  private async selectDepth(prompt: string, config: RecursiveModelConfig): Promise<number> {
    if (config.maxDepth !== undefined) {
      this.metadata.depth = {
        selected: config.maxDepth,
        source: "override",
      };
      this.log("depth", "using configured depth override", {
        selected: config.maxDepth,
      });
      return config.maxDepth;
    }

    const maxDynamicDepth = Math.max(0, config.maxDynamicDepth);
    if (!this.canSpendAnyModelCall()) {
      this.metadata.depth = { selected: 2, source: "fallback" };
      return 2;
    }

    const task: TaskNode = {
      id: "depth-selector",
      prompt: this.limitPrompt(prompt, config),
      depth: 0,
    };
    this.log("depth", "selecting recursion depth", {
      maxDynamicDepth,
      prompt: preview(prompt),
    });
    const output = await this.complete(task, "depth", [
      {
        role: "system",
        content:
          `Choose a recursion depth from 0 to ${maxDynamicDepth} for the user's task complexity. ` +
          "Return only the integer. Use 0 for trivial tasks, 1 for simple multi-step tasks, " +
          "2 for normal analysis, 3 for complex work, and 4 only for highly complex work.",
      },
      {
        role: "user",
        content: prompt,
      },
    ]);
    const parsedDepth = parseFirstInteger(output);
    const selected = clamp(parsedDepth ?? 2, 0, maxDynamicDepth);
    const source = parsedDepth === undefined ? "fallback" : "model";
    this.metadata.depth = {
      selected,
      source,
    };
    this.log("depth", "selected recursion depth", {
      selected,
      source,
      output: preview(output),
    });
    this.record(task, "depth", prompt, output);
    return selected;
  }

  private hasCallReservedForDirectAnswer(config: RecursiveModelConfig): boolean {
    return this.modelCalls < config.maxModelCalls - 1;
  }

  private canSpendAnyModelCall(): boolean {
    return this.modelCalls < this.maxModelCalls;
  }

  private remainingModelCalls(): number {
    return this.maxModelCalls - this.modelCalls;
  }

  private maxToolRounds(): number {
    return Math.max(0, this.toolRoundLimit);
  }

  private withAgentSystemPrompt(messages: Parameters<LanguageModelPort["complete"]>[0]): Parameters<LanguageModelPort["complete"]>[0] {
    if (!this.agentSystemPrompt) {
      return messages;
    }

    return [
      {
        role: "system",
        content: this.agentSystemPrompt,
      },
      ...messages,
    ];
  }

  private record(task: TaskNode, kind: Parameters<TracePort["record"]>[0]["kind"], prompt: string, output: string): void {
    const event: Parameters<TracePort["record"]>[0] = {
      id: task.id,
      depth: task.depth,
      kind,
      prompt,
      output,
    };
    if (task.parentId) {
      event.parentId = task.parentId;
    }

    this.trace.record(event);
  }

  private recordUsage(usage: LanguageModelUsage | undefined): void {
    if (!usage) {
      this.metadata.tokenUsage.unknownCompletions += 1;
      return;
    }

    this.metadata.tokenUsage.inputTokens += usage.inputTokens ?? 0;
    this.metadata.tokenUsage.outputTokens += usage.outputTokens ?? 0;
    this.metadata.tokenUsage.totalTokens += usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
  }

  private log(stage: string, message: string, data?: Record<string, unknown>): void {
    this.logger?.log({
      stage,
      message,
      data,
    });
  }

  private recordLimit(task: TaskNode, message: string): void {
    this.record(task, "error", task.prompt, message);
    this.metadata.errors.push(message);
    this.log("limit", message, {
      task: task.id,
      depth: task.depth,
      modelCalls: this.modelCalls,
      maxModelCalls: this.maxModelCalls,
    });
  }

  private limitPrompt(prompt: string, config: RecursiveModelConfig): string {
    if (prompt.length <= config.maxPromptCharacters) {
      return prompt;
    }

    return prompt.slice(0, config.maxPromptCharacters).trimEnd();
  }

  private createId(): string {
    const id = `task-${this.nextId}`;
    this.nextId += 1;
    return id;
  }
}

function createEmptyMetadata(): RecursivePromptMetadata {
  return {
    agent: {
      id: "default",
      source: "auto",
    },
    depth: {
      selected: 0,
      source: "fallback",
    },
    modelSelections: [],
    memoryReservations: [],
    modelCalls: 0,
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      unknownCompletions: 0,
    },
    toolCalls: [],
    errors: [],
  };
}

function preview(value: string, maxLength = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}

function parseFirstInteger(value: string): number | undefined {
  const match = value.match(/\b\d+\b/);
  if (!match?.[0]) {
    return undefined;
  }

  return Number.parseInt(match[0], 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function fallbackFromMessages(messages: Parameters<LanguageModelPort["complete"]>[0]): string {
  const userContent = [...messages].reverse().find((message) => message.role === "user")?.content;
  return userContent?.trim() || "No additional model calls are available.";
}

function toModelPurpose(kind: Parameters<TracePort["record"]>[0]["kind"]): LanguageModelPurpose | undefined {
  if (
    kind === "depth" ||
    kind === "classify" ||
    kind === "decompose" ||
    kind === "answer" ||
    kind === "summarize" ||
    kind === "synthesize"
  ) {
    return kind;
  }

  return undefined;
}
