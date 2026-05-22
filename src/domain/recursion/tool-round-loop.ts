import type {
  EffectiveSamplingMetadata,
  LanguageModelPort,
} from "../../ports/language-model-port.js";
import type { LanguageModelPurpose } from "../../ports/language-model-port.js";
import type { LanguageModelUsage } from "../../ports/language-model-port.js";
import type { ToolExecutionResult } from "../../ports/tool-port.js";
import type { ToolPort } from "../../ports/tool-port.js";
import type { TracePort } from "../../ports/trace-port.js";
import type { ExecutionStatusUpdateDetail, TaskNode, ToolCallRecord } from "../types.js";
import { EXECUTION_FAILURE_CODES } from "../execution-failure.js";
import { canSpendAnyModelCall, maxToolRoundsFromLimit } from "./budget-guard.js";
import {
  fallbackFromMessages,
  parseClarificationRequest,
  preview,
  toModelPurpose,
} from "./prompt-utilities.js";

/**
 * Narrow facade for {@link runCompletionWithToolRounds} / {@link runCompletionWithoutTools}.
 * Implemented by RecursiveLanguageModel so tool-round logic does not duplicate orchestrator state.
 */
export interface ModelCompletionHost {
  readonly model: LanguageModelPort;
  /** Current model-call count (mutable via {@link consumeModelCall}). */
  getModelCalls(): number;
  getMaxModelCalls(): number;
  getToolRoundLimit(): number;
  getComplexityDepth(): number;
  consumeModelCall(): void;
  throwIfCancelled(task: TaskNode): void;
  withAgentSystemPrompt(
    messages: Parameters<LanguageModelPort["complete"]>[0],
  ): Parameters<LanguageModelPort["complete"]>[0];
  resolveMemoryPacket(task: TaskNode): Promise<{ text: string } | undefined>;
  recordLimit(task: TaskNode, message: string): void;
  record(
    task: TaskNode,
    kind: Parameters<TracePort["record"]>[0]["kind"],
    prompt: string,
    output: string,
  ): void;
  log(stage: string, message: string, data?: Record<string, unknown>): void;
  pushMetadataError(message: string): void;
  appendToolCallRecord(record: ToolCallRecord): void;
  markExecutionNodeFailed(
    nodeId: string,
    status: "failed" | "cancelled",
    detail?: ExecutionStatusUpdateDetail,
  ): void;
  expertTierFor(task: TaskNode, purpose: LanguageModelPurpose | undefined): string | undefined;
  toolsForTask(task: TaskNode): ToolPort[];
  getToolByName(name: string): ToolPort | undefined;
  updateExecutionNodeModel(
    nodeId: string,
    effectiveModel: string | undefined,
    overrideModel: string | undefined,
    effectiveSampling?: EffectiveSamplingMetadata | undefined,
  ): void;
  recordUsage(usage: LanguageModelUsage | undefined): void;
  requestClarification(task: TaskNode, promptText: string): Promise<string>;
}

export async function runCompletionWithToolRounds(
  host: ModelCompletionHost,
  task: TaskNode,
  kind: Parameters<TracePort["record"]>[0]["kind"],
  messages: Parameters<LanguageModelPort["complete"]>[0],
  allowTools: boolean,
): Promise<string> {
  host.throwIfCancelled(task);
  if (!canSpendAnyModelCall(host.getModelCalls(), host.getMaxModelCalls())) {
    host.recordLimit(task, `model call budget reached before ${kind}`);
    return fallbackFromMessages(messages);
  }

  const memoryPacket = await host.resolveMemoryPacket(task);
  const conversation = memoryPacket?.text
    ? [{ role: "system" as const, content: memoryPacket.text }, ...messages]
    : [...messages];
  const toolRoundLimit = host.getToolRoundLimit();
  for (let round = 0; round <= maxToolRoundsFromLimit(toolRoundLimit); round += 1) {
    host.consumeModelCall();
    const callNumber = host.getModelCalls();
    host.log("completion", "starting model completion", {
      call: callNumber,
      task: task.id,
      depth: task.depth,
      kind,
      round,
      toolsEnabled: allowTools,
      prompt: preview(messages.at(-1)?.content ?? ""),
    });
    const purpose = toModelPurpose(kind);
    const expertTier = host.expertTierFor(task, purpose);
    const response = await host.model.complete(host.withAgentSystemPrompt(conversation), {
      tools: allowTools ? host.toolsForTask(task) : [],
      purpose,
      complexityDepth: host.getComplexityDepth(),
      overrideModel: expertTier ? undefined : task.modelOverride,
      overrideModelSelection: expertTier,
      constrainedToolCalling: allowTools && host.toolsForTask(task).length > 0,
      sampling: task.samplingOverride,
    });
    host.updateExecutionNodeModel(task.id, response.model, task.modelOverride, response.sampling);
    host.recordUsage(response.usage);
    host.log("completion", "completed model completion", {
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
      const clarificationPrompt = parseClarificationRequest(response.content);
      if (clarificationPrompt) {
        const answer = await host.requestClarification(task, clarificationPrompt);
        conversation.push({
          role: "assistant",
          content: response.content,
        });
        conversation.push({
          role: "user",
          content: answer,
        });
        continue;
      }
      return response.content;
    }

    if (!allowTools) {
      const output = `Model requested tools during ${kind}, but tools are disabled for this step.`;
      host.record(task, "error", task.prompt, output);
      host.pushMetadataError(output);
      host.markExecutionNodeFailed(task.id, "failed", {
        failureCategory: "model",
        code: EXECUTION_FAILURE_CODES.model,
        message: output,
      });
      return response.content || fallbackFromMessages(conversation);
    }

    if (round >= maxToolRoundsFromLimit(toolRoundLimit)) {
      host.recordLimit(task, `tool round limit reached during ${kind}`);
      if (response.content) {
        return response.content;
      }

      return canSpendAnyModelCall(host.getModelCalls(), host.getMaxModelCalls())
        ? runCompletionWithoutTools(host, task, kind, [
            ...conversation,
            {
              role: "assistant",
              content: response.content,
              toolCalls: response.toolCalls,
            },
            {
              role: "system",
              content:
                "Tool use is no longer available. Answer directly from the conversation and tool context already present.",
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
      const tool = host.getToolByName(toolCall.name);
      host.throwIfCancelled(task);
      host.record(task, "tool-call", JSON.stringify(toolCall.args), toolCall.name);
      host.log("tool", "starting tool call", {
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
      host.appendToolCallRecord(record);
      if (result.status === "error") {
        host.pushMetadataError(result.output);
        host.markExecutionNodeFailed(task.id, "failed", {
          failureCategory: "tool",
          code: EXECUTION_FAILURE_CODES.tool,
          message: result.output,
        });
      }
      host.log("tool", result.status === "success" ? "completed tool call" : "failed tool call", {
        task: task.id,
        call: toolCall.id,
        name: toolCall.name,
        status: result.status,
        durationMs,
        output: preview(result.output),
      });
      host.record(
        task,
        result.status === "success" ? "tool-result" : "error",
        toolCall.name,
        result.output,
      );
      conversation.push({
        role: "tool",
        content: result.output,
        toolCallId: toolCall.id,
      });
    }

    if (!canSpendAnyModelCall(host.getModelCalls(), host.getMaxModelCalls())) {
      host.recordLimit(task, `model call budget reached after tool calls during ${kind}`);
      return response.content || fallbackFromMessages(conversation);
    }
  }

  host.recordLimit(task, `tool round limit reached during ${kind}`);
  return fallbackFromMessages(conversation);
}

export async function runCompletionWithoutTools(
  host: ModelCompletionHost,
  task: TaskNode,
  kind: Parameters<TracePort["record"]>[0]["kind"],
  messages: Parameters<LanguageModelPort["complete"]>[0],
): Promise<string> {
  if (!canSpendAnyModelCall(host.getModelCalls(), host.getMaxModelCalls())) {
    host.recordLimit(task, `model call budget reached before direct ${kind} follow-up`);
    return fallbackFromMessages(messages);
  }

  host.consumeModelCall();
  const callNumber = host.getModelCalls();
  host.log("completion", "starting model completion", {
    call: callNumber,
    task: task.id,
    depth: task.depth,
    kind,
    round: "direct",
    toolsEnabled: false,
    prompt: preview(messages.at(-1)?.content ?? ""),
  });
  const purpose = toModelPurpose(kind);
  const expertTier = host.expertTierFor(task, purpose);
  const response = await host.model.complete(host.withAgentSystemPrompt(messages), {
    tools: [],
    purpose,
    complexityDepth: host.getComplexityDepth(),
    overrideModel: expertTier ? undefined : task.modelOverride,
    overrideModelSelection: expertTier,
    constrainedToolCalling: false,
    sampling: task.samplingOverride,
  });
  host.updateExecutionNodeModel(task.id, response.model, task.modelOverride, response.sampling);
  host.recordUsage(response.usage);
  host.log("completion", "completed model completion", {
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
    host.recordLimit(task, `ignored tool requests during direct ${kind} follow-up`);
  }

  return response.content || fallbackFromMessages(messages);
}
