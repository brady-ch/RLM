import type { LanguageModelPort } from "../ports/language-model-port.js";
import type { LanguageModelPurpose } from "../ports/language-model-port.js";
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
    return {
      answer,
      trace: this.trace.events(),
      metadata: this.metadata,
    };
  }

  private async solve(task: TaskNode, config: RecursiveModelConfig): Promise<string> {
    const maxDepth = config.maxDepth ?? 0;
    if (task.depth >= maxDepth) {
      return this.answerDirectly(task, "Depth limit reached; answer directly.");
    }

    if (this.remainingModelCalls() <= 1) {
      return this.answerDirectly(task, "Model call budget is nearly exhausted; answer directly.");
    }

    const classification = await this.classify(task);
    if (classification !== RECURSIVE) {
      return this.answerDirectly(task, "Task is simple enough for a direct answer.");
    }

    if (!this.hasCallReservedForDirectAnswer(config)) {
      return this.answerDirectly(task, "Model call budget is nearly exhausted; answer directly.");
    }

    const children = await this.decompose(task, config);
    if (children.length === 0) {
      return this.answerDirectly(task, "No useful subtasks were found; answer directly.");
    }

    const solvedChildren: SolvedTask[] = [];
    for (const child of children) {
      const answer = await this.solve(child, config);
      const summary = this.canSpendAnyModelCall() ? await this.summarize(child, answer) : answer;
      solvedChildren.push({
        id: child.id,
        prompt: child.prompt,
        answer,
        summary,
      });
    }

    return this.canSpendAnyModelCall()
      ? this.synthesize(task, solvedChildren)
      : this.synthesizeWithoutModel(task, solvedChildren);
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

    return output
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
  }

  private async answerDirectly(task: TaskNode, reason: string): Promise<string> {
    if (!this.canSpendAnyModelCall()) {
      const output = `Unable to continue: model call budget exhausted before task could be answered. Task: ${task.prompt}`;
      this.record(task, "error", task.prompt, output);
      return output;
    }

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
      const output = `Model call budget exhausted before ${kind}.`;
      this.record(task, "error", task.prompt, output);
      return output;
    }

    const conversation = [...messages];
    for (let round = 0; round <= this.maxToolRounds(); round += 1) {
      this.modelCalls += 1;
      const response = await this.model.complete(this.withAgentSystemPrompt(conversation), {
        tools: allowTools ? [...this.toolsByName.values()] : [],
        purpose: toModelPurpose(kind),
        complexityDepth: this.metadata.depth.selected,
      });

      if (response.toolCalls.length === 0) {
        return response.content;
      }

      if (!allowTools) {
        const output = `Model requested tools during ${kind}, but tools are disabled for this step.`;
        this.record(task, "error", task.prompt, output);
        this.metadata.errors.push(output);
        return response.content || output;
      }

      if (round >= this.maxToolRounds()) {
        const output = `Tool round limit reached during ${kind}.`;
        this.record(task, "error", task.prompt, output);
        this.metadata.errors.push(output);
        return response.content || output;
      }

      conversation.push({
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls,
      });

      for (const toolCall of response.toolCalls) {
        const tool = this.toolsByName.get(toolCall.name);
        this.record(task, "tool-call", JSON.stringify(toolCall.args), toolCall.name);
        const result = tool
          ? await tool.execute(toolCall.args)
          : { status: "error" as const, output: `Unknown tool: ${toolCall.name}` };
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
        this.record(task, result.status === "success" ? "tool-result" : "error", toolCall.name, result.output);
        conversation.push({
          role: "tool",
          content: result.output,
          toolCallId: toolCall.id,
        });
      }

      if (!this.canSpendAnyModelCall()) {
        const output = `Model call budget exhausted after tool calls during ${kind}.`;
        this.record(task, "error", task.prompt, output);
        this.metadata.errors.push(output);
        return output;
      }
    }

    return `Tool round limit reached during ${kind}.`;
  }

  private async selectDepth(prompt: string, config: RecursiveModelConfig): Promise<number> {
    if (config.maxDepth !== undefined) {
      this.metadata.depth = {
        selected: config.maxDepth,
        source: "override",
      };
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
    toolCalls: [],
    errors: [],
  };
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
