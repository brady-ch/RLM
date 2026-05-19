import type { RecursivePromptResult, TraceEvent } from "../domain/types.js";
import { labelForCategory } from "../domain/execution-failure.js";
import type { ExecutionFailureCategory } from "../domain/execution-failure.js";

export interface RenderOptions {
  compact: boolean;
  json: boolean;
  includeTrace: boolean;
  model: string;
}

export function renderResult(result: RecursivePromptResult, options: RenderOptions): string {
  if (options.json) {
    return renderJson(result, options);
  }

  if (options.compact) {
    return renderCompact(result, options);
  }

  const sections: string[] = [];
  if (isRunFailure(result)) {
    sections.push(formatFailureBanner(result));
  }
  sections.push(`Answer:\n${result.answer}`);
  if (options.includeTrace) {
    sections.push(`Trace:\n${renderTrace(result.trace)}`);
  }

  return sections.join("\n\n");
}

function renderCompact(result: RecursivePromptResult, options: RenderOptions): string {
  const errCount = result.metadata.errors.length;
  const lines = [
    `model: ${options.model}`,
    `agent: ${result.metadata.agent.id} (${result.metadata.agent.source})`,
    `depth: ${result.metadata.depth.selected} (${result.metadata.depth.source})`,
    `modelCalls: ${result.metadata.modelCalls}`,
    `executionStatus: ${result.metadata.executionStatus ?? "completed"}`,
    ...(isRunFailure(result) ? [`errors: ${errCount}`, `errorPreview: ${singleLine(result.metadata.errors[0] ?? "")}`] : []),
    `tokens: input=${result.metadata.tokenUsage.inputTokens} output=${result.metadata.tokenUsage.outputTokens} total=${result.metadata.tokenUsage.totalTokens} unknown=${result.metadata.tokenUsage.unknownCompletions}`,
  ];
  if (result.metadata.qualityLoop) {
    const loop = result.metadata.qualityLoop;
    lines.push(
      `qualityLoop: status=${loop.status} stopReason=${loop.stopReason ?? "none"} iterations=${loop.iterations.length} selectedCandidate=${loop.selectedCandidateId ?? "none"}`,
      `qualityLoopUsage: modelCalls=${loop.usage.modelCallsTotal} input=${loop.usage.inputTokens} output=${loop.usage.outputTokens} total=${loop.usage.totalTokens} unknown=${loop.usage.unknownCompletions}`,
      `qualityLoopQuality: score=${loop.gate?.score ?? loop.selection?.scoreBasis.find((item) => item.startsWith("best_of_progress_score:"))?.split(":")[1] ?? "none"} issues=${loop.unresolvedIssues.length} status=${loop.status}`,
    );
    if (loop.rubric) {
      lines.push(`qualityLoopRubric: id=${loop.rubric.id} confidence=${loop.rubric.confidence} signals=${loop.rubric.matchedSignals.length}`);
    }
    if (loop.gate) {
      lines.push(`qualityLoopGate: decision=${loop.gate.decision} score=${loop.gate.score} threshold=${loop.gate.passThreshold} failedConditions=${loop.gate.failedConditions.length}`);
    }
    if (loop.phaseModels) {
      const phaseModels = Object.values(loop.phaseModels)
        .map((assignment) => `${assignment.phase}:${assignment.plannedSelection}->${assignment.effectiveModel}`)
        .join(" ");
      lines.push(`qualityLoopModels: ${phaseModels}`);
    }
  }
  lines.push(`answer: ${singleLine(result.answer)}`);
  if (result.metadata.executionGraph?.nodes.length) {
    const autoApprovedNodes = result.metadata.executionGraph.nodes.filter((node) => node.approvalSource === "auto").length;
    lines.push(`autoApprovedNodes=${autoApprovedNodes}`);
    lines.push("nodeModels:");
    for (const node of result.metadata.executionGraph.nodes) {
      lines.push(
        `- ${node.id} planned=${node.plannedModel ?? "resolved-at-runtime"} override=${node.modelOverride ?? "none"} source=${node.modelOverrideSource ?? "none"} effective=${node.effectiveModel ?? "pending"} approvalMode=${node.approvalMode ?? "full"} approvalSource=${node.approvalSource ?? "none"} spawnedAfterInitialApproval=${String(node.spawnedAfterInitialApproval ?? false)}`,
      );
    }
  }
  if (result.metadata.modelSelections.length > 0) {
    lines.push("hosts:");
    for (const selection of result.metadata.modelSelections) {
      lines.push(`- ${selection.purpose}:${selection.hostId ?? "unknown"} (${selection.hostKind ?? "unknown"}) ${selection.hostEndpoint ?? "n/a"}`);
    }
  }

  if (options.includeTrace) {
    lines.push(
      "trace:",
      ...result.trace.map((event) => `- ${event.id} depth=${event.depth} ${event.kind}: ${singleLine(event.output)}`),
    );
  }

  return lines.join("\n");
}

function renderJson(result: RecursivePromptResult, options: RenderOptions): string {
  const failure = isRunFailure(result) ? inferFailureSummary(result) : undefined;
  return JSON.stringify({
    answer: result.answer,
    model: options.model,
    agent: result.metadata.agent,
    configPath: result.metadata.configPath,
    workflow: result.metadata.workflow,
    workflowQueues: result.metadata.workflowQueues,
    executionGraph: result.metadata.executionGraph,
    executionStatus: result.metadata.executionStatus,
    qualityLoop: result.metadata.qualityLoop,
    failureCategory: failure?.category,
    failureLabel: failure?.label,
    depth: result.metadata.depth,
    modelSelections: result.metadata.modelSelections,
    memoryReservations: result.metadata.memoryReservations,
    modelCalls: result.metadata.modelCalls,
    tokenUsage: result.metadata.tokenUsage,
    clarificationHistory: result.metadata.clarificationHistory ?? [],
    trace: options.includeTrace ? result.trace : [],
    toolCalls: result.metadata.toolCalls,
    errors: result.metadata.errors,
  });
}

function isRunFailure(result: RecursivePromptResult): boolean {
  return result.metadata.executionStatus === "failed"
    || (result.metadata.errors?.length ?? 0) > 0;
}

function inferFailureSummary(result: RecursivePromptResult): { category: ExecutionFailureCategory; label: string } {
  const toolErr = result.metadata.toolCalls.some((call) => call.status === "error");
  if (toolErr) {
    return { category: "tool", label: labelForCategory("tool") };
  }
  if (result.metadata.workflow) {
    return { category: "workflow", label: labelForCategory("workflow") };
  }
  return { category: "model", label: labelForCategory("model") };
}

function formatFailureBanner(result: RecursivePromptResult): string {
  const { label } = inferFailureSummary(result);
  const status = result.metadata.executionStatus ?? "failed";
  const lines = [
    `Run status: ${status} (${label})`,
    "Errors:",
    ...result.metadata.errors.map((line) => `- ${line}`),
  ];
  return lines.join("\n");
}

function renderTrace(events: TraceEvent[]): string {
  if (events.length === 0) {
    return "(empty)";
  }

  return events
    .map((event) => {
      const parent = event.parentId ? ` parent=${event.parentId}` : "";
      return `- ${event.id}${parent} depth=${event.depth} kind=${event.kind}\n  ${singleLine(event.output)}`;
    })
    .join("\n");
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
