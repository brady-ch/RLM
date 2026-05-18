import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { RecursiveLanguageModel } from "../src/domain/recursive-language-model.js";
import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelResponse,
} from "../src/ports/language-model-port.js";
import type { ExecutionGraphNode, NodeApprovalDecision, QualityLoopMetadata } from "../src/domain/types.js";
import type { ToolExecutionResult, ToolPort } from "../src/ports/tool-port.js";
import { InMemoryTrace } from "../src/adapters/in-memory-trace.js";
import { GuardedShellTool } from "../src/adapters/guarded-shell-tool.js";
import { WorkspaceFileWriteTool } from "../src/adapters/workspace-file-write-tool.js";
import { createAgentRegistry, selectAgent } from "../src/application/agent-registry.js";
import { loadProjectConfig, resolveRuntimeConfig } from "../src/application/project-config.js";
import { MemoryManager } from "../src/application/memory-manager.js";
import { PurposeRoutingLanguageModel, selectDynamicTier } from "../src/application/model-provider.js";
import { buildBugfixQueue, runWorkflow } from "../src/application/workflow-runner.js";
import { createInteractiveExecutionSession } from "../src/application/execution-controller.js";
import { startControlServer } from "../src/application/control-server.js";
import { parseArgs } from "../src/cli/args.js";
import { renderResult } from "../src/cli/render.js";
import type { RuntimeLogEvent, RuntimeLogger } from "../src/ports/runtime-logger-port.js";
import { FileRunStateStore } from "../src/adapters/file-run-state-store.js";

type QueueResponse = string | LanguageModelResponse | Error;

class QueueModel implements LanguageModelPort {
  readonly calls: Array<{ messages: LanguageModelMessage[]; options: LanguageModelCompleteOptions }> = [];

  constructor(private readonly responses: QueueResponse[]) {}

  async complete(
    messages: LanguageModelMessage[],
    options: LanguageModelCompleteOptions = {},
  ): Promise<LanguageModelResponse> {
    this.calls.push({ messages, options });
    const response = this.responses.shift();
    if (response === undefined) {
      throw new Error("No queued response");
    }
    if (response instanceof Error) {
      throw response;
    }

    return typeof response === "string" ? { content: response, toolCalls: [] } : response;
  }
}

class ThrowingModel implements LanguageModelPort {
  constructor(private readonly message: string) {}

  async complete(): Promise<LanguageModelResponse> {
    throw new Error(this.message);
  }
}

class CaptureLogger implements RuntimeLogger {
  readonly events: RuntimeLogEvent[] = [];

  log(event: RuntimeLogEvent): void {
    this.events.push(event);
  }
}

class EchoTool implements ToolPort {
  readonly name = "echo";
  readonly description = "Echo input text.";
  readonly schema = {};

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    return {
      status: "success",
      output: `echo: ${String(args["text"] ?? "")}`,
    };
  }
}

const config = {
  maxDepth: 2,
  maxDynamicDepth: 4,
  maxBranches: 2,
  maxPromptCharacters: 1_000,
  maxModelCalls: 100,
  maxToolRounds: 3,
};

const dynamicDepthConfig = {
  maxDynamicDepth: 4,
  maxBranches: 2,
  maxPromptCharacters: 1_000,
  maxModelCalls: 100,
  maxToolRounds: 3,
};

const structuredCritique = JSON.stringify({
  summary: "critique notes",
  resolved: false,
  issues: [],
  suggestedImprovements: ["clarify the answer"],
});

const continuingGate = JSON.stringify({
  decision: "continue",
  score: 0.6,
  passThreshold: 0.8,
  rubricFit: true,
  critiqueResolved: false,
  meaningfulImprovement: true,
  rationale: "Needs another pass.",
  failedConditions: ["score_below_threshold"],
  unresolvedIssues: [],
});

const passingGate = JSON.stringify({
  decision: "pass",
  score: 0.92,
  passThreshold: 0.8,
  rubricFit: true,
  critiqueResolved: true,
  meaningfulImprovement: true,
  rationale: "Meets the rubric.",
  failedConditions: [],
  unresolvedIssues: [],
});

function bestOfProgress(answer: string, selectedCandidateId?: string): string {
  return JSON.stringify({
    ...(selectedCandidateId ? { selectedCandidateId } : {}),
    answer,
    rationale: "Best candidate by score and issue resolution.",
    score: 0.9,
    comparisonNotes: ["Best available answer."],
  });
}

test("quality loop metadata contract supports graph nodes", () => {
  const loop: QualityLoopMetadata = {
    config: {
      enabled: true,
      maxIterations: 3,
      budgetBehavior: "stop_before_partial_iteration",
    },
    status: "completed",
    stopReason: "budget_exhausted",
    usage: {
      iterationsStarted: 1,
      iterationsCompleted: 1,
      phaseCallCounts: {
        draft: 1,
        critique: 1,
        refine: 0,
        gate: 1,
        best_of_progress: 1,
      },
      modelCallsTotal: 4,
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      unknownCompletions: 0,
    },
    iterations: [],
    candidates: [],
    unresolvedIssues: [],
  };
  const node: ExecutionGraphNode = {
    id: "loop-1",
    kind: "quality-loop",
    label: "Quality loop",
    depth: 0,
    status: "completed",
    loop,
  };

  assert.equal(node.loop?.stopReason, "budget_exhausted");
});

test("parse args enables quality loop explicitly", () => {
  const parsed = parseArgs(["ask", "--quality-loop", "Improve this answer"], {});

  assert.equal(parsed.prompt, "Improve this answer");
  assert.equal(parsed.config.qualityLoop?.enabled, true);
  assert.equal(parsed.config.qualityLoop?.maxIterations, 3);
  assert.deepEqual(parsed.configOverrides.qualityLoop, parsed.config.qualityLoop);
});

test("parse args sets quality loop max iterations", () => {
  const parsed = parseArgs(["ask", "--quality-loop-max-iterations", "5", "Improve this answer"], {});

  assert.equal(parsed.prompt, "Improve this answer");
  assert.equal(parsed.config.qualityLoop?.enabled, true);
  assert.equal(parsed.config.qualityLoop?.maxIterations, 5);
  assert.deepEqual(parsed.configOverrides.qualityLoop, parsed.config.qualityLoop);
});

test("answers directly when max depth is zero", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new QueueModel(["direct answer"]), trace);

  const result = await engine.run({
    prompt: "Explain recursion",
    config: {
      ...config,
      maxDepth: 0,
    },
  });

  assert.equal(result.answer, "direct answer");
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["answer"],
  );
});

test("quality loop graph node stays collapsed with nested phase history", async () => {
  const trace = new InMemoryTrace();
  const events: Array<{ message?: string | undefined }> = [];
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      { content: "draft answer", toolCalls: [], model: "draft-model" },
      { content: structuredCritique, toolCalls: [], model: "critique-model" },
      { content: "refined answer", toolCalls: [], model: "refine-model" },
      { content: continuingGate, toolCalls: [], model: "gate-model" },
      { content: bestOfProgress("best final answer"), toolCalls: [], model: "best-model" },
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Improve this answer",
    config: {
      ...dynamicDepthConfig,
      qualityLoop: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    },
    execution: {
      isCancelled: () => false,
      onEvent: (event) => events.push({ message: event.message }),
    },
  });

  const node = result.metadata.executionGraph?.nodes[0];
  assert.equal(result.answer, "best final answer");
  assert.equal(result.metadata.executionGraph?.nodes.length, 1);
  assert.equal(node?.kind, "quality-loop");
  assert.deepEqual(
    node?.loop?.iterations[0]?.phases.map((phase) => phase.phase),
    ["draft", "critique", "refine", "gate", "best_of_progress"],
  );
  assert.deepEqual(
    node?.loop?.iterations[0]?.phases.map((phase) => phase.model),
    ["draft-model", "critique-model", "refine-model", "gate-model", "best-model"],
  );
  assert.equal(result.metadata.qualityLoop, node?.loop);
  assert.equal(result.trace.some((event) => event.kind === "depth"), false);
  assert.ok(events.some((event) => event.message?.includes("quality loop started")));
  assert.ok(events.some((event) => event.message?.includes("quality loop phase completed")));
  assert.ok(events.some((event) => event.message?.includes("quality loop stopped")));
});

test("quality loop budget stops before partial iteration", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new QueueModel([]), trace);

  const result = await engine.run({
    prompt: "Improve this answer",
    config: {
      ...config,
      maxDepth: 0,
      maxModelCalls: 4,
      qualityLoop: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    },
  });

  assert.equal(result.answer, "");
  assert.equal(result.metadata.qualityLoop?.stopReason, "budget_exhausted");
  assert.equal(result.metadata.qualityLoop?.iterations.length, 0);
  assert.equal(result.metadata.qualityLoop?.usage.modelCallsTotal, 0);
});

test("quality loop metadata includes terminal reason usage and selected candidate", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      { content: "draft answer", toolCalls: [], model: "draft-model" },
      { content: structuredCritique, toolCalls: [], model: "critique-model" },
      { content: "refined answer", toolCalls: [], model: "refine-model" },
      { content: continuingGate, toolCalls: [], model: "gate-model" },
      { content: bestOfProgress("best final answer"), toolCalls: [] },
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Improve this answer",
    config: {
      ...config,
      maxDepth: 0,
      qualityLoop: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    },
  });

  assert.equal(result.metadata.qualityLoop?.stopReason, "max_iterations");
  assert.equal(result.metadata.qualityLoop?.usage.modelCallsTotal, 5);
  assert.equal(result.metadata.qualityLoop?.usage.phaseCallCounts.draft, 1);
  assert.ok(result.metadata.qualityLoop?.selectedCandidateId);
  assert.ok(result.metadata.qualityLoop?.candidates.some((candidate) => candidate.isSelected === true));
  assert.ok(result.metadata.qualityLoop?.iterations[0]?.phases.some((phase) => phase.model === "unknown"));
});

async function runQualityLoopForRubric(prompt: string, gate = continuingGate) {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      { content: "draft answer", toolCalls: [], model: "draft-model" },
      { content: structuredCritique, toolCalls: [], model: "critique-model" },
      { content: "refined answer", toolCalls: [], model: "refine-model" },
      { content: gate, toolCalls: [], model: "gate-model" },
      { content: bestOfProgress("best final answer"), toolCalls: [], model: "best-model" },
    ]),
    trace,
  );

  return engine.run({
    prompt,
    config: {
      ...config,
      maxDepth: 0,
      qualityLoop: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    },
  });
}

test("quality loop selects general answer quality rubric by default", async () => {
  const result = await runQualityLoopForRubric("Explain why the sky changes color at sunset.");

  assert.equal(result.metadata.qualityLoop?.rubric?.id, "general_answer_quality");
  assert.equal(result.metadata.qualityLoop?.rubric?.confidence, 0.4);
  assert.equal(result.metadata.qualityLoop?.rubric?.criteria.length, 3);
});

test("quality loop selects code engineering rubric", async () => {
  const result = await runQualityLoopForRubric("Fix the failing TypeScript test in src/domain/types.ts.");

  assert.equal(result.metadata.qualityLoop?.rubric?.id, "code_engineering");
  assert.ok((result.metadata.qualityLoop?.rubric?.matchedSignals.length ?? 0) > 0);
  assert.equal(result.metadata.qualityLoop?.rubric?.criteria.length, 3);
});

test("quality loop selects planning architecture rubric", async () => {
  const result = await runQualityLoopForRubric("Create an architecture plan with system tradeoffs for the next phase.");

  assert.equal(result.metadata.qualityLoop?.rubric?.id, "planning_architecture");
  assert.ok((result.metadata.qualityLoop?.rubric?.matchedSignals.length ?? 0) > 0);
  assert.equal(result.metadata.qualityLoop?.rubric?.criteria.length, 3);
});

test("quality loop selects user facing writing rubric", async () => {
  const result = await runQualityLoopForRubric("Rewrite this announcement email with a warmer tone.");

  assert.equal(result.metadata.qualityLoop?.rubric?.id, "user_facing_writing");
  assert.ok((result.metadata.qualityLoop?.rubric?.matchedSignals.length ?? 0) > 0);
  assert.equal(result.metadata.qualityLoop?.rubric?.criteria.length, 3);
});

test("quality loop selects structured artifact rubric", async () => {
  const result = await runQualityLoopForRubric("Return a YAML checklist with the required fields.");

  assert.equal(result.metadata.qualityLoop?.rubric?.id, "structured_artifact");
  assert.ok((result.metadata.qualityLoop?.rubric?.matchedSignals.length ?? 0) > 0);
  assert.equal(result.metadata.qualityLoop?.rubric?.criteria.length, 3);
});

test("quality loop mirrors selected rubric onto graph node metadata", async () => {
  const result = await runQualityLoopForRubric("Fix the bug in src/domain/recursive-language-model.ts.");
  const node = result.metadata.executionGraph?.nodes[0];

  assert.deepEqual(node?.loop?.rubric, result.metadata.qualityLoop?.rubric);
});

test("quality loop degraded returns best available candidate with unresolved issues", async () => {
  const trace = new InMemoryTrace();
  const fullCandidateText = "best final answer ".repeat(20).trim();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      { content: "draft answer", toolCalls: [], model: "draft-model" },
      { content: structuredCritique, toolCalls: [], model: "critique-model" },
      { content: "refined answer", toolCalls: [], model: "refine-model" },
      { content: continuingGate, toolCalls: [], model: "gate-model" },
      { content: fullCandidateText, toolCalls: [], model: "best-model" },
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Improve this answer",
    config: {
      ...config,
      maxDepth: 0,
      qualityLoop: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    },
  });

  const loop = result.metadata.qualityLoop;
  assert.equal(loop?.status, "degraded");
  assert.equal(loop?.stopReason, "degraded");
  assert.ok((loop?.usage.modelCallsTotal ?? 0) > 0);
  assert.ok((loop?.unresolvedIssues.length ?? 0) > 0);
  const selected = loop?.candidates.find((candidate) => candidate.id === loop.selectedCandidateId);
  assert.ok(selected);
  assert.equal(result.answer, fullCandidateText);
  assert.notEqual(selected.summary, result.answer);
  assert.ok(selected.summary.length <= 160);
});

test("quality loop parses structured evaluator outputs", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      { content: "draft answer", toolCalls: [], model: "draft-model" },
      { content: structuredCritique, toolCalls: [], model: "critique-model" },
      { content: "refined answer", toolCalls: [], model: "refine-model" },
      { content: passingGate, toolCalls: [], model: "gate-model" },
      { content: bestOfProgress("best final answer"), toolCalls: [], model: "best-model" },
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Improve this TypeScript answer",
    config: {
      ...config,
      maxDepth: 0,
      qualityLoop: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    },
  });

  const iteration = result.metadata.qualityLoop?.iterations[0];
  assert.equal(iteration?.critiqueEvaluation?.summary, "critique notes");
  assert.equal(iteration?.gateEvaluation?.decision, "pass");
  assert.equal(iteration?.bestOfProgressEvaluation?.rationale, "Best candidate by score and issue resolution.");
  assert.equal(iteration?.phases.find((phase) => phase.phase === "critique")?.parseStatus, "parsed");
  assert.equal(iteration?.phases.find((phase) => phase.phase === "gate")?.parseStatus, "parsed");
  assert.equal(iteration?.phases.find((phase) => phase.phase === "best_of_progress")?.parseStatus, "parsed");
  assert.equal(result.metadata.qualityLoop?.gate?.decision, "pass");
  assert.equal(result.answer, "best final answer");
});

test("quality loop degraded on malformed evaluator output with candidate", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      { content: "draft answer", toolCalls: [], model: "draft-model" },
      { content: structuredCritique, toolCalls: [], model: "critique-model" },
      { content: "refined answer", toolCalls: [], model: "refine-model" },
      { content: continuingGate, toolCalls: [], model: "gate-model" },
      { content: "not json but still a candidate", toolCalls: [], model: "best-model" },
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Improve this answer",
    config: {
      ...config,
      maxDepth: 0,
      qualityLoop: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    },
  });

  const failedPhase = result.metadata.qualityLoop?.iterations[0]?.phases.find((phase) => phase.phase === "best_of_progress");
  assert.equal(result.metadata.qualityLoop?.status, "degraded");
  assert.equal(result.metadata.qualityLoop?.stopReason, "degraded");
  assert.equal(failedPhase?.parseStatus, "degraded");
  assert.ok((result.metadata.qualityLoop?.unresolvedIssues.length ?? 0) > 0);
  assert.equal(result.answer, "not json but still a candidate");
});

test("quality loop fails on malformed evaluator output before candidate", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      { content: "draft answer", toolCalls: [], model: "draft-model" },
      { content: "not json", toolCalls: [], model: "critique-model" },
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Improve this answer",
    config: {
      ...config,
      maxDepth: 0,
      qualityLoop: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    },
  });

  const failedPhase = result.metadata.qualityLoop?.iterations[0]?.phases.find((phase) => phase.phase === "critique");
  assert.equal(result.metadata.executionStatus, "failed");
  assert.equal(result.metadata.qualityLoop?.status, "failed");
  assert.equal(result.metadata.qualityLoop?.stopReason, "failed");
  assert.equal(result.metadata.qualityLoop?.usage.iterationsCompleted, 0);
  assert.equal(failedPhase?.parseStatus, "failed");
  assert.ok((failedPhase?.unresolvedIssues?.length ?? 0) > 0);
});

test("quality loop gate stops with passed", async () => {
  const result = await runQualityLoopForRubric("Improve this answer", passingGate);

  assert.equal(result.metadata.qualityLoop?.stopReason, "passed");
  assert.equal(result.metadata.qualityLoop?.gate?.decision, "pass");
});

test("quality loop gate stops with critique resolved", async () => {
  const trace = new InMemoryTrace();
  const critiqueResolvedGate = JSON.stringify({
    decision: "continue",
    score: 0.85,
    passThreshold: 0.8,
    rubricFit: true,
    critiqueResolved: true,
    meaningfulImprovement: false,
    rationale: "Critique is resolved even though the gate did not mark pass.",
    failedConditions: ["decision_continue"],
    unresolvedIssues: [],
  });
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      { content: "draft answer", toolCalls: [], model: "draft-model" },
      { content: structuredCritique, toolCalls: [], model: "critique-model" },
      { content: "refined answer", toolCalls: [], model: "refine-model" },
      { content: critiqueResolvedGate, toolCalls: [], model: "gate-model" },
      { content: bestOfProgress("best final answer"), toolCalls: [], model: "best-model" },
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Improve this answer",
    config: {
      ...config,
      maxDepth: 0,
      qualityLoop: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    },
  });

  assert.equal(result.metadata.qualityLoop?.stopReason, "critique_resolved");
  assert.equal(result.metadata.qualityLoop?.gate?.critiqueResolved, true);
});

test("quality loop gate stops with no meaningful improvement", async () => {
  const trace = new InMemoryTrace();
  const unchangedGate = JSON.stringify({
    decision: "continue",
    score: 0.6,
    passThreshold: 0.8,
    rubricFit: true,
    critiqueResolved: false,
    meaningfulImprovement: true,
    rationale: "Still below threshold.",
    failedConditions: ["score_below_threshold"],
    unresolvedIssues: [{ severity: "warning", text: "Still too vague." }],
  });
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      { content: "draft answer", toolCalls: [], model: "draft-model" },
      { content: structuredCritique, toolCalls: [], model: "critique-model" },
      { content: "refined answer", toolCalls: [], model: "refine-model" },
      { content: unchangedGate, toolCalls: [], model: "gate-model" },
      { content: bestOfProgress("best final answer"), toolCalls: [], model: "best-model" },
      { content: "draft answer again", toolCalls: [], model: "draft-model" },
      { content: structuredCritique, toolCalls: [], model: "critique-model" },
      { content: "refined answer again", toolCalls: [], model: "refine-model" },
      { content: unchangedGate, toolCalls: [], model: "gate-model" },
      { content: bestOfProgress("best final answer again"), toolCalls: [], model: "best-model" },
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Improve this answer",
    config: {
      ...config,
      maxDepth: 0,
      qualityLoop: { enabled: true, maxIterations: 2, budgetBehavior: "stop_before_partial_iteration" },
    },
  });

  assert.equal(result.metadata.qualityLoop?.stopReason, "no_meaningful_improvement");
  assert.equal(result.metadata.qualityLoop?.iterations.length, 2);
});

test("quality loop failure records terminal failed metadata", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      { content: "draft answer", toolCalls: [], model: "draft-model" },
      { content: structuredCritique, toolCalls: [], model: "critique-model" },
      new Error("loop phase failed"),
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Improve this answer",
    config: {
      ...config,
      maxDepth: 0,
      qualityLoop: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    },
  });

  assert.equal(result.metadata.executionStatus, "failed");
  assert.ok(result.metadata.errors.length > 0);
  assert.equal(result.metadata.qualityLoop?.status, "failed");
  assert.equal(result.metadata.qualityLoop?.stopReason, "failed");
  assert.equal(result.metadata.qualityLoop?.usage.modelCallsTotal, 3);
  const failedPhase = result.metadata.qualityLoop?.iterations[0]?.phases.find((phase) => phase.phase === "refine");
  assert.equal(failedPhase?.status, "failed");
  assert.equal(failedPhase?.model, "unknown");
  assert.ok((failedPhase?.unresolvedIssues?.length ?? 0) > 0);
});

test("quality loop waits for node approval before model calls", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel([
    { content: "draft answer", toolCalls: [], model: "draft-model" },
    { content: structuredCritique, toolCalls: [], model: "critique-model" },
    { content: "refined answer", toolCalls: [], model: "refine-model" },
    { content: passingGate, toolCalls: [], model: "gate-model" },
    { content: bestOfProgress("best final answer"), toolCalls: [], model: "best-model" },
  ]);
  const engine = new RecursiveLanguageModel(model, trace);
  let pendingNode: ExecutionGraphNode | undefined;
  let approve!: (prompt: string) => void;
  const approval = new Promise<NodeApprovalDecision>((resolve) => {
    approve = (prompt: string) => resolve({ status: "approved", prompt, approvalSource: "manual", approvalReason: "test approval" });
  });

  const run = engine.run({
    prompt: "Improve this answer",
    config: {
      ...dynamicDepthConfig,
      qualityLoop: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    },
    execution: {
      approvalMode: "full",
      isCancelled: () => false,
      waitForNodeApproval: (node) => {
        pendingNode = node;
        return approval;
      },
    },
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pendingNode?.kind, "quality-loop");
  assert.equal(pendingNode?.status, "awaiting_approval");
  assert.equal(model.calls.length, 0);

  approve("Approved loop prompt");
  const result = await run;

  assert.equal(result.answer, "best final answer");
  assert.equal(model.calls.length, 5);
  assert.match(model.calls[0]?.messages.at(-1)?.content ?? "", /Approved loop prompt/);
});

test("quality loop disabled preserves non loop direct execution", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new QueueModel(["direct answer"]), trace);

  const result = await engine.run({
    prompt: "Explain recursion",
    config: {
      ...config,
      maxDepth: 0,
    },
  });

  assert.equal(result.answer, "direct answer");
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["answer"],
  );
});

test("renders compact quality loop metadata", () => {
  const loop: QualityLoopMetadata = {
    config: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    status: "completed",
    stopReason: "max_iterations",
    usage: {
      iterationsStarted: 1,
      iterationsCompleted: 1,
      phaseCallCounts: {
        draft: 1,
        critique: 1,
        refine: 1,
        gate: 1,
        best_of_progress: 1,
      },
      modelCallsTotal: 5,
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      unknownCompletions: 0,
    },
    iterations: [{
      index: 0,
      status: "completed",
      startedAt: "2026-05-17T00:00:00.000Z",
      completedAt: "2026-05-17T00:00:01.000Z",
      phases: [],
      candidates: [],
      unresolvedIssues: [],
    }],
    candidates: [{
      id: "candidate-1",
      iteration: 0,
      phase: "best_of_progress",
      summary: "answer",
      isSelected: true,
    }],
    selectedCandidateId: "candidate-1",
    unresolvedIssues: [],
  };

  const rendered = renderResult({
    answer: "ok",
    trace: [],
    metadata: {
      agent: { id: "default", source: "auto" },
      depth: { selected: 0, source: "override" },
      modelSelections: [],
      memoryReservations: [],
      modelCalls: 5,
      tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, unknownCompletions: 0 },
      toolCalls: [],
      qualityLoop: loop,
      errors: [],
    },
  }, { compact: true, json: false, includeTrace: false, model: "m" });

  assert.match(rendered, /qualityLoop: status=completed stopReason=max_iterations iterations=1 selectedCandidate=candidate-1/);
  assert.match(rendered, /qualityLoopUsage: modelCalls=5 input=10 output=20 total=30 unknown=0/);
});

test("renders json quality loop metadata", () => {
  const loop: QualityLoopMetadata = {
    config: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    status: "completed",
    stopReason: "max_iterations",
    usage: {
      iterationsStarted: 1,
      iterationsCompleted: 1,
      phaseCallCounts: {
        draft: 1,
        critique: 1,
        refine: 1,
        gate: 1,
        best_of_progress: 1,
      },
      modelCallsTotal: 5,
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      unknownCompletions: 0,
    },
    iterations: [{
      index: 0,
      status: "completed",
      startedAt: "2026-05-17T00:00:00.000Z",
      completedAt: "2026-05-17T00:00:01.000Z",
      phases: [],
      candidates: [],
      unresolvedIssues: [],
    }],
    candidates: [{
      id: "candidate-1",
      iteration: 0,
      phase: "best_of_progress",
      summary: "answer",
      isSelected: true,
    }],
    selectedCandidateId: "candidate-1",
    unresolvedIssues: [],
  };

  const rendered = renderResult({
    answer: "ok",
    trace: [],
    metadata: {
      agent: { id: "default", source: "auto" },
      depth: { selected: 0, source: "override" },
      modelSelections: [],
      memoryReservations: [],
      modelCalls: 5,
      tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, unknownCompletions: 0 },
      toolCalls: [],
      qualityLoop: loop,
      errors: [],
    },
  }, { compact: false, json: true, includeTrace: false, model: "m" });
  const parsed = JSON.parse(rendered) as { qualityLoop: QualityLoopMetadata };

  assert.equal(parsed.qualityLoop.stopReason, "max_iterations");
});

function renderableStructuredLoop(): QualityLoopMetadata {
  return {
    config: { enabled: true, maxIterations: 1, budgetBehavior: "stop_before_partial_iteration" },
    status: "completed",
    stopReason: "passed",
    rubric: {
      id: "code_engineering",
      label: "Code and Engineering",
      rationale: "Selected from code signals.",
      matchedSignals: ["typescript", "test"],
      confidence: 0.65,
      criteria: [
        { id: "behavior", label: "Behavior", description: "Implements requested behavior." },
        { id: "integration", label: "Integration", description: "Fits existing code." },
        { id: "verification", label: "Verification", description: "Includes tests." },
      ],
    },
    gate: {
      decision: "pass",
      score: 0.91,
      passThreshold: 0.8,
      rubricFit: true,
      critiqueResolved: true,
      meaningfulImprovement: true,
      rationale: "Meets rubric.",
      failedConditions: [],
      unresolvedIssues: [],
    },
    usage: {
      iterationsStarted: 1,
      iterationsCompleted: 1,
      phaseCallCounts: {
        draft: 1,
        critique: 1,
        refine: 1,
        gate: 1,
        best_of_progress: 1,
      },
      modelCallsTotal: 5,
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      unknownCompletions: 0,
    },
    iterations: [{
      index: 0,
      status: "completed",
      startedAt: "2026-05-18T00:00:00.000Z",
      completedAt: "2026-05-18T00:00:01.000Z",
      phases: [],
      candidates: [],
      unresolvedIssues: [],
      critiqueEvaluation: {
        summary: "critique",
        issues: [],
        resolved: true,
        suggestedImprovements: [],
      },
      gateEvaluation: {
        decision: "pass",
        score: 0.91,
        passThreshold: 0.8,
        rubricFit: true,
        critiqueResolved: true,
        meaningfulImprovement: true,
        rationale: "Meets rubric.",
        failedConditions: [],
        unresolvedIssues: [],
      },
      bestOfProgressEvaluation: {
        selectedCandidateId: "candidate-1",
        rationale: "Best candidate.",
        score: 0.91,
        comparisonNotes: ["Strongest candidate."],
      },
    }],
    candidates: [{
      id: "candidate-1",
      iteration: 0,
      phase: "best_of_progress",
      summary: "answer",
      isSelected: true,
    }],
    selectedCandidateId: "candidate-1",
    unresolvedIssues: [],
  };
}

test("renders compact quality loop rubric and gate metadata", () => {
  const rendered = renderResult({
    answer: "ok",
    trace: [],
    metadata: {
      agent: { id: "default", source: "auto" },
      depth: { selected: 0, source: "override" },
      modelSelections: [],
      memoryReservations: [],
      modelCalls: 5,
      tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, unknownCompletions: 0 },
      toolCalls: [],
      qualityLoop: renderableStructuredLoop(),
      errors: [],
    },
  }, { compact: true, json: false, includeTrace: false, model: "m" });

  assert.match(rendered, /qualityLoopRubric: id=code_engineering confidence=0\.65 signals=2/);
  assert.match(rendered, /qualityLoopGate: decision=pass score=0\.91 threshold=0\.8 failedConditions=0/);
});

test("renders json quality loop rubric and evaluator metadata", () => {
  const rendered = renderResult({
    answer: "ok",
    trace: [],
    metadata: {
      agent: { id: "default", source: "auto" },
      depth: { selected: 0, source: "override" },
      modelSelections: [],
      memoryReservations: [],
      modelCalls: 5,
      tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, unknownCompletions: 0 },
      toolCalls: [],
      qualityLoop: renderableStructuredLoop(),
      errors: [],
    },
  }, { compact: false, json: true, includeTrace: false, model: "m" });
  const parsed = JSON.parse(rendered) as { qualityLoop: QualityLoopMetadata };

  assert.equal(parsed.qualityLoop.rubric?.id, "code_engineering");
  assert.equal(parsed.qualityLoop.gate?.decision, "pass");
  assert.equal(parsed.qualityLoop.iterations[0]?.gateEvaluation?.decision, "pass");
});

test("emits code_execution trace/event for code-only tasks", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new QueueModel(["DIRECT", "done"]), trace);
  const events: Array<{ subtype?: string | undefined; status: string }> = [];

  const result = await engine.run({
    prompt: "code: print('hello')",
    config: {
      ...config,
      maxDepth: 1,
    },
    execution: {
      isCancelled: () => false,
      onEvent: (event) => events.push({ subtype: event.subtype, status: event.status }),
    },
  });

  assert.equal(result.answer, "done");
  assert.ok(result.trace.some((event) => event.kind === "code_execution"));
  assert.ok(events.some((event) => event.subtype === "code_execution" && event.status === "running"));
});

test("decomposes, solves children, summarizes, and synthesizes", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      "RECURSIVE: needs parts",
      "Define recursion\nGive an example",
      "DIRECT: definition is simple",
      "Recursion is self-reference with a base case.",
      "Definition summary",
      "DIRECT: example is simple",
      "A function walking a tree can recurse into child nodes.",
      "Example summary",
      "Final synthesized answer",
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Explain recursion with an example",
    config,
  });

  assert.equal(result.answer, "Final synthesized answer");
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["classify", "decompose", "classify", "answer", "summarize", "classify", "answer", "summarize", "synthesize"],
  );
});

test("treats direct classifications with recursive in the reason as direct", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel(["DIRECT: no recursive decomposition needed", "direct answer"]),
    trace,
  );

  const result = await engine.run({
    prompt: "Answer this plainly",
    config,
  });

  assert.equal(result.answer, "direct answer");
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["classify", "answer"],
  );
});

test("supports nested recursive passes until max depth", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      "RECURSIVE: split the broad task",
      "Research options\nWrite recommendation",
      "RECURSIVE: options need subparts",
      "Option A\nOption B",
      "Grandchild A answer",
      "Grandchild A summary",
      "Grandchild B answer",
      "Grandchild B summary",
      "Options synthesized",
      "Options summary",
      "DIRECT: recommendation is simple",
      "Recommendation answer",
      "Recommendation summary",
      "Final synthesized answer",
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Compare options and recommend one",
    config,
  });

  assert.equal(result.answer, "Final synthesized answer");
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    [
      "classify",
      "decompose",
      "classify",
      "decompose",
      "answer",
      "summarize",
      "answer",
      "summarize",
      "synthesize",
      "summarize",
      "classify",
      "answer",
      "summarize",
      "synthesize",
    ],
  );
  assert.equal(result.trace.filter((event) => event.depth === 2 && event.kind === "answer").length, 2);
});

test("limits branches from decomposition output", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      "RECURSIVE",
      "One\nTwo\nThree",
      "DIRECT",
      "one answer",
      "one summary",
      "DIRECT",
      "two answer",
      "two summary",
      "combined",
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Split this",
    config,
  });

  assert.equal(result.answer, "combined");
  assert.equal(result.trace.filter((event) => event.kind === "answer").length, 2);
});

test("parses cli options with granite default", () => {
  const options = parseArgs(["ask", "hello", "--depth", "3", "--branches", "4", "--compact"], {});

  assert.equal(options.prompt, "hello");
  assert.equal(options.model, "granite4.1:3b");
  assert.equal(options.modelOverride, undefined);
  assert.equal(options.config.maxDepth, 3);
  assert.equal(options.config.maxBranches, 4);
  assert.deepEqual(options.configOverrides, {
    maxDepth: 3,
    maxBranches: 4,
  });
  assert.equal(options.config.maxModelCalls, 24);
  assert.equal(options.compact, true);
  assert.equal(options.verbose, false);
});

test("parses verbose cli option and env default", () => {
  assert.equal(parseArgs(["ask", "hello", "--verbose"], {}).verbose, true);
  assert.equal(parseArgs(["ask", "hello"], { RLM_VERBOSE: "1" }).verbose, true);
  assert.equal(parseArgs(["ask", "hello"], { RLM_MODEL: "yaml-override-model" }).modelOverride, "yaml-override-model");
});

test("parses direct prompt command shape and json output flag", () => {
  const options = parseArgs(["hello", "world", "--json", "--agent", "research", "--workflow", "default", "--config", "custom.yaml"], {});

  assert.equal(options.prompt, "hello world");
  assert.equal(options.command, "ask");
  assert.equal(options.json, true);
  assert.equal(options.agent, "research");
  assert.equal(options.workflow, "default");
  assert.equal(options.configPath, "custom.yaml");
  assert.equal(options.config.maxDepth, undefined);
  assert.equal(options.config.maxDynamicDepth, 4);
});

test("parses ui command and ui port", () => {
  const options = parseArgs(["ui", "review", "the", "plan", "--ui-port", "4545"], {});

  assert.equal(options.command, "ui");
  assert.equal(options.prompt, "review the plan");
  assert.equal(options.uiPort, 4545);
});

test("interactive session seeds a typed root composer for first-run UI", () => {
  const session = createInteractiveExecutionSession({
    seedRootPrompt: "Create an audiobook workflow for an entire book",
  });

  const root = session.snapshot().graph.nodes.find((node) => node.id === "root-composer");
  assert.ok(root);
  assert.equal(root.status, "planned");
  assert.equal(root.composer?.type, "TTS");
  assert.equal(root.composer?.planBudget.remainingNodes, 11);
  assert.ok(root.composer?.contextPolicy.limits.length);
});

test("node-local plan creates pending typed child graph without execution", () => {
  const session = createInteractiveExecutionSession({
    seedRootPrompt: "Create a full book audiobook workflow with speaker interpretation and TTS audio artifacts",
  });

  const result = session.planNode("root-composer");
  const snapshot = session.snapshot();
  const children = snapshot.graph.nodes.filter((node) => node.parentId === "root-composer");

  assert.equal(result.exhausted, false);
  assert.ok(children.length >= 5);
  assert.ok(children.every((node) => node.status === "planned"));
  assert.ok(children.some((node) => node.composer?.type === "TTS"));
  assert.ok(children.some((node) => node.composer?.type === "Code"));
  assert.ok(children.some((node) => node.composer?.complexity === "high"));
  assert.equal(snapshot.chat.readiness.state, "draft");
  assert.match(snapshot.chat.readiness.reason, /Pending planned child graph/);
});

test("plan budget exhaustion pauses expansion until explicit extension", () => {
  const session = createInteractiveExecutionSession({ seedRootPrompt: "simple task" });
  const root = session.snapshot().graph.nodes.find((node) => node.id === "root-composer");
  assert.ok(root?.composer);
  root.composer.planBudget = {
    ...root.composer.planBudget,
    maxDepth: 0,
    maxNodes: 1,
    remainingDepth: 0,
    remainingNodes: 0,
  };

  const result = session.planNode("root-composer");
  assert.equal(result.exhausted, true);
  let updated = session.snapshot().graph.nodes.find((node) => node.id === "root-composer");
  assert.equal(updated?.status, "awaiting_approval");
  assert.equal(updated?.composer?.planBudget.exhausted, true);

  session.extendPlanBudget("root-composer");
  updated = session.snapshot().graph.nodes.find((node) => node.id === "root-composer");
  assert.equal(updated?.composer?.planBudget.exhausted, false);
  assert.ok((updated?.composer?.planBudget.remainingNodes ?? 0) > 0);
});

test("recursive planning shares root budget across high-complexity branches", () => {
  const session = createInteractiveExecutionSession({
    seedRootPrompt: "Create a full book audiobook workflow with speaker interpretation and TTS audio artifacts",
  });

  session.planNode("root-composer");
  const highComplexityChildren = session.snapshot().graph.nodes
    .filter((node) => node.parentId === "root-composer" && node.composer?.complexity === "high")
    .map((node) => node.id);
  assert.ok(highComplexityChildren.length >= 2);

  for (const nodeId of highComplexityChildren) {
    session.planNode(nodeId);
  }

  let snapshot = session.snapshot();
  assert.ok(snapshot.graph.nodes.length <= 12);
  const root = snapshot.graph.nodes.find((node) => node.id === "root-composer");
  assert.equal(root?.composer?.planBudget.remainingNodes, 0);
  assert.equal(root?.composer?.planBudget.exhausted, true);

  const exhausted = session.planNode(highComplexityChildren[0]!);
  assert.equal(exhausted.exhausted, true);
  snapshot = session.snapshot();
  assert.ok(snapshot.graph.nodes.length <= 12);
});

test("interactive connect rejects cycles and replaces old incoming edge on reparent", () => {
  const session = createInteractiveExecutionSession();
  session.control.registerNode?.({ id: "task-1", kind: "task", label: "root", prompt: "root", depth: 0, status: "ready" });
  session.control.registerNode?.({ id: "task-2", parentId: "task-1", kind: "task", label: "child", prompt: "child", depth: 1, status: "ready" });
  session.control.registerNode?.({ id: "task-3", parentId: "task-2", kind: "task", label: "grandchild", prompt: "grandchild", depth: 2, status: "ready" });
  session.control.registerNode?.({ id: "task-4", kind: "task", label: "new root", prompt: "new root", depth: 0, status: "ready" });

  assert.throws(() => session.connectNode({ nodeId: "task-1", parentId: "task-1" }), /itself or one of its descendants/);
  assert.throws(() => session.connectNode({ nodeId: "task-1", parentId: "task-3" }), /itself or one of its descendants/);

  session.connectNode({ nodeId: "task-2", parentId: "task-4" });
  const snapshot = session.snapshot();
  assert.equal(snapshot.graph.nodes.find((node) => node.id === "task-2")?.parentId, "task-4");
  assert.equal(snapshot.graph.nodes.find((node) => node.id === "task-2")?.depth, 1);
  assert.equal(snapshot.graph.nodes.find((node) => node.id === "task-3")?.depth, 2);
  assert.equal(snapshot.graph.edges.filter((edge) => edge.to === "task-2").length, 1);
  assert.ok(snapshot.graph.edges.some((edge) => edge.from === "task-4" && edge.to === "task-2"));
});

test("session graph persists layout, viewport, and typed edge handles", () => {
  const session = createInteractiveExecutionSession({ seedRootPrompt: "workflow" });
  const root = session.snapshot().graph.nodes.find((node) => node.id === "root-composer");
  assert.ok(root?.position);

  session.updateGraphLayout({ "root-composer": { x: 10, y: 20 } });
  assert.deepEqual(session.snapshot().graph.nodes.find((node) => node.id === "root-composer")?.position, { x: 10, y: 20 });

  session.setGraphViewport({ x: 1, y: 2, zoom: 0.75 });
  assert.deepEqual(session.snapshot().graph.viewport, { x: 1, y: 2, zoom: 0.75 });

  const child = session.addNode({ parentId: "root-composer", prompt: "child node" });
  session.connectNode({
    nodeId: child.id,
    parentId: "root-composer",
    sourceHandle: "src-port",
    targetHandle: "tgt-port",
  });
  const edge = session.snapshot().graph.edges.find((e) => e.from === "root-composer" && e.to === child.id);
  assert.equal(edge?.sourceHandle, "src-port");
  assert.equal(edge?.targetHandle, "tgt-port");
});

test("control server exposes plan and budget endpoints with explicit exhaustion gate", async () => {
  const session = createInteractiveExecutionSession({
    seedRootPrompt: "Create a full book audiobook workflow with TTS audio artifacts",
  });
  const server = await startControlServer({ session });
  try {
    const planResponse = await fetch(`${server.url}/api/nodes/root-composer/plan`, { method: "POST" });
    assert.equal(planResponse.status, 200);
    const planned = await planResponse.json() as { plan: { plannedNodeIds: string[]; exhausted: boolean } };
    assert.equal(planned.plan.exhausted, false);
    assert.ok(planned.plan.plannedNodeIds.length > 0);

    const earlyExtend = await fetch(`${server.url}/api/nodes/root-composer/extend-budget`, { method: "POST" });
    assert.equal(earlyExtend.status, 409);
  } finally {
    await server.close();
  }
});

test("interactive execution waits for node approval and uses edited prompt", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel(["edited answer"]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession();

  const run = engine.run({
    prompt: "original prompt",
    config: {
      ...config,
      maxDepth: 0,
    },
    execution: session.control,
  });

  await session.waitForNodeStatus("task-1", "awaiting_approval");
  assert.equal(model.calls.length, 0);

  session.editNodePrompt("task-1", "edited prompt");
  session.approveNode("task-1");

  const result = await run;
  assert.equal(result.answer, "edited answer");
  assert.equal(model.calls[0]?.messages.at(-1)?.content, "edited prompt");
  assert.equal(session.snapshot().graph.nodes.find((node) => node.id === "task-1")?.status, "completed");
});

test("interactive execution rejects stale approval tokens", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel(["approved answer"]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession();

  const run = engine.run({
    prompt: "token test",
    config: {
      ...config,
      maxDepth: 0,
    },
    execution: session.control,
  });

  await session.waitForNodeStatus("task-1", "awaiting_approval");
  const token = session.snapshot().graph.nodes.find((node) => node.id === "task-1")?.approvalToken;
  assert.ok(token);

  assert.throws(() => session.approveNode("task-1", "task-1:0"), /Stale approval token/);
  session.approveNode("task-1", token);

  const result = await run;
  assert.equal(result.answer, "approved answer");
});

test("interactive execution treats duplicate approval token as no-op", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel(["approved answer"]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession();

  const run = engine.run({
    prompt: "duplicate test",
    config: {
      ...config,
      maxDepth: 0,
    },
    execution: session.control,
  });

  await session.waitForNodeStatus("task-1", "awaiting_approval");
  const token = session.snapshot().graph.nodes.find((node) => node.id === "task-1")?.approvalToken;
  assert.ok(token);

  const first = session.approveNode("task-1", token);
  const duplicate = session.approveNode("task-1", token);

  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);

  const result = await run;
  assert.equal(result.answer, "approved answer");
});

test("interactive execution session supports add/connect/delete mutations at checkpoint", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel(["approved answer"]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession();

  const run = engine.run({
    prompt: "mutation test",
    config: {
      ...config,
      maxDepth: 0,
    },
    execution: session.control,
  });

  await session.waitForNodeStatus("task-1", "awaiting_approval");
  const child = session.addNode({ parentId: "task-1", prompt: "child prompt" });
  session.connectNode({ nodeId: child.id, parentId: "task-1" });
  const deleted = session.deleteNode(child.id);
  assert.ok(deleted.deleted.includes(child.id));

  const token = session.snapshot().graph.nodes.find((node) => node.id === "task-1")?.approvalToken;
  assert.ok(token);
  session.approveNode("task-1", token);
  const result = await run;
  assert.equal(result.answer, "approved answer");
});

test("interactive delete with dependents requires explicit strategy choice", () => {
  const session = createInteractiveExecutionSession();
  // Seed nodes directly via control registration to model a dependency chain.
  session.control.registerNode?.({ id: "task-1", kind: "task", label: "root", prompt: "root", depth: 0, status: "ready" });
  session.control.registerNode?.({ id: "task-2", parentId: "task-1", kind: "task", label: "child", prompt: "child", depth: 1, status: "ready" });
  session.control.registerNode?.({ id: "task-3", parentId: "task-2", kind: "task", label: "grandchild", prompt: "grandchild", depth: 2, status: "ready" });
  assert.throws(() => session.deleteNode("task-2"), /explicit choice/);
});

test("clarification checkpoints are hard-blocking and skip is rejected", () => {
  const session = createInteractiveExecutionSession();
  session.control.registerNode?.({ id: "task-1", kind: "task", label: "root", prompt: "root", depth: 0, status: "ready" });
  const question = session.raiseClarificationCheckpoint({
    nodeId: "task-1",
    promptText: "Need environment details?",
  });
  assert.equal(session.snapshot().chat.pendingClarification?.questionId, question.questionId);
  assert.throws(
    () => session.skipNode("task-1"),
    /answer and continue or abort/,
  );
});

test("clarification answer emits canonical record fields and clears pending state", () => {
  const session = createInteractiveExecutionSession();
  const events: Array<{ record?: Record<string, string> }> = [];
  session.subscribe((event) => {
    if (event.clarificationRecord) {
      events.push({ record: event.clarificationRecord as unknown as Record<string, string> });
    }
  });
  session.control.registerNode?.({ id: "task-1", kind: "task", label: "root", prompt: "root", depth: 0, status: "ready" });
  const question = session.raiseClarificationCheckpoint({
    nodeId: "task-1",
    promptText: "Need environment details?",
  });
  const record = session.answerClarificationAndContinue({
    questionId: question.questionId,
    userAnswer: "Use staging credentials.",
  });
  assert.equal(record.question_id, question.questionId);
  assert.equal(record.node_id, "task-1");
  assert.equal(record.prompt_text, "Need environment details?");
  assert.equal(record.user_answer, "Use staging credentials.");
  assert.ok(record.asked_at.length > 0);
  assert.ok(record.answered_at.length > 0);
  assert.ok(record.resume_event_id.length > 0);
  assert.equal(session.snapshot().chat.pendingClarification, undefined);
  assert.equal(session.snapshot().chat.clarificationHistory.length, 1);
  assert.equal(events.length, 1);
});

test("clarification abort persists pending question snapshot", () => {
  const session = createInteractiveExecutionSession();
  session.control.registerNode?.({ id: "task-1", kind: "task", label: "root", prompt: "root", depth: 0, status: "ready" });
  const question = session.raiseClarificationCheckpoint({
    nodeId: "task-1",
    promptText: "Need environment details?",
  });
  session.abortRunFromClarification({ questionId: question.questionId });
  const snapshot = session.snapshot();
  assert.equal(snapshot.status, "cancelled");
  assert.equal(snapshot.chat.abortSnapshot?.pendingQuestion.questionId, question.questionId);
  assert.equal(snapshot.chat.abortSnapshot?.pendingQuestion.promptText, "Need environment details?");
});

test("runtime model clarification request blocks until answered and records history", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel([
    "CLARIFY: Which deployment environment should I target?",
    "Use staging.",
  ]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession();
  const run = engine.run({
    prompt: "Deploy the service",
    config: { ...config, maxDepth: 0 },
    execution: session.control,
  });

  await session.waitForNodeStatus("task-1", "awaiting_approval");
  session.approveNode("task-1");
  await session.waitForNodeStatus("task-1", "awaiting_approval");
  const pending = session.snapshot().chat.pendingClarification;
  assert.equal(pending?.promptText, "Which deployment environment should I target?");
  session.answerClarificationAndContinue({
    questionId: pending?.questionId ?? "",
    userAnswer: "Use staging credentials.",
  });

  const result = await run;
  assert.equal(result.answer, "Use staging.");
  assert.equal(result.metadata.clarificationHistory?.length, 1);
  assert.equal(result.metadata.clarificationHistory?.[0]?.user_answer, "Use staging credentials.");
});

test("recursive execution persists node status updates into run-state store", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-runtime-state-"));
  try {
    const trace = new InMemoryTrace();
    const store = new FileRunStateStore({ baseDir: dir, now: () => "2026-05-11T00:00:00.000Z" });
    const engine = new RecursiveLanguageModel(new QueueModel(["direct answer"]), trace);

    const result = await engine.run({
      prompt: "Answer directly",
      config: { ...config, maxDepth: 0 },
      runState: {
        runId: "run-1",
        store,
        actor: "runtime",
        capabilityToken: "tok-runtime",
      },
    });

    assert.equal(result.answer, "direct answer");
    const snapshot = await store.getSnapshot("run-1");
    assert.equal(snapshot?.metadata["prompt"], "Answer directly");
    assert.ok(snapshot?.nodeStatuses.some((item) => item.nodeId === "task-1" && item.status === "completed"));
    assert.ok(snapshot?.mutationLog.some((item) => item.path === "nodeStatuses.task-1" && item.accepted));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("interactive delete_subtree removes target and descendants", () => {
  const session = createInteractiveExecutionSession();
  session.control.registerNode?.({ id: "task-1", kind: "task", label: "root", prompt: "root", depth: 0, status: "ready" });
  session.control.registerNode?.({ id: "task-2", parentId: "task-1", kind: "task", label: "child", prompt: "child", depth: 1, status: "ready" });
  session.control.registerNode?.({ id: "task-3", parentId: "task-2", kind: "task", label: "grandchild", prompt: "grandchild", depth: 2, status: "ready" });
  const result = session.deleteNodeWithStrategy("task-2", "delete_subtree");
  assert.deepEqual(result.deleted.sort(), ["task-2", "task-3"]);
});

test("interactive rewire_dependents preserves downstream nodes and only deletes target", () => {
  const session = createInteractiveExecutionSession();
  session.control.registerNode?.({ id: "task-1", kind: "task", label: "root", prompt: "root", depth: 0, status: "ready" });
  session.control.registerNode?.({ id: "task-2", parentId: "task-1", kind: "task", label: "child", prompt: "child", depth: 1, status: "ready" });
  session.control.registerNode?.({ id: "task-3", parentId: "task-2", kind: "task", label: "grandchild", prompt: "grandchild", depth: 2, status: "ready" });
  const result = session.deleteNodeWithStrategy("task-2", "rewire_dependents");
  assert.deepEqual(result.deleted, ["task-2"]);
  const graph = session.snapshot().graph;
  const grandchild = graph.nodes.find((node) => node.id === "task-3");
  assert.equal(grandchild?.parentId, "task-1");
});

test("interactive execution session returns structured mutation errors", () => {
  const session = createInteractiveExecutionSession();
  const err = (() => {
    try {
      session.addNode({ parentId: "missing", prompt: "child" });
      return null;
    } catch (error) {
      return session.toMutationError(error);
    }
  })();

  assert.ok(err);
  assert.equal(err?.code, "invalid_parent");
  assert.ok(Array.isArray(err?.nodeIds));
});

test("interactive execution applies model override to current node only", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel([
    { content: "RECURSIVE", toolCalls: [], model: "planner" },
    { content: "First child\nSecond child", toolCalls: [], model: "planner" },
    { content: "first answer", toolCalls: [], model: "override-model" },
    { content: "first summary", toolCalls: [], model: "override-model" },
    { content: "second answer", toolCalls: [], model: "base-model" },
    { content: "second summary", toolCalls: [], model: "base-model" },
    { content: "combined", toolCalls: [], model: "planner" },
  ]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession();

  const run = engine.run({
    prompt: "model override scope test",
    config: {
      ...config,
      maxDepth: 1,
    },
    execution: session.control,
  });

  await session.waitForNodeStatus("task-1", "awaiting_approval");
  session.approveNode("task-1");

  await session.waitForNodeStatus("task-2", "awaiting_approval");
  session.setNodeModelOverride("task-2", "override-model");
  session.approveNode("task-2");

  await session.waitForNodeStatus("task-3", "awaiting_approval");
  session.approveNode("task-3");

  const result = await run;
  assert.equal(result.answer, "combined");
  const overrideCalls = model.calls.filter((call) => call.options.overrideModel === "override-model");
  const nonOverrideCalls = model.calls.filter((call) => call.options.overrideModel === undefined);
  assert.ok(overrideCalls.length >= 1);
  assert.ok(nonOverrideCalls.length >= 1);

  const childWithOverride = result.metadata.executionGraph?.nodes.find((node) => node.id === "task-2");
  const siblingNode = result.metadata.executionGraph?.nodes.find((node) => node.id === "task-3");
  assert.equal(childWithOverride?.plannedModel, "override-model");
  assert.equal(childWithOverride?.effectiveModel, "override-model");
  assert.equal(childWithOverride?.modelOverrideSource, "user");
  assert.equal(siblingNode?.modelOverride, undefined);
});

test("initial-plan mode pauses on newly spawned recursive branches", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel(["RECURSIVE", "child task", "child answer", "child summary", "final answer"]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan" });
  const run = engine.run({
    prompt: "root task",
    config: { ...config, maxDepth: 1 },
    execution: session.control,
  });
  await session.waitForNodeStatus("task-1", "awaiting_approval");
  session.approveNode("task-1");
  await session.waitForNodeStatus("task-2", "awaiting_approval");
  const node = session.snapshot().graph.nodes.find((item) => item.id === "task-2");
  assert.equal(node?.spawnedAfterInitialApproval, true);
  session.approveNode("task-2");
  await run;
});

test("initial-plan-recursive mode auto-approves newly spawned recursive branches", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel(["RECURSIVE", "child task", "child answer", "child summary", "final answer"]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  const run = engine.run({
    prompt: "root task",
    config: { ...config, maxDepth: 1 },
    execution: session.control,
  });
  await session.waitForNodeStatus("task-1", "awaiting_approval");
  session.approveNode("task-1");
  const result = await run;
  const child = result.metadata.executionGraph?.nodes.find((node) => node.id === "task-2");
  assert.equal(child?.approvalSource, "auto");
});

test("pause future auto approvals affects future nodes only", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel(["RECURSIVE", "child one\nchild two", "first", "first summary", "second", "second summary", "final"]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  const run = engine.run({
    prompt: "root task",
    config: { ...config, maxDepth: 1, maxBranches: 2 },
    execution: session.control,
  });
  await session.waitForNodeStatus("task-1", "awaiting_approval");
  session.approveNode("task-1");
  await session.waitForNodeStatus("task-2", "running");
  session.pauseFutureAutoApprovals();
  await session.waitForNodeStatus("task-3", "awaiting_approval");
  const node2 = session.snapshot().graph.nodes.find((node) => node.id === "task-2");
  assert.notEqual(node2?.status, "cancelled");
  session.approveNode("task-3");
  await run;
});

test("auto-approved nodes are emitted before running", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel(["RECURSIVE", "child task", "child answer", "child summary", "final answer"]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  const events: Array<{ nodeId: string | undefined; status: string; message: string | undefined }> = [];
  session.subscribe((event) => events.push({ nodeId: event.nodeId, status: event.status, message: event.message }));
  const run = engine.run({
    prompt: "root task",
    config: { ...config, maxDepth: 1 },
    execution: session.control,
  });
  await session.waitForNodeStatus("task-1", "awaiting_approval");
  session.approveNode("task-1");
  await run;
  const autoEventIndex = events.findIndex((event) => event.nodeId === "task-2" && event.message === "node auto-approved");
  const runningEventIndex = events.findIndex((event) => event.nodeId === "task-2" && event.status === "running");
  assert.ok(autoEventIndex >= 0);
  assert.ok(runningEventIndex > autoEventIndex);
});

test("recursive spawning remains observable under initial-plan-recursive", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel([
    "RECURSIVE",
    "child one\nchild two",
    "DIRECT",
    "answer one",
    "summary one",
    "DIRECT",
    "answer two",
    "summary two",
    "final answer",
  ]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  const run = engine.run({ prompt: "root", config: { ...config, maxDepth: 1 }, execution: session.control });
  await session.waitForNodeStatus("task-1", "awaiting_approval");
  session.approveNode("task-1");
  const result = await run;
  const nodes = session.snapshot().graph.nodes;
  assert.ok(nodes.some((node) => node.id === "task-2" && node.parentId === "task-1" && node.approvalSource === "auto"));
  assert.ok(nodes.some((node) => node.id === "task-3" && node.parentId === "task-1" && node.approvalSource === "auto"));
  assert.ok(result.metadata.executionGraph?.edges.some((edge) => edge.from === "task-1" && edge.to === "task-2"));
});

test("model errors remain visible in initial-plan-recursive mode", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new ThrowingModel("model exploded"), trace);
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  const run = engine.run({ prompt: "root", config: { ...config, maxDepth: 0 }, execution: session.control });
  await session.waitForNodeStatus("task-1", "awaiting_approval");
  session.approveNode("task-1");
  await assert.rejects(run, /model exploded/);
});

test("tool errors remain visible in initial-plan-recursive mode", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel([{
    content: "",
    toolCalls: [{ id: "t1", name: "missing_tool", args: {} }],
  }, "fallback"]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  const run = engine.run({
    prompt: "root",
    config: { ...config, maxDepth: 0 },
    execution: session.control,
  });
  await session.waitForNodeStatus("task-1", "awaiting_approval");
  session.approveNode("task-1");
  const result = await run;
  assert.ok(result.metadata.errors.some((error) => error.includes("Unknown tool")));
  assert.equal(result.metadata.executionStatus, "failed");
});

test("budget exhaustion remains visible in initial-plan-recursive mode", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new QueueModel(["RECURSIVE", "direct answer"]), trace);
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  const run = engine.run({
    prompt: "root",
    config: { ...config, maxModelCalls: 2 },
    execution: session.control,
  });
  await session.waitForNodeStatus("task-1", "awaiting_approval");
  session.approveNode("task-1");
  const result = await run;
  assert.equal(result.metadata.modelCalls, 2);
  assert.equal(result.metadata.executionStatus, "completed");
});

test("cancellation remains visible in initial-plan-recursive mode", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel(["answer"]);
  const engine = new RecursiveLanguageModel(model, trace);
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  session.stop("cancelled by test");
  await assert.rejects(
    engine.run({ prompt: "root", config: { ...config, maxDepth: 0 }, execution: session.control }),
    /cancelled by test/,
  );
});

test("approval mode contract is consistent across cli api and ui labels", async () => {
  const parsed = parseArgs(["ask", "hello", "--approval-mode", "initial-plan-recursive"], {});
  assert.equal(parsed.approvalMode, "initial-plan-recursive");
  const session = createInteractiveExecutionSession({ approvalMode: "initial-plan" });
  const server = await startControlServer({ session });
  try {
    const response = await fetch(`${server.url}/api/run-mode`);
    const payload = await response.json() as { approvalMode: string };
    assert.equal(payload.approvalMode, "initial-plan");
  } finally {
    await server.close();
  }
  const uiSource = await readFile(join(process.cwd(), "ui/src/main.tsx"), "utf8");
  assert.match(uiSource, /Full checkpoints/);
  assert.match(uiSource, /Initial plan/);
  assert.match(uiSource, /Initial plan \+ recursive/);
  const rendered = renderResult({
    answer: "ok",
    trace: [],
    metadata: {
      agent: { id: "default", source: "auto" },
      depth: { selected: 0, source: "override" },
      modelSelections: [],
      memoryReservations: [],
      modelCalls: 0,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, unknownCompletions: 0 },
      toolCalls: [],
      errors: [],
      executionGraph: { nodes: [{ id: "task-1", kind: "task", label: "x", depth: 0, status: "ready", approvalMode: "initial-plan-recursive", approvalSource: "none" }], edges: [] },
    },
  }, { compact: true, json: false, includeTrace: false, model: "m" });
  assert.match(rendered, /approvalMode=initial-plan-recursive/);
});

test("initial-plan modes differ only on spawned branch auto approval", async () => {
  const traceA = new InMemoryTrace();
  const traceB = new InMemoryTrace();
  const responses: QueueResponse[] = ["RECURSIVE", "child task", "child answer", "child summary", "final answer"];
  const modelA = new QueueModel([...responses]);
  const modelB = new QueueModel([...responses]);
  const sessionA = createInteractiveExecutionSession({ approvalMode: "initial-plan" });
  const sessionB = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
  const runA = new RecursiveLanguageModel(modelA, traceA).run({
    prompt: "root",
    config: { ...config, maxDepth: 1 },
    execution: sessionA.control,
  });
  await sessionA.waitForNodeStatus("task-1", "awaiting_approval");
  sessionA.approveNode("task-1");
  await sessionA.waitForNodeStatus("task-2", "awaiting_approval");
  const conservativeChildStatus = sessionA.snapshot().graph.nodes.find((node) => node.id === "task-2")?.status;
  sessionA.approveNode("task-2");
  await runA;

  const runB = new RecursiveLanguageModel(modelB, traceB).run({
    prompt: "root",
    config: { ...config, maxDepth: 1 },
    execution: sessionB.control,
  });
  await sessionB.waitForNodeStatus("task-1", "awaiting_approval");
  sessionB.approveNode("task-1");
  await runB;
  const recursiveChild = sessionB.snapshot().graph.nodes.find((node) => node.id === "task-2");
  assert.equal(conservativeChildStatus, "awaiting_approval");
  assert.equal(recursiveChild?.approvalSource, "auto");
});

test("explicit node model override failure is strict and does not fallback", async () => {
  const trace = new InMemoryTrace();
  let defaultCalls = 0;
  const routedModel = new PurposeRoutingLanguageModel({
    config: {
      models: {
        default: "base-model",
        tiers: {
          small: { name: "base-model", estimatedRamMb: 10 },
          medium: { name: "base-model", estimatedRamMb: 10 },
          large: { name: "base-model", estimatedRamMb: 10 },
        },
      },
      agents: {},
      workflows: {},
      runtime: {
        maxDynamicDepth: 1,
        maxBranches: 1,
        maxPromptCharacters: 1_000,
        maxModelCalls: 10,
        maxToolRounds: 1,
      },
      memory: {
        maxRamMb: "auto",
        reserveSystemRamMb: 0,
        waitForCapacity: false,
        capacityCheckIntervalMs: 1,
      },
    },
    agent: {
      tools: [],
      models: {
        classify: "small",
        decompose: "small",
        answer: "small",
        summarize: "small",
        synthesize: "small",
        depth: "small",
      },
    },
    createModel: (modelName) => {
      if (modelName === "failing-model") {
        return new ThrowingModel("selected model unavailable");
      }
      return {
        complete: async () => {
          defaultCalls += 1;
          return { content: "fallback-used", toolCalls: [], model: modelName };
        },
      };
    },
  });
  const engine = new RecursiveLanguageModel(routedModel, trace);
  const session = createInteractiveExecutionSession();

  const run = engine.run({
    prompt: "strict fail",
    config: { ...config, maxDepth: 0 },
    execution: session.control,
  });

  await session.waitForNodeStatus("task-1", "awaiting_approval");
  session.setNodeModelOverride("task-1", "failing-model");
  session.approveNode("task-1");

  await assert.rejects(run, /selected model unavailable/);
  assert.equal(defaultCalls, 0);
});

test("stops recursive expansion when model call budget is nearly exhausted", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(
    new QueueModel(["RECURSIVE", "direct within budget"]),
    trace,
  );

  const result = await engine.run({
    prompt: "Split this forever",
    config: {
      ...config,
      maxModelCalls: 2,
    },
  });

  assert.equal(result.answer, "direct within budget");
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["classify", "answer"],
  );
});

test("counts depth selection against the total model call budget", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new QueueModel(["3", "direct within budget"]), trace);

  const result = await engine.run({
    prompt: "Analyze a complex project",
    config: {
      ...dynamicDepthConfig,
      maxModelCalls: 2,
    },
  });

  assert.equal(result.answer, "direct within budget");
  assert.equal(result.metadata.modelCalls, 2);
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["depth", "answer"],
  );
});

test("selects recursion depth with the model when no override is provided", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new QueueModel(["3", "DIRECT", "direct answer"]), trace);

  const result = await engine.run({
    prompt: "Analyze a complex project",
    config: dynamicDepthConfig,
  });

  assert.equal(result.answer, "direct answer");
  assert.deepEqual(result.metadata.depth, {
    selected: 3,
    source: "model",
  });
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["depth", "classify", "answer"],
  );
});

test("falls back when dynamic depth classifier does not return an integer", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new QueueModel(["not sure", "DIRECT", "direct answer"]), trace);

  const result = await engine.run({
    prompt: "Analyze this",
    config: dynamicDepthConfig,
  });

  assert.deepEqual(result.metadata.depth, {
    selected: 2,
    source: "fallback",
  });
});

test("executes bounded tool calls during answer steps", async () => {
  const trace = new InMemoryTrace();
  const logger = new CaptureLogger();
  const model = new QueueModel([
    {
      content: "",
      toolCalls: [
        {
          id: "call-1",
          name: "echo",
          args: {
            text: "hello",
          },
        },
      ],
    },
    "final answer",
  ]);
  const engine = new RecursiveLanguageModel(model, trace, [new EchoTool()]);

  const result = await engine.run({
    prompt: "Use a tool",
    config: {
      ...config,
      maxDepth: 0,
    },
    logger,
  });

  assert.equal(result.answer, "final answer");
  assert.equal(result.metadata.toolCalls.length, 1);
  assert.equal(result.metadata.toolCalls[0]?.output, "echo: hello");
  assert.deepEqual(
    result.trace.map((event) => event.kind),
    ["tool-call", "tool-result", "answer"],
  );
  assert.equal(model.calls[0]?.options.tools?.length, 1);
  assert.equal(model.calls[1]?.messages.at(-1)?.role, "tool");
  assert.ok(logger.events.some((event) => event.stage === "tool" && event.message === "starting tool call"));
  assert.ok(logger.events.some((event) => event.stage === "tool" && event.message === "completed tool call"));
});

test("logs recursive task plan after decomposition", async () => {
  const trace = new InMemoryTrace();
  const logger = new CaptureLogger();
  const engine = new RecursiveLanguageModel(
    new QueueModel([
      "RECURSIVE",
      "First child\nSecond child",
      "First answer",
      "First summary",
      "Second answer",
      "Second summary",
      "Final answer",
    ]),
    trace,
  );

  const result = await engine.run({
    prompt: "Split this",
    config: {
      ...config,
      maxDepth: 1,
    },
    logger,
  });

  assert.equal(result.answer, "Final answer");
  const planEvent = logger.events.find((event) => event.stage === "plan" && event.message === "created recursive task plan");
  assert.ok(planEvent);
  assert.deepEqual((planEvent.data?.["children"] as Array<{ id: string; prompt: string }>).map((child) => child.prompt), [
    "First child",
    "Second child",
  ]);
});

test("logs failed unknown tool calls and continues with tool result context", async () => {
  const trace = new InMemoryTrace();
  const logger = new CaptureLogger();
  const model = new QueueModel([
    {
      content: "",
      toolCalls: [
        {
          id: "call-missing",
          name: "missing_tool",
          args: {
            text: "hello",
          },
        },
      ],
    },
    "final answer",
  ]);
  const engine = new RecursiveLanguageModel(model, trace, []);

  const result = await engine.run({
    prompt: "Use a missing tool",
    config: {
      ...config,
      maxDepth: 0,
    },
    logger,
  });

  assert.equal(result.answer, "final answer");
  assert.match(result.metadata.errors[0] ?? "", /Unknown tool/);
  assert.ok(logger.events.some((event) => event.stage === "tool" && event.message === "failed tool call"));
  assert.equal(model.calls[1]?.messages.at(-1)?.role, "tool");
});

test("answers from available context when tool round limit is reached", async () => {
  const trace = new InMemoryTrace();
  const model = new QueueModel([
    {
      content: "",
      toolCalls: [
        {
          id: "call-1",
          name: "echo",
          args: {
            text: "hello",
          },
        },
      ],
    },
    "direct answer after tool limit",
  ]);
  const engine = new RecursiveLanguageModel(model, trace, [new EchoTool()]);

  const result = await engine.run({
    prompt: "Use a tool once",
    config: {
      ...config,
      maxDepth: 0,
      maxToolRounds: 0,
    },
  });

  assert.equal(result.answer, "direct answer after tool limit");
  assert.equal(result.metadata.modelCalls, 2);
  assert.ok(result.metadata.errors.some((error) => error.includes("tool round limit reached")));
  assert.equal(model.calls[1]?.options.tools?.length, 0);
});

test("guarded shell tool rejects non-allowlisted commands", async () => {
  const tool = new GuardedShellTool({
    workspaceRoot: process.cwd(),
  });

  const result = await tool.execute({
    command: "npm test",
  });

  assert.equal(result.status, "error");
  assert.match(result.output, /not allowlisted/);
});

test("workspace file write tool writes and appends inside the open directory", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "rlm-write-tool-"));
  try {
    const tool = new WorkspaceFileWriteTool({
      workspaceRoot: workspace,
    });

    const writeResult = await tool.execute({
      path: "notes/output.txt",
      content: "hello",
    });
    const appendResult = await tool.execute({
      path: "notes/output.txt",
      content: " world",
      mode: "append",
    });

    assert.equal(writeResult.status, "success");
    assert.equal(appendResult.status, "success");
    assert.equal(await readFile(join(workspace, "notes/output.txt"), "utf8"), "hello world");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("workspace file write tool rejects paths outside the open directory", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "rlm-write-tool-"));
  try {
    const tool = new WorkspaceFileWriteTool({
      workspaceRoot: workspace,
    });

    const result = await tool.execute({
      path: "../outside.txt",
      content: "nope",
    });

    assert.equal(result.status, "error");
    assert.match(result.output, /outside the open workspace directory/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("agent router selects research for source-backed prompts", () => {
  const registry = createAgentRegistry({
    defaultTools: [new EchoTool()],
    researchTools: [],
  });

  assert.equal(selectAgent(registry, "Research the latest TypeScript release").id, "research");
  assert.equal(selectAgent(registry, "Implement a parser fix and add tests").id, "coding");
  assert.equal(selectAgent(registry, "Design the onboarding UX flow").id, "product_designer");
  assert.equal(selectAgent(registry, "Validate the release workflow").id, "qa");
  assert.equal(selectAgent(registry, "Explain recursion").id, "default");
  assert.equal(selectAgent(registry, "Explain recursion", "research").id, "research");
  assert.equal(selectAgent(registry, "Explain recursion", "coding").id, "coding");
  assert.equal(selectAgent(registry, "Explain recursion", "qa").id, "qa");
  assert.equal(selectAgent(registry, "Explain recursion", "product_designer").id, "product_designer");
});

test("agent profiles expose scoped tool sets", () => {
  const shellTool = new EchoTool();
  const writeTool = new EchoTool();
  const searchTool = new EchoTool();
  const webFetchTool = new EchoTool();
  Object.defineProperty(shellTool, "name", { value: "shell" });
  Object.defineProperty(writeTool, "name", { value: "write_file" });
  Object.defineProperty(searchTool, "name", { value: "web_search" });
  Object.defineProperty(webFetchTool, "name", { value: "web_fetch" });
  const registry = createAgentRegistry({
    defaultTools: [shellTool, writeTool, searchTool, webFetchTool],
    researchTools: [searchTool, webFetchTool],
    codingTools: [shellTool, writeTool, searchTool, webFetchTool],
    productDesignerTools: [searchTool, webFetchTool, writeTool],
  });

  assert.deepEqual(selectAgent(registry, "Fix the CLI", "coding").tools.map((tool) => tool.name), [
    "shell",
    "write_file",
    "web_search",
    "web_fetch",
  ]);
  assert.deepEqual(selectAgent(registry, "Design a settings page", "product_designer").tools.map((tool) => tool.name), [
    "web_search",
    "web_fetch",
    "write_file",
  ]);
  assert.deepEqual(selectAgent(registry, "Research docs", "research").tools.map((tool) => tool.name), [
    "web_search",
    "web_fetch",
  ]);
});

test("bugfix queue skips duplicate highest-priority keywords", () => {
  const queue = buildBugfixQueue({
    id: "bugfix",
    priority: 100,
    highestPriorityKeywords: ["fail", "error", "regression"],
  }, [
    "BUGFIX[fail, build]: Fix failing build command.",
    "BUGFIX[fail, test]: Fix duplicate failing test report.",
    "BUGFIX[regression]: Restore changed CLI output.",
    "BUGFIX: Investigate broken renderer error handling.",
  ].join("\n"), "qa");

  assert.equal(queue.id, "bugfix");
  assert.equal(queue.priority, 100);
  assert.deepEqual(queue.items.map((item) => item.task), [
    "Fix failing build command.",
    "Restore changed CLI output.",
    "Investigate broken renderer error handling.",
  ]);
  assert.deepEqual(queue.items.map((item) => item.keywords), [
    ["fail", "build"],
    ["regression"],
    ["error"],
  ]);
});

test("workflow runs QA validation and exposes bugfix tasks in a higher-priority queue", async () => {
  const tool = new EchoTool();
  const agentModels = {
    depth: "small",
    classify: "small",
    decompose: "small",
    answer: "small",
    summarize: "small",
    synthesize: "small",
  };
  const projectConfig = {
    models: {
      default: "small-model",
      tiers: {
        small: {
          name: "small-model",
          estimatedRamMb: 512,
        },
      },
    },
    memory: {
      maxRamMb: 2048,
      reserveSystemRamMb: 0,
      waitForCapacity: false,
      capacityCheckIntervalMs: 1,
    },
    runtime: config,
    agents: {
      default: {
        tools: ["echo"],
        models: agentModels,
      },
      coding: {
        tools: ["echo"],
        models: agentModels,
      },
      qa: {
        tools: ["echo"],
        models: agentModels,
      },
      product_designer: {
        tools: ["echo"],
        models: agentModels,
      },
      research: {
        tools: ["echo"],
        models: agentModels,
      },
    },
    workflows: {
      default: {
        mode: "ram_queue" as const,
        agents: ["coding"],
        continueOnError: false,
        qa: {
          agent: "qa",
          validationCommands: ["npm test", "npm run build"],
          bugfixQueue: {
            id: "bugfix",
            priority: 100,
            highestPriorityKeywords: ["fail", "error"],
          },
        },
      },
    },
  };
  const registry = createAgentRegistry({
    defaultTools: [tool],
    codingTools: [tool],
    qaTools: [tool],
    productDesignerTools: [tool],
    researchTools: [tool],
    agentConfigs: projectConfig.agents,
  });
  const responses = [
    "Implementation complete.",
    "BUGFIX[error]: Fix build error reported by validation.\nBUGFIX[error]: Duplicate error should not be queued.",
  ];
  const logger = new CaptureLogger();

  const result = await runWorkflow({
    workflowId: "default",
    prompt: "Implement the parser change",
    config: {
      ...config,
      maxDepth: 0,
    },
    projectConfig,
    registry,
    memoryManager: new MemoryManager({
      config: projectConfig.memory,
    }),
    createModel: () => new QueueModel([responses.shift() ?? "ok"]),
    logger,
    runValidationCommand: async (command) => ({
      command,
      status: command === "npm test" ? "success" : "error",
      output: command === "npm test" ? "tests passed" : "build failed",
    }),
  });

  assert.deepEqual(result.metadata.workflow?.agents, ["coding", "qa"]);
  assert.deepEqual(result.metadata.workflow?.qa?.validationCommands.map((item) => item.command), ["npm test", "npm run build"]);
  assert.equal(result.metadata.workflowQueues?.[0]?.id, "bugfix");
  assert.equal(result.metadata.workflowQueues?.[0]?.priority, 100);
  assert.deepEqual(result.metadata.workflowQueues?.[0]?.items.map((item) => item.task), [
    "Fix build error reported by validation.",
  ]);
  assert.ok(logger.events.some((event) => event.stage === "workflow" && event.message === "starting workflow"));
  assert.ok(logger.events.some((event) => event.stage === "workflow" && event.message === "workflow agent completed"));
  assert.ok(logger.events.some((event) => event.stage === "validation" && event.message === "starting validation command"));
  assert.ok(logger.events.some((event) => event.stage === "validation" && event.message === "completed validation command"));
});

test("workflow dispatch tiers run minimal agents for simple prompts", async () => {
  const tool = new EchoTool();
  const agentModels = {
    depth: "small",
    classify: "small",
    decompose: "small",
    answer: "small",
    summarize: "small",
    synthesize: "small",
  };
  const projectConfig = {
    models: {
      default: "small-model",
      tiers: {
        small: {
          name: "small-model",
          estimatedRamMb: 512,
        },
      },
    },
    memory: {
      maxRamMb: 2048,
      reserveSystemRamMb: 0,
      waitForCapacity: false,
      capacityCheckIntervalMs: 1,
    },
    runtime: config,
    agents: {
      default: {
        tools: ["echo"],
        models: agentModels,
      },
      coding: {
        tools: ["echo"],
        models: agentModels,
      },
      qa: {
        tools: ["echo"],
        models: agentModels,
      },
      product_designer: {
        tools: ["echo"],
        models: agentModels,
      },
      research: {
        tools: ["echo"],
        models: agentModels,
      },
    },
    workflows: {
      default: {
        mode: "ram_queue" as const,
        agents: ["research", "product_designer", "coding"],
        continueOnError: false,
        dispatch: {
          strategy: "complexity_tiers" as const,
          tiers: [
            {
              name: "simple",
              maxEstimatedDepth: 1,
              agents: ["coding"],
              qa: false,
            },
            {
              name: "complex",
              agents: ["research", "product_designer", "coding"],
              qa: true,
            },
          ],
        },
        qa: {
          agent: "qa",
          validationCommands: [],
          bugfixQueue: {
            id: "bugfix",
            priority: 100,
            highestPriorityKeywords: ["fail", "error"],
          },
        },
      },
    },
  };
  const registry = createAgentRegistry({
    defaultTools: [tool],
    codingTools: [tool],
    qaTools: [tool],
    productDesignerTools: [tool],
    researchTools: [tool],
    agentConfigs: projectConfig.agents,
  });

  const result = await runWorkflow({
    workflowId: "default",
    prompt: "Fix typo",
    config: {
      ...config,
      maxDepth: 0,
    },
    projectConfig,
    registry,
    memoryManager: new MemoryManager({
      config: projectConfig.memory,
    }),
    createModel: () => new QueueModel(["Implementation complete."]),
  });

  assert.deepEqual(result.metadata.workflow?.agents, ["coding"]);
  assert.equal(result.metadata.workflow?.qa, undefined);
  assert.equal(result.metadata.modelCalls, 1);
});

test("workflow dispatch tiers run complex agent sets and QA for complex prompts", async () => {
  const tool = new EchoTool();
  const agentModels = {
    depth: "small",
    classify: "small",
    decompose: "small",
    answer: "small",
    summarize: "small",
    synthesize: "small",
  };
  const projectConfig = {
    models: {
      default: "small-model",
      tiers: {
        small: {
          name: "small-model",
          estimatedRamMb: 512,
        },
      },
    },
    memory: {
      maxRamMb: 4096,
      reserveSystemRamMb: 0,
      waitForCapacity: false,
      capacityCheckIntervalMs: 1,
    },
    runtime: config,
    agents: {
      default: {
        tools: ["echo"],
        models: agentModels,
      },
      coding: {
        tools: ["echo"],
        models: agentModels,
      },
      qa: {
        tools: ["echo"],
        models: agentModels,
      },
      product_designer: {
        tools: ["echo"],
        models: agentModels,
      },
      research: {
        tools: ["echo"],
        models: agentModels,
      },
    },
    workflows: {
      default: {
        mode: "ram_queue" as const,
        agents: ["coding"],
        continueOnError: false,
        dispatch: {
          strategy: "complexity_tiers" as const,
          tiers: [
            {
              name: "simple",
              maxEstimatedDepth: 1,
              agents: ["coding"],
              qa: false,
            },
            {
              name: "complex",
              agents: ["research", "product_designer", "coding"],
              qa: true,
            },
          ],
        },
        qa: {
          agent: "qa",
          validationCommands: [],
          bugfixQueue: {
            id: "bugfix",
            priority: 100,
            highestPriorityKeywords: ["fail", "error"],
          },
        },
      },
    },
  };
  const registry = createAgentRegistry({
    defaultTools: [tool],
    codingTools: [tool],
    qaTools: [tool],
    productDesignerTools: [tool],
    researchTools: [tool],
    agentConfigs: projectConfig.agents,
  });

  const result = await runWorkflow({
    workflowId: "default",
    prompt: "Design the architecture for a multi-agent workflow system",
    config: {
      ...config,
      maxDepth: 0,
    },
    projectConfig,
    registry,
    memoryManager: new MemoryManager({
      config: projectConfig.memory,
    }),
    createModel: () => new QueueModel(["ok"]),
  });

  assert.deepEqual(result.metadata.workflow?.agents, ["research", "product_designer", "coding", "qa"]);
  assert.equal(result.metadata.workflow?.qa?.agent, "qa");
  assert.equal(result.metadata.modelCalls, 4);
});

test("loads yaml project config from an explicit path", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "rlm-config-"));
  try {
    const configPath = join(workspace, "rlm.config.yaml");
    await writeFile(configPath, `
models:
  default: small-model
  tiers:
    small:
      name: small-model
      estimatedRamMb: 512
memory:
  maxRamMb: 1024
  reserveSystemRamMb: 128
  waitForCapacity: false
  capacityCheckIntervalMs: 1
runtime:
  maxDynamicDepth: 2
  maxBranches: 5
  maxPromptCharacters: 3000
  maxModelCalls: 9
  maxToolRounds: 1
agents:
  default:
    tools: [shell]
    models:
      depth: small
      classify: small
      decompose: small
      answer: dynamic
      summarize: small
      synthesize: small
  coding:
    tools: [shell]
    models:
      depth: small
      classify: small
      decompose: small
      answer: dynamic
      summarize: small
      synthesize: small
  product_designer:
    tools: [write_file]
    models:
      depth: small
      classify: small
      decompose: small
      answer: dynamic
      summarize: small
      synthesize: small
  research:
    tools: [web_search]
    models:
      depth: small
      classify: small
      decompose: small
      answer: dynamic
      summarize: small
      synthesize: small
workflows:
  default:
    mode: ram_queue
    agents: [research, coding]
    continueOnError: true
`, "utf8");

    const loaded = await loadProjectConfig(configPath);

    assert.equal(loaded.path, configPath);
    assert.equal(loaded.config.models.default, "small-model");
    assert.equal(loaded.config.runtime.maxModelCalls, 9);
    assert.equal(loaded.config.runtime.maxBranches, 5);
    assert.deepEqual(loaded.config.workflows["default"]?.agents, ["research", "coding"]);
    assert.deepEqual(resolveRuntimeConfig(loaded.config, { maxModelCalls: 3 }), {
      maxDynamicDepth: 2,
      maxBranches: 5,
      maxPromptCharacters: 3000,
      maxModelCalls: 3,
      maxToolRounds: 1,
      qualityLoop: {
        enabled: false,
        maxIterations: 3,
        budgetBehavior: "stop_before_partial_iteration",
      },
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("purpose routing model selects per-purpose and dynamic tiers", async () => {
  const calls: string[] = [];
  const model = new PurposeRoutingLanguageModel({
    config: {
      models: {
        default: "small-model",
        tiers: {
          small: {
            name: "small-model",
            estimatedRamMb: 512,
          },
          medium: {
            name: "medium-model",
            estimatedRamMb: 1024,
          },
          large: {
            name: "large-model",
            estimatedRamMb: 2048,
          },
        },
      },
      memory: {
        maxRamMb: 4096,
        reserveSystemRamMb: 0,
        waitForCapacity: false,
        capacityCheckIntervalMs: 1,
      },
      runtime: config,
      agents: {},
      workflows: {},
    },
    agent: {
      tools: [],
      models: {
        depth: "small",
        classify: "small",
        decompose: "medium",
        answer: "dynamic",
        summarize: "small",
        synthesize: "medium",
      },
    },
    createModel: (name) => new QueueModel([`${name} response`]),
    recordSelection: (selection) => calls.push(`${selection.purpose}:${selection.model}`),
  });

  assert.equal(selectDynamicTier(1), "small");
  assert.equal(selectDynamicTier(2), "medium");
  assert.equal(selectDynamicTier(3), "large");
  assert.equal((await model.complete([], { purpose: "answer", complexityDepth: 3 })).content, "large-model response");
  assert.equal((await model.complete([], { purpose: "decompose", complexityDepth: 1 })).content, "medium-model response");
  assert.deepEqual(calls, ["answer:large-model", "decompose:medium-model"]);
});

test("memory manager reserves, releases, and rejects over-capacity requests", async () => {
  const manager = new MemoryManager({
    config: {
      maxRamMb: 1024,
      reserveSystemRamMb: 0,
      waitForCapacity: false,
      capacityCheckIntervalMs: 1,
    },
    freememBytes: () => 2048 * 1024 * 1024,
    totalmemBytes: () => 4096 * 1024 * 1024,
  });

  const reservation = await manager.reserve(512);
  assert.equal(manager.snapshot().reservedRamMb, 512);
  await assert.rejects(() => manager.reserve(600), /Insufficient RAM/);
  reservation.release();
  assert.equal(manager.snapshot().reservedRamMb, 0);
});

test("renders compact output for subprocess use", () => {
  const output = renderResult(
    {
      answer: "Hello\nworld",
      metadata: {
        agent: {
          id: "default",
          source: "auto",
        },
        depth: {
          selected: 2,
          source: "override",
        },
        modelSelections: [],
        memoryReservations: [],
        modelCalls: 1,
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          unknownCompletions: 0,
        },
        toolCalls: [],
        errors: [],
      },
      trace: [
        {
          id: "task-1",
          depth: 0,
          kind: "answer",
          prompt: "hello",
          output: "Hello\nworld",
        },
      ],
    },
    {
      compact: true,
      json: false,
      includeTrace: true,
      model: "granite4.1:3b",
    },
  );

  assert.match(output, /model: granite4\.1:3b/);
  assert.match(output, /answer: Hello world/);
  assert.match(output, /trace:/);
});

test("renders json output for tool use", () => {
  const output = renderResult(
    {
      answer: "Hello world",
      metadata: {
        agent: {
          id: "research",
          source: "auto",
        },
        depth: {
          selected: 1,
          source: "model",
        },
        modelSelections: [],
        memoryReservations: [],
        modelCalls: 1,
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          unknownCompletions: 0,
        },
        toolCalls: [],
        errors: [],
      },
      trace: [],
    },
    {
      compact: false,
      json: true,
      includeTrace: false,
      model: "granite4.1:3b",
    },
  );

  assert.deepEqual(JSON.parse(output), {
    answer: "Hello world",
    model: "granite4.1:3b",
    agent: {
      id: "research",
      source: "auto",
    },
    depth: {
      selected: 1,
      source: "model",
    },
    modelSelections: [],
    memoryReservations: [],
    modelCalls: 1,
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      unknownCompletions: 0,
    },
    clarificationHistory: [],
    trace: [],
    toolCalls: [],
    errors: [],
  });
});

test("Phase 5 regression: workflow model failure marks executionStatus and graph nodes failed", async () => {
  const tool = new EchoTool();
  const agentModels = {
    depth: "small",
    classify: "small",
    decompose: "small",
    answer: "small",
    summarize: "small",
    synthesize: "small",
  };
  const projectConfig = {
    models: {
      default: "small-model",
      tiers: {
        small: {
          name: "small-model",
          estimatedRamMb: 512,
        },
      },
    },
    memory: {
      maxRamMb: 2048,
      reserveSystemRamMb: 0,
      waitForCapacity: false,
      capacityCheckIntervalMs: 1,
    },
    runtime: config,
    agents: {
      default: {
        tools: ["echo"],
        models: agentModels,
      },
      coding: {
        tools: ["echo"],
        models: agentModels,
      },
      qa: {
        tools: ["echo"],
        models: agentModels,
      },
      product_designer: {
        tools: ["echo"],
        models: agentModels,
      },
      research: {
        tools: ["echo"],
        models: agentModels,
      },
    },
    workflows: {
      flaky: {
        mode: "ram_queue" as const,
        agents: ["coding"],
        continueOnError: true,
      },
    },
  };
  const registry = createAgentRegistry({
    defaultTools: [tool],
    codingTools: [tool],
    qaTools: [tool],
    productDesignerTools: [tool],
    researchTools: [tool],
    agentConfigs: projectConfig.agents,
  });
  const result = await runWorkflow({
    workflowId: "flaky",
    prompt: "short prompt",
    config: { ...config, maxDepth: 0 },
    projectConfig,
    registry,
    memoryManager: new MemoryManager({
      config: projectConfig.memory,
    }),
    createModel: () => new ThrowingModel("workflow model down"),
  });
  assert.equal(result.metadata.executionStatus, "failed");
  const node = result.metadata.executionGraph?.nodes[0];
  assert.equal(node?.status, "failed");
  assert.ok(result.metadata.errors.some((line) => line.includes("workflow model down")));
});

test("Phase 5 regression: approval loop surfaces failed session snapshot when model throws after approve", async () => {
  const trace = new InMemoryTrace();
  const engine = new RecursiveLanguageModel(new ThrowingModel("boom-after-approval"), trace);
  const session = createInteractiveExecutionSession();
  const run = engine.run({
    prompt: "hello",
    config: { ...config, maxDepth: 0 },
    execution: session.control,
  });
  await session.waitForNodeStatus("task-1", "awaiting_approval");
  session.approveNode("task-1");
  await assert.rejects(run, /boom-after-approval/);
  assert.equal(session.snapshot().status, "failed");
});

test("Phase 5 regression: default text render shows explicit Errors section when run failed", () => {
  const text = renderResult(
    {
      answer: "partial answer",
      trace: [],
      metadata: {
        agent: { id: "default", source: "auto" },
        depth: { selected: 0, source: "override" },
        modelSelections: [],
        memoryReservations: [],
        modelCalls: 1,
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          unknownCompletions: 0,
        },
        toolCalls: [],
        errors: ["simulated tool failure"],
        executionStatus: "failed",
      },
    },
    { compact: false, json: false, includeTrace: false, model: "granite4.1:3b" },
  );
  assert.match(text, /Run status: failed/);
  assert.match(text, /Errors:/);
  assert.match(text, /simulated tool failure/);
});
