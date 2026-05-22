import type {
  EffectiveSamplingMetadata,
  LanguageModelCompleteOptions,
  LanguageModelPort,
} from "../ports/language-model-port.js";
import type { LanguageModelPurpose } from "../ports/language-model-port.js";
import type { LanguageModelUsage } from "../ports/language-model-port.js";
import type { RuntimeLogger } from "../ports/runtime-logger-port.js";
import type { ToolExecutionResult } from "../ports/tool-port.js";
import type { ToolPort } from "../ports/tool-port.js";
import type { TracePort } from "../ports/trace-port.js";
import type {
  ExecutionEvent,
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
  RecursivePromptMetadata,
  RecursivePromptRequest,
  RecursivePromptResult,
  SolvedTask,
  TaskNode,
  TokenUsageTrace,
  ToolCallRecord,
  ComposerContextPolicy,
} from "./types.js";
import { EXECUTION_FAILURE_CODES } from "./execution-failure.js";
import { RunStatePersistence } from "./run-state-persistence.js";

const DIRECT = "DIRECT";
const RECURSIVE = "RECURSIVE";
const QUALITY_LOOP_PHASES: QualityLoopPhaseName[] = [
  "draft",
  "critique",
  "refine",
  "gate",
  "best_of_progress",
];

class QualityLoopManualExit extends Error {
  constructor(public readonly answer: string) {
    super("quality loop manual exit");
    this.name = "QualityLoopManualExit";
  }
}

export class RecursiveLanguageModel {
  private nextId = 1;
  private modelCalls = 0;
  private maxModelCalls = Number.POSITIVE_INFINITY;
  private toolRoundLimit = 0;
  private agentSystemPrompt = "";
  private metadata: RecursivePromptMetadata = createEmptyMetadata();
  private logger: RuntimeLogger | undefined;
  private execution: RecursivePromptRequest["execution"] | undefined;
  private memory: RecursivePromptRequest["memory"] | undefined;
  private runStatePersistence: RunStatePersistence | undefined;
  private runStateWrites: Array<Promise<void>> = [];
  private initialApprovalBoundaryPassed = false;
  private executionNodes = new Map<
    string,
    NonNullable<RecursivePromptMetadata["executionGraph"]>["nodes"][number]
  >();
  private executionEdges: NonNullable<RecursivePromptMetadata["executionGraph"]>["edges"] = [];
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
    this.execution = request.execution;
    this.memory = request.memory;
    this.runStatePersistence = request.runState
      ? new RunStatePersistence(request.runState, (event) => this.emitExecution(event))
      : undefined;
    this.runStateWrites = [];
    this.initialApprovalBoundaryPassed = false;
    if (request.agent) {
      this.agentSystemPrompt = request.agent.systemPrompt;
      this.metadata.agent = {
        id: request.agent.id,
        source: request.agent.source,
      };
    } else {
      this.agentSystemPrompt = "";
    }
    await this.initializeRunState(request.prompt);
    if (request.config.qualityLoop?.enabled === true) {
      const config: RecursiveModelConfig = {
        ...request.config,
        maxDepth: request.config.maxDepth ?? 0,
      };
      const root: TaskNode = {
        id: this.createId(),
        prompt: this.limitPrompt(request.prompt, config),
        depth: 0,
      };
      this.ensureExecutionNode(root, "quality-loop", request.prompt);
      this.metadata.executionStatus = request.execution?.planOnly ? "planned" : "running";
      this.emitExecution({
        type: "execution",
        status: this.metadata.executionStatus,
        nodeId: root.id,
        modelCallsUsed: this.modelCalls,
        modelCallsRemaining: this.remainingModelCalls(),
        toolCallsUsed: this.metadata.toolCalls.length,
        message: request.execution?.planOnly ? "quality loop plan created" : "quality loop started",
      });

      if (request.execution?.planOnly) {
        this.updateExecutionGraph();
        this.metadata.budget = {
          estimatedModelCalls: Math.min(
            config.maxModelCalls,
            request.config.qualityLoop.maxIterations * QUALITY_LOOP_PHASES.length,
          ),
          estimatedToolRounds: 0,
          modelCallsUsed: 0,
          modelCallsRemaining: this.maxModelCalls,
          toolCallsUsed: 0,
        };
        return {
          answer: "",
          trace: this.trace.events(),
          metadata: this.metadata,
        };
      }

      const approved = await this.waitForNodeApproval(root);
      if (approved === "skipped") {
        await this.flushRunStateWrites();
        this.metadata.modelCalls = this.modelCalls;
        this.metadata.executionStatus = "skipped";
        this.updateExecutionGraph();
        return {
          answer: "",
          trace: this.trace.events(),
          metadata: this.metadata,
        };
      }

      const answer = await this.runQualityLoop(approved, config);
      await this.flushRunStateWrites();
      this.metadata.modelCalls = this.modelCalls;
      this.updateExecutionGraph();
      this.log("run", "completed quality loop run", {
        modelCalls: this.metadata.modelCalls,
        inputTokens: this.metadata.tokenUsage.inputTokens,
        outputTokens: this.metadata.tokenUsage.outputTokens,
        totalTokens: this.metadata.tokenUsage.totalTokens,
        unknownCompletions: this.metadata.tokenUsage.unknownCompletions,
        executionStatus: this.metadata.executionStatus,
        stopReason: this.metadata.qualityLoop?.stopReason,
      });
      return {
        answer,
        trace: this.trace.events(),
        metadata: this.metadata,
      };
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
    this.ensureExecutionNode(root, "task", request.prompt);
    this.metadata.executionStatus = request.execution?.planOnly ? "planned" : "running";
    this.emitExecution({
      type: "execution",
      status: this.metadata.executionStatus,
      nodeId: root.id,
      modelCallsUsed: this.modelCalls,
      modelCallsRemaining: this.remainingModelCalls(),
      toolCallsUsed: this.metadata.toolCalls.length,
      message: request.execution?.planOnly ? "execution plan created" : "execution started",
    });

    if (request.execution?.planOnly) {
      this.updateExecutionGraph();
      this.metadata.budget = {
        estimatedModelCalls: this.estimateModelCalls(config),
        estimatedToolRounds: this.estimateToolRounds(config),
        modelCallsUsed: 0,
        modelCallsRemaining: this.maxModelCalls,
        toolCallsUsed: 0,
      };
      return {
        answer: "",
        trace: this.trace.events(),
        metadata: this.metadata,
      };
    }

    try {
      const answer = await this.solve(root, config);
      // Do not report completed when errors or failed nodes indicate a degraded/failed run (D-01 / D-09).
      this.syncExecutionStatusWithOutcome();
      await this.flushRunStateWrites();
      this.metadata.modelCalls = this.modelCalls;
      this.log("run", "completed recursive run", {
        modelCalls: this.metadata.modelCalls,
        inputTokens: this.metadata.tokenUsage.inputTokens,
        outputTokens: this.metadata.tokenUsage.outputTokens,
        totalTokens: this.metadata.tokenUsage.totalTokens,
        unknownCompletions: this.metadata.tokenUsage.unknownCompletions,
        executionStatus: this.metadata.executionStatus,
      });
      this.updateExecutionGraph();
      return {
        answer,
        trace: this.trace.events(),
        metadata: this.metadata,
      };
    } catch (error: unknown) {
      if (!this.execution?.isCancelled()) {
        this.metadata.executionStatus = "failed";
        const detail: ExecutionStatusUpdateDetail = {
          failureCategory: "internal",
          code: EXECUTION_FAILURE_CODES.internal,
          message: error instanceof Error ? error.message : String(error),
        };
        for (const node of this.executionNodes.values()) {
          if (node.status === "running") {
            this.markExecutionNodeFailed(node.id, "failed", detail);
          }
        }
      }

      this.updateExecutionGraph();
      await this.flushRunStateWrites();
      throw error;
    }
  }

  private async runQualityLoop(task: TaskNode, config: RecursiveModelConfig): Promise<string> {
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
    const loopModelCallsBefore = this.modelCalls;
    this.writeLoopMetadata(task.id, metadata);
    this.markExecutionNodeRunning(task.id);
    this.emitExecution({
      type: "execution",
      status: "running",
      nodeId: task.id,
      modelCallsUsed: this.modelCalls,
      modelCallsRemaining: this.remainingModelCalls(),
      toolCallsUsed: this.metadata.toolCalls.length,
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
      metadata.usage = this.summarizeQualityLoopUsage(
        metadata,
        this.modelCalls - loopModelCallsBefore,
      );
      if (selectedCandidateId) {
        metadata.selectedCandidateId = selectedCandidateId;
      }
      this.writeLoopMetadata(task.id, metadata);
      if (status === "failed") {
        this.markExecutionNodeFailed(task.id, "failed", {
          failureCategory: "model",
          code: EXECUTION_FAILURE_CODES.model,
          message,
        });
      } else if (status === "cancelled") {
        this.markExecutionNodeFailed(task.id, "cancelled", {
          failureCategory: "cancelled",
          code: EXECUTION_FAILURE_CODES.cancelled,
          message,
        });
      } else {
        this.markExecutionNodeCompleted(task.id);
      }
      const stopEventMessage = qualityLoopStopMessage(stopReason);
      this.emitExecution({
        type: "execution",
        status: status === "failed" ? "failed" : status === "cancelled" ? "cancelled" : "completed",
        nodeId: task.id,
        modelCallsUsed: this.modelCalls,
        modelCallsRemaining: this.remainingModelCalls(),
        toolCallsUsed: this.metadata.toolCalls.length,
        message: stopEventMessage,
      });
      if (status === "failed") {
        this.metadata.executionStatus = "failed";
      } else if (status === "cancelled") {
        this.metadata.executionStatus = "cancelled";
      } else {
        this.metadata.executionStatus = "completed";
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
      this.writeLoopMetadata(task.id, metadata);
      return undefined;
    };
    const checkManualDecision = (): string | undefined =>
      applyManualDecision(this.execution?.getQualityLoopDecision?.(task.id));
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
      this.writeLoopMetadata(task.id, metadata);
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
        if (this.remainingModelCalls() < 5) {
          return finish(
            "stopped",
            "budget_exhausted",
            "quality loop stopped before partial iteration",
          );
        }

        this.throwIfCancelled(task);
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
        this.writeLoopMetadata(task.id, metadata);

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
          this.writeLoopMetadata(task.id, metadata);

          let phaseResult: Awaited<ReturnType<typeof this.completeQualityLoopPhase>>;
          try {
            phaseResult = await this.completeQualityLoopPhase(
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
            phaseRecord.usage = subtractUsage(this.metadata.tokenUsage, this.metadata.tokenUsage);
            const issue: QualityLoopIssue = {
              id: `loop-${task.id}-i${iterationIndex}-${phase}-failed`,
              severity: "error",
              text: phaseRecord.summary,
              sourcePhase: phase,
            };
            phaseRecord.unresolvedIssues = [issue];
            iteration.unresolvedIssues.push(issue);
            metadata.unresolvedIssues.push(issue);
            this.writeLoopMetadata(task.id, metadata);
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
                this.writeLoopMetadata(task.id, metadata);
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
          metadata.usage = this.summarizeQualityLoopUsage(
            metadata,
            this.modelCalls - loopModelCallsBefore,
          );
          this.writeLoopMetadata(task.id, metadata);
          this.emitExecution({
            type: "execution",
            status: "running",
            nodeId: task.id,
            modelCallsUsed: this.modelCalls,
            modelCallsRemaining: this.remainingModelCalls(),
            toolCallsUsed: this.metadata.toolCalls.length,
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
        this.writeLoopMetadata(task.id, metadata);
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
      if (this.execution?.isCancelled()) {
        return finish("cancelled", "stopped", message);
      }
      this.metadata.errors.push(message);
      return finish("failed", "failed", message);
    }
  }

  private async completeQualityLoopPhase(
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
    this.throwIfCancelled(task);
    if (!this.canSpendAnyModelCall()) {
      throw new Error(`model call budget reached before quality loop ${phase}`);
    }

    const usageBefore = { ...this.metadata.tokenUsage };
    const modelCallsBefore = this.modelCalls;
    const purpose = qualityLoopPhasePurpose(phase);
    const phaseOverride = loopConfig.phaseModels?.[phase]?.trim();
    const source: QualityLoopPhaseModelAssignment["source"] = phaseOverride
      ? "phase_override"
      : task.modelOverride
        ? "node_override"
        : "configured";
    const planned = await this.resolvePlannedModelAssignment(
      phase,
      purpose,
      phaseOverride,
      task.modelOverride,
    );
    this.modelCalls += 1;
    const callNumber = this.modelCalls;
    this.log("completion", "starting quality loop phase", {
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
      const expertTier = phaseOverride ? undefined : this.expertTierFor(task, purpose);
      response = await this.model.complete(this.withAgentSystemPrompt(messages), {
        tools: [],
        purpose,
        complexityDepth: this.metadata.depth.selected,
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
    this.updateExecutionNodeModel(task.id, response.model, task.modelOverride, response.sampling);
    this.recordUsage(response.usage);
    const completedAt = new Date().toISOString();
    this.log("completion", "completed quality loop phase", {
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
      usageDelta: subtractUsage(this.metadata.tokenUsage, usageBefore),
      modelCallsDelta: this.modelCalls - modelCallsBefore,
      startedAt,
      completedAt,
    };
  }

  private async resolvePlannedModelAssignment(
    phase: QualityLoopPhaseName,
    purpose: LanguageModelPurpose,
    phaseOverride: string | undefined,
    nodeOverride: string | undefined,
  ): Promise<Omit<QualityLoopPhaseModelAssignment, "source" | "effectiveModel">> {
    const selectableModel = this.model as LanguageModelPort & {
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

    const selection = await selectableModel.selectModel?.(purpose, this.metadata.depth.selected);
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

  private async solve(task: TaskNode, config: RecursiveModelConfig): Promise<string> {
    this.throwIfCancelled(task);
    const approval = await this.waitForNodeApproval(task);
    if (approval === "skipped") {
      return "";
    }
    task = approval;
    this.markExecutionNodeRunning(task.id);
    this.log("task", "solving task", {
      id: task.id,
      depth: task.depth,
      maxDepth: config.maxDepth ?? 0,
      prompt: preview(task.prompt),
    });
    if (isCodeTask(task)) {
      const codeTrace: {
        id: string;
        parentId?: string;
        depth: number;
        kind: "code_execution";
        prompt: string;
        output: string;
      } = {
        id: task.id,
        depth: task.depth,
        kind: "code_execution",
        prompt: task.prompt,
        output: "executing code-only node",
      };
      if (task.parentId) {
        codeTrace.parentId = task.parentId;
      }
      this.trace.record(codeTrace);
      this.emitExecution({
        type: "execution",
        status: "running",
        nodeId: task.id,
        subtype: "code_execution",
        message: "executing code-only node",
      });
    }
    const maxDepth = config.maxDepth ?? 0;
    if (task.depth >= maxDepth) {
      const answer = await this.answerDirectly(task, "Depth limit reached; answer directly.");
      await this.appendMemorySummary(task, answer);
      this.markExecutionNodeCompleted(task.id);
      this.log("task", "completed task", {
        id: task.id,
        depth: task.depth,
        mode: "direct",
      });
      return answer;
    }

    if (this.remainingModelCalls() <= 1) {
      const answer = await this.answerDirectly(
        task,
        "Model call budget is nearly exhausted; answer directly.",
      );
      await this.appendMemorySummary(task, answer);
      this.markExecutionNodeCompleted(task.id);
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
      await this.appendMemorySummary(task, answer);
      this.markExecutionNodeCompleted(task.id);
      this.log("task", "completed task", {
        id: task.id,
        depth: task.depth,
        mode: "direct",
      });
      return answer;
    }

    if (!this.hasCallReservedForDirectAnswer(config)) {
      const answer = await this.answerDirectly(
        task,
        "Model call budget is nearly exhausted; answer directly.",
      );
      await this.appendMemorySummary(task, answer);
      this.markExecutionNodeCompleted(task.id);
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
      const answer = await this.answerDirectly(
        task,
        "No useful subtasks were found; answer directly.",
      );
      await this.appendMemorySummary(task, answer);
      this.markExecutionNodeCompleted(task.id);
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

      try {
        const answer = await this.solve(child, config);
        const summary =
          this.remainingModelCalls() > 1 ? await this.summarize(child, answer) : answer;
        solvedChildren.push({
          id: child.id,
          prompt: child.prompt,
          answer,
          summary,
        });
      } catch (error: unknown) {
        this.markExecutionNodeFailed(child.id, "failed", {
          failureCategory: "internal",
          code: EXECUTION_FAILURE_CODES.nodeFailed,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    const answer = await (this.canSpendAnyModelCall()
      ? this.synthesize(task, solvedChildren)
      : this.synthesizeWithoutModel(task, solvedChildren));
    await this.appendMemorySummary(task, answer);
    this.log("task", "completed task", {
      id: task.id,
      depth: task.depth,
      mode: "recursive",
      children: solvedChildren.length,
    });
    this.markExecutionNodeCompleted(task.id);
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
    return (
      output
        .trim()
        .split(/[\s:.-]+/, 1)[0]
        ?.toUpperCase() ?? DIRECT
    );
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
    for (const child of children) {
      this.ensureExecutionNode(child, "task", child.prompt);
    }
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
    const output = await this.complete(
      task,
      "answer",
      [
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
      ],
      true,
    );
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
        content:
          "Compress this solved subtask into the shortest useful summary for a parent synthesis step.",
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

    const output = await this.complete(
      task,
      "synthesize",
      [
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
      ],
      true,
    );
    this.record(task, "synthesize", task.prompt, output);
    return output;
  }

  private synthesizeWithoutModel(task: TaskNode, solvedChildren: SolvedTask[]): string {
    const output = solvedChildren.map((child) => `${child.prompt}: ${child.summary}`).join("\n");
    this.record(task, "synthesize", task.prompt, output);
    return output;
  }

  private async complete(
    task: TaskNode,
    kind: Parameters<TracePort["record"]>[0]["kind"],
    messages: Parameters<LanguageModelPort["complete"]>[0],
    allowTools = false,
  ): Promise<string> {
    this.throwIfCancelled(task);
    if (!this.canSpendAnyModelCall()) {
      this.recordLimit(task, `model call budget reached before ${kind}`);
      return fallbackFromMessages(messages);
    }

    const memoryPacket = await this.resolveMemoryPacket(task);
    const conversation = memoryPacket?.text
      ? [{ role: "system" as const, content: memoryPacket.text }, ...messages]
      : [...messages];
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
      const purpose = toModelPurpose(kind);
      const expertTier = this.expertTierFor(task, purpose);
      const response = await this.model.complete(this.withAgentSystemPrompt(conversation), {
        tools: allowTools ? this.toolsForTask(task) : [],
        purpose,
        complexityDepth: this.metadata.depth.selected,
        overrideModel: expertTier ? undefined : task.modelOverride,
        overrideModelSelection: expertTier,
        constrainedToolCalling: allowTools && this.toolsForTask(task).length > 0,
        sampling: task.samplingOverride,
      });
      this.updateExecutionNodeModel(task.id, response.model, task.modelOverride, response.sampling);
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
        const clarificationPrompt = parseClarificationRequest(response.content);
        if (clarificationPrompt) {
          const answer = await this.requestClarification(task, clarificationPrompt);
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
        this.record(task, "error", task.prompt, output);
        this.metadata.errors.push(output);
        this.markExecutionNodeFailed(task.id, "failed", {
          failureCategory: "model",
          code: EXECUTION_FAILURE_CODES.model,
          message: output,
        });
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
        const tool = this.toolsByName.get(toolCall.name);
        this.throwIfCancelled(task);
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
          this.markExecutionNodeFailed(task.id, "failed", {
            failureCategory: "tool",
            code: EXECUTION_FAILURE_CODES.tool,
            message: result.output,
          });
        }
        this.log("tool", result.status === "success" ? "completed tool call" : "failed tool call", {
          task: task.id,
          call: toolCall.id,
          name: toolCall.name,
          status: result.status,
          durationMs,
          output: preview(result.output),
        });
        this.record(
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
    const purpose = toModelPurpose(kind);
    const expertTier = this.expertTierFor(task, purpose);
    const response = await this.model.complete(this.withAgentSystemPrompt(messages), {
      tools: [],
      purpose,
      complexityDepth: this.metadata.depth.selected,
      overrideModel: expertTier ? undefined : task.modelOverride,
      overrideModelSelection: expertTier,
      constrainedToolCalling: false,
      sampling: task.samplingOverride,
    });
    this.updateExecutionNodeModel(task.id, response.model, task.modelOverride, response.sampling);
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
    this.ensureExecutionNode(task, "task", task.prompt);
    const approvedTask = await this.waitForNodeApproval(task);
    if (approvedTask === "skipped") {
      this.metadata.depth = { selected: 0, source: "fallback" };
      return 0;
    }
    this.markExecutionNodeRunning(task.id);
    this.log("depth", "selecting recursion depth", {
      maxDynamicDepth,
      prompt: preview(approvedTask.prompt),
    });
    const output = await this.complete(approvedTask, "depth", [
      {
        role: "system",
        content:
          `Choose a recursion depth from 0 to ${maxDynamicDepth} for the user's task complexity. ` +
          "Return only the integer. Use 0 for trivial tasks, 1 for simple multi-step tasks, " +
          "2 for normal analysis, 3 for complex work, and 4 only for highly complex work.",
      },
      {
        role: "user",
        content: approvedTask.prompt,
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
    this.record(approvedTask, "depth", approvedTask.prompt, output);
    this.markExecutionNodeCompleted(task.id);
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

  private withAgentSystemPrompt(
    messages: Parameters<LanguageModelPort["complete"]>[0],
  ): Parameters<LanguageModelPort["complete"]>[0] {
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

  private async resolveMemoryPacket(task: TaskNode): Promise<{ text: string } | undefined> {
    if (!this.memory) {
      return undefined;
    }

    const policy =
      task.contextPolicy ??
      this.executionNodes.get(task.id)?.composer?.contextPolicy ??
      defaultMemoryPolicy();
    try {
      const packet = await this.memory.buildPacket({
        nodeId: task.id,
        prompt: task.prompt,
        policy,
      });
      if (!packet) {
        return undefined;
      }
      this.metadata.memoryPackets = [...(this.metadata.memoryPackets ?? []), packet.metadata];
      if (packet.metadata.degraded) {
        this.emitExecution({
          type: "execution",
          status: "running",
          nodeId: task.id,
          modelCallsUsed: this.modelCalls,
          modelCallsRemaining: this.remainingModelCalls(),
          toolCallsUsed: this.metadata.toolCalls.length,
          message: `memory context degraded: ${packet.metadata.reasons.join("; ") || "unknown reason"}`,
        });
      }
      return packet.text ? { text: packet.text } : undefined;
    } catch (error: unknown) {
      this.emitExecution({
        type: "execution",
        status: "running",
        nodeId: task.id,
        modelCallsUsed: this.modelCalls,
        modelCallsRemaining: this.remainingModelCalls(),
        toolCallsUsed: this.metadata.toolCalls.length,
        message: `memory context unavailable: ${error instanceof Error ? error.message : String(error)}`,
      });
      return undefined;
    }
  }

  private async appendMemorySummary(task: TaskNode, answer: string): Promise<void> {
    if (!this.memory) {
      return;
    }

    const policy =
      task.contextPolicy ??
      this.executionNodes.get(task.id)?.composer?.contextPolicy ??
      defaultMemoryPolicy();
    try {
      await this.memory.appendNodeSummary({
        nodeId: task.id,
        summary: answer,
        scopeIds: policy.memoryScopes,
      });
    } catch (error: unknown) {
      this.emitExecution({
        type: "execution",
        status: "running",
        nodeId: task.id,
        modelCallsUsed: this.modelCalls,
        modelCallsRemaining: this.remainingModelCalls(),
        toolCallsUsed: this.metadata.toolCalls.length,
        message: `memory summary unavailable: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  private record(
    task: TaskNode,
    kind: Parameters<TracePort["record"]>[0]["kind"],
    prompt: string,
    output: string,
  ): void {
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
    this.updateExecutionGraph();
  }

  private recordUsage(usage: LanguageModelUsage | undefined): void {
    if (!usage) {
      this.metadata.tokenUsage.unknownCompletions += 1;
      return;
    }

    this.metadata.tokenUsage.inputTokens += usage.inputTokens ?? 0;
    this.metadata.tokenUsage.outputTokens += usage.outputTokens ?? 0;
    this.metadata.tokenUsage.totalTokens +=
      usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
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
    this.markExecutionNodeFailed(task.id, "failed", {
      failureCategory: "model",
      code: EXECUTION_FAILURE_CODES.model,
      message,
    });
    this.log("limit", message, {
      task: task.id,
      depth: task.depth,
      modelCalls: this.modelCalls,
      maxModelCalls: this.maxModelCalls,
    });
  }

  private throwIfCancelled(task: TaskNode): void {
    if (!this.execution?.isCancelled()) {
      return;
    }

    const reason = this.execution.cancelReason?.() ?? "execution cancelled";
    this.metadata.executionStatus = "cancelled";
    this.markExecutionNodeFailed(task.id, "cancelled", {
      failureCategory: "cancelled",
      code: EXECUTION_FAILURE_CODES.cancelled,
      message: reason,
    });
    this.emitExecution({
      type: "execution",
      status: "cancelled",
      nodeId: task.id,
      modelCallsUsed: this.modelCalls,
      modelCallsRemaining: this.remainingModelCalls(),
      toolCallsUsed: this.metadata.toolCalls.length,
      message: reason,
    });
    throw new Error(reason);
  }

  private ensureExecutionNode(task: TaskNode, kind: "task" | "quality-loop", label: string): void {
    if (!this.executionNodes.has(task.id)) {
      const node: NonNullable<RecursivePromptMetadata["executionGraph"]>["nodes"][number] = {
        id: task.id,
        kind,
        label: preview(label, 80),
        prompt: task.prompt,
        originalPrompt: task.prompt,
        plannedModel: task.modelOverride ?? "resolved-at-runtime",
        modelOverride: task.modelOverride,
        modelOverrideSource: task.modelOverride ? "user" : "none",
        samplingOverride: task.samplingOverride,
        expertAgentId: task.expertAgentId,
        expertAssignmentMode: task.expertAssignmentMode,
        expertRuntime: task.expertRuntime,
        expertToolAllowlist: task.expertToolAllowlist,
        expertPurposeTiers: task.expertPurposeTiers,
        editableFields: ["prompt"],
        depth: task.depth,
        status: "ready",
        approvalMode: this.execution?.approvalMode,
        approvalSource: "none",
        spawnedAfterInitialApproval:
          this.initialApprovalBoundaryPassed && task.parentId !== undefined,
        autoApprovalPaused: this.execution?.autoApprovalPaused?.() ?? false,
      };
      if (task.parentId) {
        node.parentId = task.parentId;
      }
      this.executionNodes.set(task.id, node);
      if (task.parentId) {
        this.executionEdges.push({
          from: task.parentId,
          to: task.id,
        });
      }
      this.updateExecutionGraph();
      this.execution?.registerNode?.(node);
    }
  }

  private writeLoopMetadata(nodeId: string, metadata: QualityLoopMetadata): void {
    this.metadata.qualityLoop = metadata;
    const node = this.executionNodes.get(nodeId);
    if (node) {
      node.loop = metadata;
      this.execution?.registerNode?.({ ...node });
    }
    this.updateExecutionGraph();
  }

  private summarizeQualityLoopUsage(
    metadata: QualityLoopMetadata,
    modelCallsTotal?: number,
  ): QualityLoopMetadata["usage"] {
    return {
      ...metadata.usage,
      modelCallsTotal:
        modelCallsTotal ??
        Object.values(metadata.usage.phaseCallCounts).reduce((total, count) => total + count, 0),
      inputTokens: this.metadata.tokenUsage.inputTokens,
      outputTokens: this.metadata.tokenUsage.outputTokens,
      totalTokens: this.metadata.tokenUsage.totalTokens,
      unknownCompletions: this.metadata.tokenUsage.unknownCompletions,
    };
  }

  private markExecutionNodeRunning(nodeId: string): void {
    const node = this.executionNodes.get(nodeId);
    if (!node) {
      return;
    }

    node.status = "running";
    node.startedAt = new Date().toISOString();
    this.metadata.executionStatus = "running";
    this.updateExecutionGraph();
    this.runStateWrites.push(this.persistNodeStatus(nodeId, "running"));
    this.execution?.updateNodeStatus?.(nodeId, "running");
    this.emitExecution({
      type: "execution",
      status: "running",
      nodeId,
      modelCallsUsed: this.modelCalls,
      modelCallsRemaining: this.remainingModelCalls(),
      toolCallsUsed: this.metadata.toolCalls.length,
    });
  }

  private markExecutionNodeCompleted(nodeId: string): void {
    const node = this.executionNodes.get(nodeId);
    if (!node) {
      return;
    }
    if (node.status === "failed" || node.status === "cancelled") {
      return;
    }

    node.status = "completed";
    node.completedAt = new Date().toISOString();
    this.updateExecutionGraph();
    this.runStateWrites.push(this.persistNodeStatus(nodeId, "completed"));
    this.execution?.updateNodeStatus?.(nodeId, "completed");
    this.emitExecution({
      type: "execution",
      status: "completed",
      nodeId,
      modelCallsUsed: this.modelCalls,
      modelCallsRemaining: this.remainingModelCalls(),
      toolCallsUsed: this.metadata.toolCalls.length,
    });
  }

  private markExecutionNodeFailed(
    nodeId: string,
    status: "failed" | "cancelled",
    detail?: ExecutionStatusUpdateDetail,
  ): void {
    const node = this.executionNodes.get(nodeId);
    if (!node) {
      return;
    }

    node.status = status;
    node.completedAt = new Date().toISOString();
    this.metadata.executionStatus = status;
    this.updateExecutionGraph();
    this.runStateWrites.push(this.persistNodeStatus(nodeId, status));
    const resolvedDetail: ExecutionStatusUpdateDetail | undefined =
      status === "cancelled"
        ? {
            failureCategory: "cancelled",
            code: EXECUTION_FAILURE_CODES.cancelled,
            message: detail?.message ?? this.execution?.cancelReason?.(),
          }
        : detail;
    this.execution?.updateNodeStatus?.(nodeId, status, resolvedDetail);
  }

  /** Align top-level executionStatus with errors and graph so we never emit completed for a failed run. */
  private syncExecutionStatusWithOutcome(): void {
    if (this.metadata.executionStatus === "cancelled") {
      return;
    }
    if (this.metadata.errors.length > 0) {
      this.metadata.executionStatus = "failed";
      return;
    }
    const graph = this.metadata.executionGraph;
    if (graph?.nodes.some((n) => n.status === "failed")) {
      this.metadata.executionStatus = "failed";
      return;
    }
    this.metadata.executionStatus = "completed";
  }

  private async waitForNodeApproval(task: TaskNode): Promise<TaskNode | "skipped"> {
    const existingNode = this.executionNodes.get(task.id);
    const node: NonNullable<RecursivePromptMetadata["executionGraph"]>["nodes"][number] = {
      id: task.id,
      kind: existingNode?.kind ?? "task",
      label: existingNode?.label ?? preview(task.prompt, 80),
      prompt: existingNode?.prompt ?? task.prompt,
      originalPrompt: existingNode?.originalPrompt ?? task.prompt,
      plannedModel: existingNode?.plannedModel ?? task.modelOverride ?? "resolved-at-runtime",
      modelOverride: existingNode?.modelOverride ?? task.modelOverride,
      modelOverrideSource:
        existingNode?.modelOverrideSource ?? (task.modelOverride ? "user" : "none"),
      samplingOverride: existingNode?.samplingOverride ?? task.samplingOverride,
      expertAgentId: existingNode?.expertAgentId ?? task.expertAgentId,
      expertAssignmentMode: existingNode?.expertAssignmentMode ?? task.expertAssignmentMode,
      expertRuntime: existingNode?.expertRuntime ?? task.expertRuntime,
      expertToolAllowlist: existingNode?.expertToolAllowlist ?? task.expertToolAllowlist,
      expertPurposeTiers: existingNode?.expertPurposeTiers ?? task.expertPurposeTiers,
      editableFields: ["prompt"],
      depth: task.depth,
      status: "awaiting_approval",
      approvalMode: this.execution?.approvalMode,
      approvalSource: "none",
      spawnedAfterInitialApproval:
        this.initialApprovalBoundaryPassed && task.parentId !== undefined,
      autoApprovalPaused: this.execution?.autoApprovalPaused?.() ?? false,
    };
    if (task.parentId) {
      node.parentId = task.parentId;
    }
    const decision = await this.execution?.waitForNodeApproval?.(node);
    this.throwIfCancelled(task);
    if (!decision || decision.status === "approved") {
      this.initialApprovalBoundaryPassed = true;
      const executionNode = this.executionNodes.get(task.id);
      if (executionNode && decision) {
        executionNode.approvalSource = decision.approvalSource ?? executionNode.approvalSource;
        executionNode.approvalReason = decision.approvalReason ?? executionNode.approvalReason;
        this.updateExecutionGraph();
      }
      if (decision?.modelOverride) {
        const overrideNode = this.executionNodes.get(task.id);
        if (overrideNode) {
          overrideNode.modelOverride = decision.modelOverride;
          overrideNode.modelOverrideSource = "user";
          overrideNode.plannedModel = decision.modelOverride;
          this.updateExecutionGraph();
        }
      }
      if (decision?.samplingOverride) {
        const overrideNode = this.executionNodes.get(task.id);
        if (overrideNode) {
          overrideNode.samplingOverride = decision.samplingOverride;
          this.updateExecutionGraph();
        }
      }
      const expertNode = this.executionNodes.get(task.id);
      if (expertNode && decision) {
        expertNode.expertAgentId = decision.expertAgentId ?? expertNode.expertAgentId;
        expertNode.expertAssignmentMode =
          decision.expertAssignmentMode ?? expertNode.expertAssignmentMode;
        expertNode.expertRuntime = decision.expertRuntime ?? expertNode.expertRuntime;
        expertNode.expertToolAllowlist =
          decision.expertToolAllowlist ?? expertNode.expertToolAllowlist;
        expertNode.expertPurposeTiers =
          decision.expertPurposeTiers ?? expertNode.expertPurposeTiers;
        this.updateExecutionGraph();
      }
      return {
        ...task,
        prompt: decision?.prompt ?? task.prompt,
        modelOverride: decision?.modelOverride ?? task.modelOverride,
        samplingOverride: decision?.samplingOverride ?? task.samplingOverride,
        contextPolicy: decision?.contextPolicy ?? task.contextPolicy,
        expertAgentId: decision?.expertAgentId ?? task.expertAgentId,
        expertAssignmentMode: decision?.expertAssignmentMode ?? task.expertAssignmentMode,
        expertRuntime: decision?.expertRuntime ?? task.expertRuntime,
        expertToolAllowlist: decision?.expertToolAllowlist ?? task.expertToolAllowlist,
        expertPurposeTiers: decision?.expertPurposeTiers ?? task.expertPurposeTiers,
      };
    }
    if (decision.status === "skipped") {
      const node = this.executionNodes.get(task.id);
      if (node) {
        node.status = "skipped";
      }
      this.updateExecutionGraph();
      return "skipped";
    }

    this.markExecutionNodeFailed(task.id, "cancelled", {
      failureCategory: "cancelled",
      code: EXECUTION_FAILURE_CODES.cancelled,
      message: this.execution?.cancelReason?.(),
    });
    throw new Error(this.execution?.cancelReason?.() ?? "execution cancelled");
  }

  private expertTierFor(
    task: TaskNode,
    purpose: LanguageModelPurpose | undefined,
  ): string | undefined {
    if (task.modelOverride || !purpose) {
      return undefined;
    }
    const tier = task.expertPurposeTiers?.[purpose]?.trim();
    return tier || undefined;
  }

  private toolsForTask(task: TaskNode): ToolPort[] {
    const allTools = [...this.toolsByName.values()];
    if (!task.expertToolAllowlist || task.expertToolAllowlist.length === 0) {
      return allTools;
    }
    const allowed = new Set(task.expertToolAllowlist.map((tool) => tool.trim()).filter(Boolean));
    return allTools.filter((tool) => allowed.has(tool.name));
  }

  private updateExecutionGraph(): void {
    this.metadata.executionGraph = {
      nodes: [...this.executionNodes.values()],
      edges: [...this.executionEdges],
    };
    this.metadata.budget = {
      estimatedModelCalls: this.estimateModelCalls(undefined),
      estimatedToolRounds: this.estimateToolRounds(undefined),
      modelCallsUsed: this.modelCalls,
      modelCallsRemaining: this.remainingModelCalls(),
      toolCallsUsed: this.metadata.toolCalls.length,
    };
  }

  private updateExecutionNodeModel(
    nodeId: string,
    effectiveModel: string | undefined,
    overrideModel: string | undefined,
    effectiveSampling?: EffectiveSamplingMetadata | undefined,
  ): void {
    const node = this.executionNodes.get(nodeId);
    if (!node) {
      return;
    }
    if (overrideModel) {
      node.modelOverride = overrideModel;
      node.modelOverrideSource = "user";
      node.plannedModel = overrideModel;
    } else if (!node.plannedModel || node.plannedModel === "resolved-at-runtime") {
      node.plannedModel = effectiveModel ?? node.plannedModel;
    }
    if (effectiveModel) {
      node.effectiveModel = effectiveModel;
    }
    if (effectiveSampling) {
      node.effectiveSampling = effectiveSampling;
    }
    this.updateExecutionGraph();
  }

  private emitExecution(event: ExecutionEvent): void {
    this.execution?.onEvent?.(event);
  }

  private async requestClarification(task: TaskNode, promptText: string): Promise<string> {
    if (!this.execution?.requestClarification) {
      return promptText;
    }
    const answer = await this.execution.requestClarification({
      nodeId: task.id,
      promptText,
    });
    this.metadata.clarificationHistory = this.execution.getClarificationHistory?.() ?? [];
    return answer;
  }

  private async initializeRunState(prompt: string): Promise<void> {
    await this.runStatePersistence?.initialize(prompt, this.metadata.agent.id);
  }

  private async persistNodeStatus(nodeId: string, status: string): Promise<void> {
    await this.runStatePersistence?.persistNodeStatus(nodeId, status);
  }

  private async flushRunStateWrites(): Promise<void> {
    if (this.runStateWrites.length === 0) {
      return;
    }
    const writes = this.runStateWrites.splice(0);
    await Promise.all(writes);
  }

  private estimateModelCalls(config: RecursiveModelConfig | undefined): number {
    if (!config) {
      return Math.max(this.modelCalls, 1);
    }

    const depth = config.maxDepth ?? config.maxDynamicDepth;
    const branchFactor = Math.max(1, config.maxBranches);
    const maxNodes =
      depth <= 0
        ? 1
        : Math.floor((Math.pow(branchFactor, depth + 1) - 1) / (branchFactor - 1 || 1));
    return Math.min(config.maxModelCalls, 1 + maxNodes * 4);
  }

  private estimateToolRounds(config: RecursiveModelConfig | undefined): number {
    const maxToolRounds = config?.maxToolRounds ?? this.toolRoundLimit;
    return Math.max(0, maxToolRounds);
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

function defaultMemoryPolicy(): ComposerContextPolicy {
  return {
    reads: ["rolling summary"],
    writes: ["memory updates"],
    limits: ["2000 characters"],
    memoryScopes: ["run-manifest", "project-preferences"],
  };
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

function preview(value: string, maxLength = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}

function parseClarificationRequest(value: string): string | undefined {
  const match = value.trim().match(/^CLARIFY\s*:\s*(.+)$/is);
  return match?.[1]?.trim();
}

function parseFirstInteger(value: string): number | undefined {
  const match = value.match(/\b\d+\b/);
  if (!match?.[0]) {
    return undefined;
  }

  return Number.parseInt(match[0], 10);
}

function isCodeTask(task: TaskNode): boolean {
  if (task.kind === "code") {
    return true;
  }
  const normalized = task.prompt.trim().toLowerCase();
  return normalized.startsWith("code:") || normalized.startsWith("run code:");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function fallbackFromMessages(messages: Parameters<LanguageModelPort["complete"]>[0]): string {
  const userContent = [...messages].reverse().find((message) => message.role === "user")?.content;
  return userContent?.trim() || "No additional model calls are available.";
}

function toModelPurpose(
  kind: Parameters<TracePort["record"]>[0]["kind"],
): LanguageModelPurpose | undefined {
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
