import type {
  EffectiveSamplingMetadata,
  LanguageModelCompleteOptions,
  LanguageModelPort,
  LanguageModelPurpose,
  LanguageModelUsage,
} from "../../ports/language-model-port.js";
import type {
  ExecutionEvent,
  ExecutionStatus,
  ExecutionStatusUpdateDetail,
  QualityLoopBestOfProgressEvaluation,
  QualityLoopCandidateSummary,
  QualityLoopConfig,
  QualityLoopCritiqueEvaluation,
  QualityLoopGateEvaluation,
  QualityLoopIssue,
  QualityLoopIterationRecord,
  QualityLoopMetadata,
  QualityLoopManualDecision,
  QualityLoopPhaseModelAssignment,
  QualityLoopPhaseName,
  QualityLoopPhaseRecord,
  QualityLoopRubricCriterion,
  QualityLoopRubricId,
  QualityLoopRubricSelection,
  QualityLoopSelectionMetadata,
  QualityLoopStatus,
  RecursiveModelConfig,
  TaskNode,
  TokenUsageTrace,
} from "../types.js";
import { EXECUTION_FAILURE_CODES } from "../execution-failure.js";
import { canSpendAnyModelCall, remainingModelCalls } from "./budget-guard.js";
import { preview } from "./prompt-utilities.js";

/** Phase order for one quality-loop iteration. */
export const QUALITY_LOOP_PHASES: QualityLoopPhaseName[] = [
  "draft",
  "critique",
  "refine",
  "gate",
  "best_of_progress",
];

export class QualityLoopManualExit extends Error {
  constructor(public readonly answer: string) {
    super("quality loop manual exit");
    this.name = "QualityLoopManualExit";
  }
}

/**
 * Orchestrator-owned state for {@link runQualityLoop} / {@link completeQualityLoopPhase}
 * (see `.planning/phases/40-domain-engine-decomposition/40-RESEARCH.md`).
 */
export interface QualityLoopHost {
  readonly model: LanguageModelPort;
  getModelCalls(): number;
  getMaxModelCalls(): number;
  consumeModelCall(): void;
  getToolCallsUsedCount(): number;
  getTokenUsage(): TokenUsageTrace;
  getDepthSelected(): number;
  throwIfCancelled(task: TaskNode): void;
  isExecutionCancelled(): boolean;
  pushMetadataError(message: string): void;
  emitExecution(event: ExecutionEvent): void;
  writeLoopMetadata(nodeId: string, metadata: QualityLoopMetadata): void;
  markExecutionNodeRunning(nodeId: string): void;
  markExecutionNodeCompleted(nodeId: string): void;
  markExecutionNodeFailed(
    nodeId: string,
    status: "failed" | "cancelled",
    detail?: ExecutionStatusUpdateDetail,
  ): void;
  setMetadataExecutionStatus(status: ExecutionStatus): void;
  summarizeQualityLoopUsage(
    metadata: QualityLoopMetadata,
    modelCallsTotal?: number,
  ): QualityLoopMetadata["usage"];
  log(stage: string, message: string, data?: Record<string, unknown>): void;
  withAgentSystemPrompt(
    messages: Parameters<LanguageModelPort["complete"]>[0],
  ): Parameters<LanguageModelPort["complete"]>[0];
  recordUsage(usage: LanguageModelUsage | undefined): void;
  updateExecutionNodeModel(
    nodeId: string,
    effectiveModel: string | undefined,
    overrideModel: string | undefined,
    effectiveSampling?: EffectiveSamplingMetadata | undefined,
  ): void;
  expertTierFor(task: TaskNode, purpose: LanguageModelPurpose | undefined): string | undefined;
  getQualityLoopDecision(nodeId: string): QualityLoopManualDecision | undefined;
}
const QUALITY_LOOP_RUBRICS: Record<
  QualityLoopRubricId,
  {
    label: string;
    criteria: QualityLoopRubricCriterion[];
  }
> = {
  general_answer_quality: {
    label: "General Answer Quality",
    criteria: [
      {
        id: "directness",
        label: "Directness",
        description: "Answers the user prompt without unnecessary detours.",
      },
      {
        id: "correctness",
        label: "Correctness",
        description: "Avoids unsupported claims and factual mistakes.",
      },
      {
        id: "completeness",
        label: "Completeness",
        description: "Covers the important parts of the request.",
      },
    ],
  },
  code_engineering: {
    label: "Code and Engineering",
    criteria: [
      {
        id: "behavior",
        label: "Behavior",
        description: "Implements the requested behavior without regressions.",
      },
      {
        id: "integration",
        label: "Integration",
        description: "Fits existing code structure, types, and tests.",
      },
      {
        id: "verification",
        label: "Verification",
        description: "Includes concrete checks for changed behavior.",
      },
    ],
  },
  planning_architecture: {
    label: "Planning and Architecture",
    criteria: [
      { id: "scope", label: "Scope", description: "Defines clear boundaries and dependencies." },
      {
        id: "tradeoffs",
        label: "Tradeoffs",
        description: "Surfaces relevant alternatives and consequences.",
      },
      {
        id: "sequence",
        label: "Sequence",
        description: "Orders work so each step is executable and verifiable.",
      },
    ],
  },
  user_facing_writing: {
    label: "User-Facing Writing",
    criteria: [
      {
        id: "audience",
        label: "Audience Fit",
        description: "Matches the user's audience and context.",
      },
      { id: "clarity", label: "Clarity", description: "Uses clear language and structure." },
      {
        id: "tone",
        label: "Tone",
        description: "Maintains the requested tone and level of polish.",
      },
    ],
  },
  structured_artifact: {
    label: "Structured Artifact",
    criteria: [
      {
        id: "schema",
        label: "Schema Fit",
        description: "Uses the requested structure and fields.",
      },
      {
        id: "parseability",
        label: "Parseability",
        description: "Can be consumed by downstream tools.",
      },
      {
        id: "coverage",
        label: "Coverage",
        description: "Includes all required items without extra ambiguity.",
      },
    ],
  },
};

function selectQualityLoopRubric(prompt: string, task: TaskNode): QualityLoopRubricSelection {
  const source =
    `${prompt}\n${task.kind ?? ""}\n${task.artifactContract?.outputSchema ?? ""}`.toLowerCase();
  const candidates: Array<{ id: QualityLoopRubricId; patterns: RegExp[] }> = [
    {
      id: "code_engineering",
      patterns: [
        /```/,
        /\bsrc\//,
        /\.[cm]?[tj]sx?\b/,
        /\btest\b/,
        /\bbug\b/,
        /\bfix\b/,
        /\brefactor\b/,
        /\bimplement\b/,
        /\btypescript\b/,
        /\bnode\b/,
      ],
    },
    {
      id: "planning_architecture",
      patterns: [
        /\bplan\b/,
        /\barchitecture\b/,
        /\broadmap\b/,
        /\bdesign\b/,
        /\btradeoff\b/,
        /\bsystem\b/,
        /\bphase\b/,
      ],
    },
    {
      id: "user_facing_writing",
      patterns: [
        /\brewrite\b/,
        /\bcopy\b/,
        /\bemail\b/,
        /\btone\b/,
        /\bblog\b/,
        /\bheadline\b/,
        /\bannouncement\b/,
        /\buser documentation\b/,
      ],
    },
    {
      id: "structured_artifact",
      patterns: [
        /\bjson\b/,
        /\byaml\b/,
        /\bschema\b/,
        /\btable\b/,
        /\bchecklist\b/,
        /\bfrontmatter\b/,
        /\bxml\b/,
        /\bcsv\b/,
      ],
    },
  ];

  let selected: QualityLoopRubricId = "general_answer_quality";
  let matchedSignals: string[] = [];
  for (const candidate of candidates) {
    const signals = candidate.patterns
      .filter((pattern) => pattern.test(source))
      .map((pattern) => pattern.source);
    if (signals.length > matchedSignals.length) {
      selected = candidate.id;
      matchedSignals = signals;
    }
  }

  const definition = QUALITY_LOOP_RUBRICS[selected];
  const fallback = selected === "general_answer_quality";
  return {
    id: selected,
    label: definition.label,
    rationale: fallback
      ? "Selected the general answer quality rubric because no more specific task signals were detected."
      : `Selected ${definition.label} because the prompt matched ${matchedSignals.length} task signal(s).`,
    matchedSignals,
    confidence: fallback ? 0.4 : Math.min(1, 0.45 + matchedSignals.length * 0.1),
    criteria: definition.criteria,
  };
}

function createEmptyLoopUsage(): QualityLoopMetadata["usage"] {
  return {
    iterationsStarted: 0,
    iterationsCompleted: 0,
    phaseCallCounts: {
      draft: 0,
      critique: 0,
      refine: 0,
      gate: 0,
      best_of_progress: 0,
    },
    modelCallsTotal: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    unknownCompletions: 0,
  };
}

function subtractUsage(after: TokenUsageTrace, before: TokenUsageTrace): TokenUsageTrace {
  return {
    inputTokens: after.inputTokens - before.inputTokens,
    outputTokens: after.outputTokens - before.outputTokens,
    totalTokens: after.totalTokens - before.totalTokens,
    unknownCompletions: after.unknownCompletions - before.unknownCompletions,
  };
}

function extractJsonObject(value: string): unknown {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("expected JSON object in evaluator output");
  }

  try {
    return JSON.parse(value.slice(start, end + 1));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid evaluator JSON: ${message}`);
  }
}

function parseQualityLoopCritique(
  value: string,
  phase: QualityLoopPhaseName,
): QualityLoopCritiqueEvaluation {
  const parsed = asRecord(extractJsonObject(value), "critique evaluator output");
  const summary = requireString(parsed, "summary");
  const resolved = requireBoolean(parsed, "resolved");
  const issues = parseIssueArray(parsed["issues"], phase);
  const suggestedImprovements = parseStringArray(
    parsed["suggestedImprovements"],
    "suggestedImprovements",
  );
  return { summary, issues, resolved, suggestedImprovements };
}

function parseQualityLoopGate(value: string): QualityLoopGateEvaluation {
  const parsed = asRecord(extractJsonObject(value), "gate evaluator output");
  const decision = requireString(parsed, "decision");
  if (decision !== "pass" && decision !== "continue") {
    throw new Error("gate decision must be pass or continue");
  }

  return {
    decision,
    score: requireNumber(parsed, "score"),
    passThreshold: requireNumber(parsed, "passThreshold"),
    rubricFit: requireBoolean(parsed, "rubricFit"),
    critiqueResolved: requireBoolean(parsed, "critiqueResolved"),
    meaningfulImprovement: requireBoolean(parsed, "meaningfulImprovement"),
    rationale: requireString(parsed, "rationale"),
    failedConditions: parseStringArray(parsed["failedConditions"], "failedConditions"),
    unresolvedIssues: parseIssueArray(parsed["unresolvedIssues"], "gate"),
  };
}

function parseQualityLoopBestOfProgress(
  value: string,
  fallbackCandidateId: string,
): { evaluation: QualityLoopBestOfProgressEvaluation; answerText?: string | undefined } {
  const parsed = asRecord(extractJsonObject(value), "best-of-progress evaluator output");
  const selectedCandidateId = optionalString(parsed["selectedCandidateId"]) ?? fallbackCandidateId;
  const answerText = optionalString(parsed["answer"]);
  return {
    evaluation: {
      selectedCandidateId,
      rationale: requireString(parsed, "rationale"),
      score: requireNumber(parsed, "score"),
      comparisonNotes: parseStringArray(parsed["comparisonNotes"], "comparisonNotes"),
    },
    answerText,
  };
}

function gatePasses(evaluation: QualityLoopGateEvaluation): boolean {
  return (
    evaluation.decision === "pass" &&
    evaluation.score >= evaluation.passThreshold &&
    evaluation.rubricFit &&
    evaluation.critiqueResolved &&
    evaluation.meaningfulImprovement &&
    !evaluation.unresolvedIssues.some((issue) => issue.severity === "error")
  );
}

function critiqueResolved(evaluation: QualityLoopGateEvaluation): boolean {
  return (
    evaluation.score >= evaluation.passThreshold &&
    evaluation.critiqueResolved &&
    evaluation.unresolvedIssues.every((issue) => issue.severity === "info")
  );
}

function hasMeaningfulImprovement(
  current: QualityLoopGateEvaluation,
  previous: QualityLoopGateEvaluation | undefined,
): boolean {
  if (!previous) {
    return true;
  }

  const unresolvedCount = (evaluation: QualityLoopGateEvaluation): number =>
    evaluation.unresolvedIssues.filter(
      (issue) => issue.severity === "warning" || issue.severity === "error",
    ).length;
  return (
    current.score - previous.score >= 0.05 || unresolvedCount(current) < unresolvedCount(previous)
  );
}

function selectBestQualityLoopCandidate(
  metadata: QualityLoopMetadata,
  evaluation: QualityLoopBestOfProgressEvaluation,
  gate: QualityLoopGateEvaluation | undefined,
): QualityLoopSelectionMetadata {
  const validSelected = metadata.candidates.find(
    (candidate) => candidate.id === evaluation.selectedCandidateId,
  );
  if (validSelected) {
    validSelected.score = evaluation.score;
    validSelected.selectionScore = scoreQualityLoopCandidate(validSelected, metadata, gate);
    return {
      selectedCandidateId: validSelected.id,
      rationale: evaluation.rationale,
      scoreBasis: [
        `best_of_progress_score:${evaluation.score}`,
        gate ? `gate_score:${gate.score}` : "gate_score:none",
        "valid_best_of_progress_selection",
      ],
      comparisonNotes: evaluation.comparisonNotes,
    };
  }

  const fallback = [...metadata.candidates]
    .map((candidate) => {
      const selectionScore = scoreQualityLoopCandidate(candidate, metadata, gate);
      candidate.selectionScore = selectionScore;
      return { candidate, selectionScore };
    })
    .sort(
      (a, b) =>
        b.selectionScore - a.selectionScore || b.candidate.iteration - a.candidate.iteration,
    )[0]?.candidate;

  if (!fallback) {
    throw new Error(
      `best_of_progress selected invalid candidate id ${evaluation.selectedCandidateId} and no fallback candidate exists`,
    );
  }

  return {
    selectedCandidateId: fallback.id,
    rationale: `Selected fallback candidate ${fallback.id} because best_of_progress referenced an invalid candidate id.`,
    scoreBasis: [
      `fallback_selection_score:${fallback.selectionScore ?? 0}`,
      gate ? `gate_score:${gate.score}` : "gate_score:none",
      "invalid_best_of_progress_selection",
    ],
    comparisonNotes: evaluation.comparisonNotes,
    fallbackReason: "invalid_best_of_progress_candidate",
    invalidCandidateId: evaluation.selectedCandidateId,
  };
}

function scoreQualityLoopCandidate(
  candidate: QualityLoopCandidateSummary,
  metadata: QualityLoopMetadata,
  gate: QualityLoopGateEvaluation | undefined,
): number {
  const candidateScore =
    candidate.score ??
    (candidate.phase === "best_of_progress"
      ? metadata.selection
        ? undefined
        : gate?.score
      : undefined) ??
    0;
  const iteration = metadata.iterations.find((item) => item.index === candidate.iteration);
  const issuePenalty = (iteration?.unresolvedIssues ?? []).reduce((total, issue) => {
    if (issue.severity === "error") {
      return total + 0.3;
    }
    if (issue.severity === "warning") {
      return total + 0.15;
    }
    return total + 0.03;
  }, 0);
  const phaseBonus =
    candidate.phase === "refine" ? 0.03 : candidate.phase === "best_of_progress" ? 0.02 : 0;
  const recencyBonus = candidate.iteration * 0.001;
  return candidateScore + phaseBonus + recencyBonus - issuePenalty;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number`);
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`${key} must be a boolean`);
  }
  return value;
}

function parseStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${key} must be a string array`);
  }
  return value;
}

function parseIssueArray(value: unknown, sourcePhase: QualityLoopPhaseName): QualityLoopIssue[] {
  if (!Array.isArray(value)) {
    throw new Error("issues must be an array");
  }
  return value.map((item, index): QualityLoopIssue => {
    const record = asRecord(item, "issue");
    const severity = requireString(record, "severity");
    if (severity !== "info" && severity !== "warning" && severity !== "error") {
      throw new Error("issue severity must be info, warning, or error");
    }
    return {
      id: optionalString(record["id"]) ?? `${sourcePhase}-issue-${index + 1}`,
      severity,
      text: requireString(record, "text"),
      sourcePhase,
    };
  });
}

function qualityLoopMessages(
  originalPrompt: string,
  phase: QualityLoopPhaseName,
  phaseOutputs: Map<QualityLoopPhaseName, string>,
): Parameters<LanguageModelPort["complete"]>[0] {
  const draft = phaseOutputs.get("draft") ?? "";
  const critique = phaseOutputs.get("critique") ?? "";
  const refine = phaseOutputs.get("refine") ?? "";
  const gate = phaseOutputs.get("gate") ?? "";
  const instructions: Record<QualityLoopPhaseName, string> = {
    draft: "Draft the best direct answer to the user prompt.",
    critique:
      "Return JSON only with summary, resolved, issues, and suggestedImprovements after critiquing the draft.",
    refine: "Refine the draft using the critique while preserving useful content.",
    gate: "Return JSON only with decision, score, passThreshold, rubricFit, critiqueResolved, meaningfulImprovement, rationale, failedConditions, and unresolvedIssues.",
    best_of_progress:
      "Return JSON only with selectedCandidateId, answer, rationale, score, and comparisonNotes for the best final answer.",
  };
  const context = [
    draft ? `Draft:\n${draft}` : "",
    critique ? `Critique:\n${critique}` : "",
    refine ? `Refine:\n${refine}` : "",
    gate ? `Gate:\n${gate}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    {
      role: "system",
      content: `${instructions[phase]} Do not call tools.`,
    },
    {
      role: "user",
      content: context ? `Original prompt:\n${originalPrompt}\n\n${context}` : originalPrompt,
    },
  ];
}

function qualityLoopStopMessage(
  stopReason: NonNullable<QualityLoopMetadata["stopReason"]>,
): string {
  switch (stopReason) {
    case "budget_exhausted":
      return "quality loop stopped: budget_exhausted";
    case "degraded":
      return "quality loop stopped: degraded";
    case "failed":
      return "quality loop stopped: failed";
    default:
      return `quality loop stopped: ${stopReason}`;
  }
}

function qualityLoopPhasePurpose(phase: QualityLoopPhaseName): LanguageModelPurpose {
  switch (phase) {
    case "draft":
      return "quality_loop_draft";
    case "critique":
      return "quality_loop_critique";
    case "refine":
      return "quality_loop_refine";
    case "gate":
      return "quality_loop_gate";
    case "best_of_progress":
      return "quality_loop_best_of_progress";
  }
}

// Generated by scripts/stitch-quality-loop.mjs from scripts/phase40-peel-source.ts — do not hand-edit.
export async function resolvePlannedModelAssignment(
  model: LanguageModelPort,
  complexityDepth: number,

  phase: QualityLoopPhaseName,
  purpose: LanguageModelPurpose,
  phaseOverride: string | undefined,
  nodeOverride: string | undefined,
): Promise<Omit<QualityLoopPhaseModelAssignment, "source" | "effectiveModel">> {
  const selectableModel = model as LanguageModelPort & {
    selectModel?: (
      purpose: LanguageModelPurpose | undefined,
      complexityDepth?: number,
    ) => Promise<{
      model: string;
      tier: string;
      hostId?: string | undefined;
      hostKind?: "ollama" | "http" | undefined;
      hostEndpoint?: string | undefined;
    }>;
    resolveOverrideSelection?: (options: LanguageModelCompleteOptions) => {
      model: string;
      tier: string;
    };
  };

  if (phaseOverride) {
    const resolved = selectableModel.resolveOverrideSelection?.({
      purpose,
      overrideModelSelection: phaseOverride,
    });
    return {
      phase,
      purpose,
      plannedSelection: phaseOverride,
      plannedModel: resolved?.model ?? phaseOverride,
      tier: resolved?.tier ?? "override",
    };
  }

  if (nodeOverride) {
    return {
      phase,
      purpose,
      plannedSelection: nodeOverride,
      plannedModel: nodeOverride,
      tier: "override",
    };
  }

  const selection = await selectableModel.selectModel?.(purpose, complexityDepth);
  return {
    phase,
    purpose,
    plannedSelection: selection?.tier ?? purpose,
    plannedModel: selection?.model ?? "resolved-at-runtime",
    tier: selection?.tier ?? "unknown",
    hostId: selection?.hostId,
    hostKind: selection?.hostKind,
    hostEndpoint: selection?.hostEndpoint,
  };
}

export async function completeQualityLoopPhase(
  host: QualityLoopHost,

  task: TaskNode,
  phase: QualityLoopPhaseName,
  messages: Parameters<LanguageModelPort["complete"]>[0],
  loopConfig: QualityLoopConfig,
  startedAt = new Date().toISOString(),
  checkManualDecision?: () => string | undefined,
): Promise<{
  content: string;
  model: string;
  modelAssignment: QualityLoopPhaseModelAssignment;
  usageDelta: TokenUsageTrace;
  modelCallsDelta: number;
  startedAt: string;
  completedAt: string;
}> {
  host.throwIfCancelled(task);
  if (!canSpendAnyModelCall(host.getModelCalls(), host.getMaxModelCalls())) {
    throw new Error(`model call budget reached before quality loop ${phase}`);
  }

  const usageBefore = { ...host.getTokenUsage() };
  const modelCallsBefore = host.getModelCalls();
  const purpose = qualityLoopPhasePurpose(phase);
  const phaseOverride = loopConfig.phaseModels?.[phase]?.trim();
  const source: QualityLoopPhaseModelAssignment["source"] = phaseOverride
    ? "phase_override"
    : task.modelOverride
      ? "node_override"
      : "configured";
  const planned = await resolvePlannedModelAssignment(
    host.model,
    host.getDepthSelected(),
    phase,
    purpose,
    phaseOverride,
    task.modelOverride,
  );
  host.consumeModelCall();
  const callNumber = host.getModelCalls();
  host.log("completion", "starting quality loop phase", {
    call: callNumber,
    task: task.id,
    phase,
    prompt: preview(messages.at(-1)?.content ?? ""),
  });
  let manualOutcome: string | undefined;
  const manualPoll = checkManualDecision
    ? setInterval(() => {
        const outcome = checkManualDecision();
        if (outcome !== undefined) {
          manualOutcome = outcome;
        }
      }, 50)
    : undefined;
  let response: Awaited<ReturnType<LanguageModelPort["complete"]>>;
  try {
    const expertTier = phaseOverride ? undefined : host.expertTierFor(task, purpose);
    response = await host.model.complete(host.withAgentSystemPrompt(messages), {
      tools: [],
      purpose,
      complexityDepth: host.getDepthSelected(),
      overrideModel: phaseOverride || expertTier ? undefined : task.modelOverride,
      overrideModelSelection: phaseOverride ?? expertTier,
      constrainedToolCalling: false,
      sampling: task.samplingOverride,
    });
  } finally {
    if (manualPoll) {
      clearInterval(manualPoll);
    }
  }
  const resolvedManualOutcome = checkManualDecision?.() ?? manualOutcome;
  if (resolvedManualOutcome !== undefined) {
    throw new QualityLoopManualExit(resolvedManualOutcome);
  }
  host.updateExecutionNodeModel(task.id, response.model, task.modelOverride, response.sampling);
  host.recordUsage(response.usage);
  const completedAt = new Date().toISOString();
  host.log("completion", "completed quality loop phase", {
    call: callNumber,
    task: task.id,
    phase,
    model: response.model,
    inputTokens: response.usage?.inputTokens,
    outputTokens: response.usage?.outputTokens,
    totalTokens: response.usage?.totalTokens,
    output: preview(response.content),
  });
  return {
    content: response.content,
    model: response.model ?? "unknown",
    modelAssignment: {
      ...planned,
      source,
      effectiveModel: response.model ?? planned.plannedModel,
      hostId: response.host?.id ?? planned.hostId,
      hostKind: response.host?.kind ?? planned.hostKind,
      hostEndpoint: response.host?.endpoint ?? planned.hostEndpoint,
    },
    usageDelta: subtractUsage(host.getTokenUsage(), usageBefore),
    modelCallsDelta: host.getModelCalls() - modelCallsBefore,
    startedAt,
    completedAt,
  };
}

export async function runQualityLoop(
  host: QualityLoopHost,
  task: TaskNode,
  config: RecursiveModelConfig,
): Promise<string> {
  const loopConfig = config.qualityLoop;
  if (!loopConfig?.enabled) {
    return "";
  }

  const metadata: QualityLoopMetadata = {
    config: loopConfig,
    status: "running",
    rubric: selectQualityLoopRubric(task.prompt, task),
    usage: createEmptyLoopUsage(),
    iterations: [],
    candidates: [],
    unresolvedIssues: [],
  };
  const candidateTexts = new Map<string, string>();
  let selectedCandidateId: string | undefined;
  const loopModelCallsBefore = host.getModelCalls();
  host.writeLoopMetadata(task.id, metadata);
  host.markExecutionNodeRunning(task.id);
  host.emitExecution({
    type: "execution",
    status: "running",
    nodeId: task.id,
    modelCallsUsed: host.getModelCalls(),
    modelCallsRemaining: remainingModelCalls(host.getModelCalls(), host.getMaxModelCalls()),
    toolCallsUsed: host.getToolCallsUsedCount(),
    message: "quality loop started",
  });

  const selectedText = (): string =>
    selectedCandidateId ? (candidateTexts.get(selectedCandidateId) ?? "") : "";
  const finish = (
    status: QualityLoopStatus,
    stopReason: NonNullable<QualityLoopMetadata["stopReason"]>,
    message: string,
  ): string => {
    metadata.status = status;
    metadata.stopReason = stopReason;
    metadata.message = message;
    metadata.usage = host.summarizeQualityLoopUsage(
      metadata,
      host.getModelCalls() - loopModelCallsBefore,
    );
    if (selectedCandidateId) {
      metadata.selectedCandidateId = selectedCandidateId;
    }
    host.writeLoopMetadata(task.id, metadata);
    if (status === "failed") {
      host.markExecutionNodeFailed(task.id, "failed", {
        failureCategory: "model",
        code: EXECUTION_FAILURE_CODES.model,
        message,
      });
    } else if (status === "cancelled") {
      host.markExecutionNodeFailed(task.id, "cancelled", {
        failureCategory: "cancelled",
        code: EXECUTION_FAILURE_CODES.cancelled,
        message,
      });
    } else {
      host.markExecutionNodeCompleted(task.id);
    }
    const stopEventMessage = qualityLoopStopMessage(stopReason);
    host.emitExecution({
      type: "execution",
      status: status === "failed" ? "failed" : status === "cancelled" ? "cancelled" : "completed",
      nodeId: task.id,
      modelCallsUsed: host.getModelCalls(),
      modelCallsRemaining: remainingModelCalls(host.getModelCalls(), host.getMaxModelCalls()),
      toolCallsUsed: host.getToolCallsUsedCount(),
      message: stopEventMessage,
    });
    if (status === "failed") {
      host.setMetadataExecutionStatus("failed");
    } else if (status === "cancelled") {
      host.setMetadataExecutionStatus("cancelled");
    } else {
      host.setMetadataExecutionStatus("completed");
    }
    return selectedText();
  };
  const applyManualDecision = (
    decision: QualityLoopManualDecision | undefined,
  ): string | undefined => {
    if (!decision) {
      return undefined;
    }
    if (decision.action === "stop") {
      return finish("stopped", "stopped", decision.reason);
    }
    if (selectedCandidateId) {
      return finish("completed", "human_accepted", decision.reason);
    }
    metadata.message = `${decision.reason}; waiting for first candidate before human acceptance applies`;
    host.writeLoopMetadata(task.id, metadata);
    return undefined;
  };
  const checkManualDecision = (): string | undefined =>
    applyManualDecision(host.getQualityLoopDecision(task.id));
  let previousGateEvaluation: QualityLoopGateEvaluation | undefined;

  const failEvaluatorParse = (
    iteration: QualityLoopIterationRecord,
    phaseRecord: QualityLoopPhaseRecord,
    phase: QualityLoopPhaseName,
    error: unknown,
  ): string => {
    const message = error instanceof Error ? error.message : String(error);
    const issue: QualityLoopIssue = {
      id: `loop-${task.id}-i${iteration.index}-${phase}-parse-failed`,
      severity: "error",
      text: message,
      sourcePhase: phase,
    };
    phaseRecord.parseStatus = selectedCandidateId ? "degraded" : "failed";
    phaseRecord.parseError = message;
    phaseRecord.unresolvedIssues = [...(phaseRecord.unresolvedIssues ?? []), issue];
    iteration.unresolvedIssues.push(issue);
    metadata.unresolvedIssues.push(issue);
    iteration.status = selectedCandidateId ? "degraded" : "failed";
    iteration.completedAt = new Date().toISOString();
    if (selectedCandidateId) {
      metadata.usage.iterationsCompleted += 1;
    }
    host.writeLoopMetadata(task.id, metadata);
    return selectedCandidateId
      ? finish("degraded", "degraded", `quality loop evaluator parse degraded: ${message}`)
      : finish("failed", "failed", `quality loop evaluator parse failed: ${message}`);
  };

  try {
    for (let iterationIndex = 0; iterationIndex < loopConfig.maxIterations; iterationIndex += 1) {
      const manualBeforeIteration = checkManualDecision();
      if (manualBeforeIteration !== undefined) {
        return manualBeforeIteration;
      }
      if (remainingModelCalls(host.getModelCalls(), host.getMaxModelCalls()) < 5) {
        return finish(
          "stopped",
          "budget_exhausted",
          "quality loop stopped before partial iteration",
        );
      }

      host.throwIfCancelled(task);
      const iteration: QualityLoopIterationRecord = {
        index: iterationIndex,
        status: "running",
        startedAt: new Date().toISOString(),
        phases: [],
        candidates: [],
        unresolvedIssues: [],
      };
      metadata.iterations.push(iteration);
      metadata.usage.iterationsStarted += 1;
      host.writeLoopMetadata(task.id, metadata);

      const phaseOutputs = new Map<QualityLoopPhaseName, string>();
      for (const phase of QUALITY_LOOP_PHASES) {
        const startedAt = new Date().toISOString();
        const phaseRecord: QualityLoopPhaseRecord = {
          phase,
          status: "running",
          startedAt,
          model: "unknown",
        };
        iteration.phases.push(phaseRecord);
        host.writeLoopMetadata(task.id, metadata);

        let phaseResult: Awaited<ReturnType<typeof completeQualityLoopPhase>>;
        try {
          phaseResult = await completeQualityLoopPhase(
            host,
            task,
            phase,
            qualityLoopMessages(task.prompt, phase, phaseOutputs),
            loopConfig,
            startedAt,
            checkManualDecision,
          );
        } catch (error: unknown) {
          if (error instanceof QualityLoopManualExit) {
            return error.answer;
          }
          phaseRecord.status = "failed";
          phaseRecord.completedAt = new Date().toISOString();
          phaseRecord.summary = error instanceof Error ? error.message : String(error);
          phaseRecord.usage = subtractUsage(host.getTokenUsage(), host.getTokenUsage());
          const issue: QualityLoopIssue = {
            id: `loop-${task.id}-i${iterationIndex}-${phase}-failed`,
            severity: "error",
            text: phaseRecord.summary,
            sourcePhase: phase,
          };
          phaseRecord.unresolvedIssues = [issue];
          iteration.unresolvedIssues.push(issue);
          metadata.unresolvedIssues.push(issue);
          host.writeLoopMetadata(task.id, metadata);
          throw error;
        }
        phaseOutputs.set(phase, phaseResult.content);
        metadata.usage.phaseCallCounts[phase] += phaseResult.modelCallsDelta;
        phaseRecord.status = "completed";
        phaseRecord.completedAt = phaseResult.completedAt;
        phaseRecord.summary = preview(phaseResult.content);
        phaseRecord.model = phaseResult.model;
        phaseRecord.plannedModel = phaseResult.modelAssignment.plannedModel;
        phaseRecord.modelPurpose = phaseResult.modelAssignment.purpose;
        phaseRecord.modelSelection = phaseResult.modelAssignment.plannedSelection;
        phaseRecord.modelSource = phaseResult.modelAssignment.source;
        phaseRecord.usage = phaseResult.usageDelta;
        metadata.phaseModels = {
          ...(metadata.phaseModels ?? {}),
          [phase]: phaseResult.modelAssignment,
        };
        if (phase === "draft" || phase === "refine" || phase === "best_of_progress") {
          const candidate: QualityLoopCandidateSummary = {
            id: `loop-${task.id}-i${iterationIndex}-${phase}`,
            iteration: iterationIndex,
            phase,
            summary: preview(phaseResult.content, 160),
          };
          candidateTexts.set(candidate.id, phaseResult.content);
          phaseRecord.candidateId = candidate.id;
          iteration.candidates.push(candidate);
          metadata.candidates.push(candidate);
        }
        try {
          if (phase === "critique") {
            iteration.critiqueEvaluation = parseQualityLoopCritique(phaseResult.content, phase);
            phaseRecord.parseStatus = "parsed";
          } else if (phase === "gate") {
            iteration.gateEvaluation = parseQualityLoopGate(phaseResult.content);
            metadata.gate = iteration.gateEvaluation;
            phaseRecord.parseStatus = "parsed";
          } else if (phase === "best_of_progress") {
            const candidateId =
              phaseRecord.candidateId ??
              selectedCandidateId ??
              `loop-${task.id}-i${iterationIndex}-${phase}`;
            selectedCandidateId = candidateId;
            const parsed = parseQualityLoopBestOfProgress(phaseResult.content, candidateId);
            iteration.bestOfProgressEvaluation = parsed.evaluation;
            phaseRecord.parseStatus = "parsed";
            if (parsed.answerText) {
              candidateTexts.set(candidateId, parsed.answerText);
              const candidate = iteration.candidates.find((item) => item.id === candidateId);
              if (candidate) {
                candidate.summary = preview(parsed.answerText, 160);
              }
            }
            const selection = selectBestQualityLoopCandidate(
              metadata,
              parsed.evaluation,
              iteration.gateEvaluation,
            );
            selectedCandidateId = selection.selectedCandidateId;
            metadata.selection = selection;
            for (const candidate of metadata.candidates) {
              candidate.isSelected = candidate.id === selectedCandidateId;
              if (candidate.isSelected) {
                candidate.selectionRationale = selection.rationale;
              }
            }
            if (selection.invalidCandidateId) {
              const issue: QualityLoopIssue = {
                id: `loop-${task.id}-i${iterationIndex}-invalid-selection`,
                severity: "warning",
                text: `best_of_progress selected invalid candidate id: ${selection.invalidCandidateId}`,
                sourcePhase: "best_of_progress",
              };
              phaseRecord.unresolvedIssues = [...(phaseRecord.unresolvedIssues ?? []), issue];
              iteration.unresolvedIssues.push(issue);
              metadata.unresolvedIssues.push(issue);
              iteration.status = "degraded";
              iteration.completedAt = new Date().toISOString();
              metadata.usage.iterationsCompleted += 1;
              host.writeLoopMetadata(task.id, metadata);
              return finish(
                "degraded",
                "degraded",
                "quality loop best-of-progress selected an invalid candidate",
              );
            }
          }
        } catch (error: unknown) {
          return failEvaluatorParse(iteration, phaseRecord, phase, error);
        }
        metadata.usage = host.summarizeQualityLoopUsage(
          metadata,
          host.getModelCalls() - loopModelCallsBefore,
        );
        host.writeLoopMetadata(task.id, metadata);
        host.emitExecution({
          type: "execution",
          status: "running",
          nodeId: task.id,
          modelCallsUsed: host.getModelCalls(),
          modelCallsRemaining: remainingModelCalls(host.getModelCalls(), host.getMaxModelCalls()),
          toolCallsUsed: host.getToolCallsUsedCount(),
          message: `quality loop phase completed: ${phase}`,
        });
        const manualAfterPhase = checkManualDecision();
        if (manualAfterPhase !== undefined) {
          return manualAfterPhase;
        }
      }

      iteration.status = "completed";
      iteration.completedAt = new Date().toISOString();
      metadata.usage.iterationsCompleted += 1;
      host.writeLoopMetadata(task.id, metadata);
      const gateEvaluation = iteration.gateEvaluation;
      if (gateEvaluation) {
        const manualBeforeGateDecision = checkManualDecision();
        if (manualBeforeGateDecision !== undefined) {
          return manualBeforeGateDecision;
        }
        if (gatePasses(gateEvaluation)) {
          return finish("completed", "passed", "quality loop passed gate");
        }
        if (critiqueResolved(gateEvaluation)) {
          return finish("completed", "critique_resolved", "quality loop critique resolved");
        }
        if (!hasMeaningfulImprovement(gateEvaluation, previousGateEvaluation)) {
          return finish(
            "completed",
            "no_meaningful_improvement",
            "quality loop stopped with no meaningful improvement",
          );
        }
        previousGateEvaluation = gateEvaluation;
      }
    }

    return finish("completed", "max_iterations", "quality loop reached max iterations");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (host.isExecutionCancelled()) {
      return finish("cancelled", "stopped", message);
    }
    host.pushMetadataError(message);
    return finish("failed", "failed", message);
  }
}
