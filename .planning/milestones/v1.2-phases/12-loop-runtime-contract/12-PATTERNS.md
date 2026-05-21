# Phase 12: Loop Runtime Contract - Pattern Map

**Mapped:** 2026-05-17  
**Files analyzed:** 10  
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/domain/types.ts` | model | request-response | `src/domain/types.ts` existing `RecursivePromptMetadata`, `ExecutionGraphNode`, `ExecutionEvent` | exact |
| `src/domain/recursive-language-model.ts` | service | request-response | `src/domain/recursive-language-model.ts` existing recursive runtime, budget, graph lifecycle | exact |
| `src/application/project-config.ts` | config | transform | `src/application/project-config.ts` existing `runtimeSchema`, defaults, `resolveRuntimeConfig` | exact |
| `src/ports/language-model-port.ts` | port | request-response | `src/ports/language-model-port.ts` existing `LanguageModelPurpose` and completion options | exact |
| `src/application/model-provider.ts` | service | request-response | `src/application/model-provider.ts` existing purpose routing and selection records | role-match |
| `src/cli/args.ts` | config | transform | `src/cli/args.ts` existing numeric runtime flag parsing | exact |
| `src/cli/render.ts` | utility | transform | `src/cli/render.ts` existing compact/JSON metadata rendering | exact |
| `ui/src/main.tsx` | component | event-driven | `ui/src/main.tsx` existing `ExecutionNode` typing, node card, inspector metadata | role-match |
| `tests/recursive-language-model.test.ts` | test | request-response | `tests/recursive-language-model.test.ts` fake model, budget, cancellation, render assertions | exact |
| `tests/project-config-scopes.test.ts` | test | file-I/O | `tests/project-config-scopes.test.ts` temp YAML config loading tests | exact |

## Pattern Assignments

### `src/domain/types.ts` (model, request-response)

**Analog:** `src/domain/types.ts`

**Imports pattern** (lines 1-3):
```typescript
import type { RuntimeLogger } from "../ports/runtime-logger-port.js";
import type { RunStateStorePort } from "../ports/run-state-store-port.js";
import type { ExecutionFailureCategory } from "./execution-failure.js";
```

**Config contract pattern** (lines 5-12):
```typescript
export interface RecursiveModelConfig {
  maxDepth?: number;
  maxDynamicDepth: number;
  maxBranches: number;
  maxPromptCharacters: number;
  maxModelCalls: number;
  maxToolRounds: number;
}
```

Add `qualityLoop?: QualityLoopConfig | undefined` here so runtime config remains part of the shared domain contract.

**Metadata contract pattern** (lines 152-181):
```typescript
export interface RecursivePromptMetadata {
  agent: {
    id: string;
    source: "auto" | "override";
  };
  configPath?: string | undefined;
  workflow?: {
    id: string;
    agents: string[];
    qa?: {
      agent: string;
      validationCommands: ValidationCommandResult[];
    } | undefined;
  } | undefined;
  workflowQueues?: WorkflowTaskQueue[] | undefined;
  executionGraph?: ExecutionGraph | undefined;
  executionStatus?: ExecutionStatus | undefined;
  budget?: ExecutionBudget | undefined;
  depth: {
    selected: number;
    source: "model" | "override" | "fallback";
  };
  modelSelections: ModelSelectionTrace[];
  memoryReservations: MemoryReservationTrace[];
  modelCalls: number;
  tokenUsage: TokenUsageTrace;
  toolCalls: ToolCallRecord[];
  clarificationHistory?: ClarificationRecord[] | undefined;
  errors: string[];
}
```

Add `qualityLoop?: QualityLoopMetadata | undefined` to final metadata. Terminal loop states should require stop reason and usage summary by type or by a finishing helper.

**Execution graph node pattern** (lines 204-229):
```typescript
export interface ExecutionGraphNode {
  id: string;
  parentId?: string;
  kind: "task" | "workflow-agent" | "workflow-qa";
  position?: { x: number; y: number } | undefined;
  composer?: NodeComposer | undefined;
  label: string;
  prompt?: string | undefined;
  originalPrompt?: string | undefined;
  approvalToken?: string | undefined;
  plannedModel?: string | undefined;
  effectiveModel?: string | undefined;
  modelOverride?: string | undefined;
  modelOverrideSource?: "user" | "none" | undefined;
  editableFields?: Array<"prompt"> | undefined;
  depth: number;
  status: ExecutionStatus;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  approvalMode?: ApprovalMode | undefined;
  approvalSource?: "manual" | "auto" | "none" | undefined;
  approvalReason?: string | undefined;
  spawnedAfterInitialApproval?: boolean | undefined;
  autoApprovalPaused?: boolean | undefined;
}
```

Extend `kind` with a loop-specific top-level kind only if needed, and add `loop?: QualityLoopMetadata | undefined` so draft/critique/refine/gate/best-of-progress history stays nested on one node.

**Event pattern** (lines 247-267):
```typescript
export interface ExecutionEvent {
  type: "execution";
  status: ExecutionStatus;
  nodeId?: string | undefined;
  subtype?: "code_execution" | undefined;
  artifactValidation?: {
    accepted: boolean;
    policy: "strict" | "lenient";
    reason: string;
  } | undefined;
  modelCallsUsed?: number | undefined;
  modelCallsRemaining?: number | undefined;
  toolCallsUsed?: number | undefined;
  message?: string | undefined;
  approvalMode?: ApprovalMode | undefined;
  approvalSource?: "manual" | "auto" | "none" | undefined;
  failureCategory?: ExecutionFailureCategory | undefined;
  code?: string | undefined;
  clarificationRecord?: ClarificationRecord | undefined;
  pendingClarification?: ClarificationQuestion | undefined;
}
```

Use execution events for loop lifecycle observability, but keep canonical loop state in `RecursivePromptMetadata.qualityLoop` and `ExecutionGraphNode.loop`.

---

### `src/domain/recursive-language-model.ts` (service, request-response)

**Analog:** `src/domain/recursive-language-model.ts`

**Imports pattern** (lines 1-20):
```typescript
import type { LanguageModelPort } from "../ports/language-model-port.js";
import type { LanguageModelPurpose } from "../ports/language-model-port.js";
import type { LanguageModelUsage } from "../ports/language-model-port.js";
import type { RuntimeLogger } from "../ports/runtime-logger-port.js";
import type { ToolExecutionResult } from "../ports/tool-port.js";
import type { ToolPort } from "../ports/tool-port.js";
import type { TracePort } from "../ports/trace-port.js";
import type {
  ExecutionEvent,
  ExecutionStatusUpdateDetail,
  RecursiveModelConfig,
  RecursivePromptMetadata,
  RecursivePromptRequest,
  RecursivePromptResult,
  SolvedTask,
  TaskNode,
  ToolCallRecord,
} from "./types.js";
import { EXECUTION_FAILURE_CODES } from "./execution-failure.js";
import { RunStatePersistence } from "./run-state-persistence.js";
```

Add loop-specific types to this existing type import from `./types.js`; do not create an application-layer loop orchestrator.

**Run setup and compatibility gate** (lines 49-83):
```typescript
async run(request: RecursivePromptRequest): Promise<RecursivePromptResult> {
  this.nextId = 1;
  this.modelCalls = 0;
  this.maxModelCalls = request.config.maxModelCalls;
  this.toolRoundLimit = request.config.maxToolRounds;
  this.metadata = createEmptyMetadata();
  this.logger = request.logger;
  this.execution = request.execution;
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
```

Keep non-loop behavior unchanged. Branch into `runQualityLoop(root, config)` only when `config.qualityLoop?.enabled` is explicit; otherwise preserve `solve(root, config)`.

**Existing budget preflight pattern** (lines 204-213, 232-241, 724-733):
```typescript
if (this.remainingModelCalls() <= 1) {
  const answer = await this.answerDirectly(task, "Model call budget is nearly exhausted; answer directly.");
  this.markExecutionNodeCompleted(task.id);
  this.log("task", "completed task", {
    id: task.id,
    depth: task.depth,
    mode: "direct",
  });
  return answer;
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
```

For loops, copy this local-budget style but preflight the full required phase count before starting an iteration. Stop with `budget_exhausted` before partial iteration records are created.

**Completion and usage pattern** (lines 440-473, 770-779):
```typescript
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

  const conversation = [...messages];
  for (let round = 0; round <= this.maxToolRounds(); round += 1) {
    this.modelCalls += 1;
    const callNumber = this.modelCalls;
    const response = await this.model.complete(this.withAgentSystemPrompt(conversation), {
      tools: allowTools ? [...this.toolsByName.values()] : [],
      purpose: toModelPurpose(kind),
      complexityDepth: this.metadata.depth.selected,
      overrideModel: task.modelOverride,
      constrainedToolCalling: allowTools && this.toolsByName.size > 0,
    });
    this.updateExecutionNodeModel(task.id, response.model, task.modelOverride);
    this.recordUsage(response.usage);

private recordUsage(usage: LanguageModelUsage | undefined): void {
  if (!usage) {
    this.metadata.tokenUsage.unknownCompletions += 1;
    return;
  }

  this.metadata.tokenUsage.inputTokens += usage.inputTokens ?? 0;
  this.metadata.tokenUsage.outputTokens += usage.outputTokens ?? 0;
  this.metadata.tokenUsage.totalTokens += usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
}
```

Loop phase calls should use the same `complete()` path so model calls, token usage, selected models, overrides, cancellation, and tool disabling behavior stay centralized.

**Graph lifecycle pattern** (lines 829-860, 885-906, 1014-1026):
```typescript
private ensureExecutionNode(task: TaskNode, kind: "task", label: string): void {
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
      editableFields: ["prompt"],
      depth: task.depth,
      status: "ready",
      approvalMode: this.execution?.approvalMode,
      approvalSource: "none",
      spawnedAfterInitialApproval: this.initialApprovalBoundaryPassed && task.parentId !== undefined,
      autoApprovalPaused: this.execution?.autoApprovalPaused?.() ?? false,
    };
    this.executionNodes.set(task.id, node);
    this.updateExecutionGraph();
    this.execution?.registerNode?.(node);
  }
}

private markExecutionNodeCompleted(nodeId: string): void {
  const node = this.executionNodes.get(nodeId);
  if (!node) return;
  if (node.status === "failed" || node.status === "cancelled") return;

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
```

Create or update exactly one loop top-level node and mutate `node.loop` as each internal phase record is produced.

**Cancellation and terminal failure pattern** (lines 805-826, 934-949):
```typescript
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
```

Loop cancellation must set loop terminal metadata with `stopReason: "stopped"` or equivalent accepted reason before throwing/returning; do not allow a terminal loop state without usage summary.

---

### `src/application/project-config.ts` (config, transform)

**Analog:** `src/application/project-config.ts`

**Imports and purposes pattern** (lines 1-12):
```typescript
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";
import type { RecursiveModelConfig } from "../domain/types.js";
import type { ExtensionRegistryEntry } from "../ports/extension-port.js";
import type { LanguageModelPurpose } from "../ports/language-model-port.js";

export const MODEL_PURPOSES = ["depth", "classify", "decompose", "answer", "summarize", "synthesize"] as const satisfies readonly LanguageModelPurpose[];
```

If loop phases become routable model purposes in Phase 12, update both `MODEL_PURPOSES` and the port union together.

**Runtime schema/default pattern** (lines 135-164):
```typescript
const runtimeSchema = z.object({
  maxDepth: z.number().int().nonnegative().optional(),
  maxDynamicDepth: z.number().int().nonnegative().default(4),
  maxBranches: z.number().int().nonnegative().default(3),
  maxPromptCharacters: z.number().int().positive().default(6_000),
  maxModelCalls: z.number().int().nonnegative().default(24),
  maxToolRounds: z.number().int().nonnegative().default(3),
});

runtime: runtimeSchema.default({
  maxDynamicDepth: 4,
  maxBranches: 3,
  maxPromptCharacters: 6_000,
  maxModelCalls: 24,
  maxToolRounds: 3,
}),
```

Add `qualityLoop` as a nested Zod object with conservative defaults, e.g. disabled by default and positive `maxIterations`.

**Default config pattern** (lines 262-268):
```typescript
runtime: {
  maxDynamicDepth: 4,
  maxBranches: 3,
  maxPromptCharacters: 6_000,
  maxModelCalls: 24,
  maxToolRounds: 3,
},
```

Keep defaults in `DEFAULT_PROJECT_CONFIG.runtime` synchronized with `runtimeSchema.default`.

**Layered merge and runtime resolution pattern** (lines 433-436, 680-690):
```typescript
if (key === "memory" || key === "runtime") {
  const prior = isPlainRecord(existingFlat) ? (existingFlat as Record<string, unknown>) : {};
  out[key] = { ...prior, ...incoming };
  continue;
}

export function resolveRuntimeConfig(config: ProjectConfig, overrides: Partial<RecursiveModelConfig> = {}): RecursiveModelConfig {
  const runtime: RecursiveModelConfig = {
    ...DEFAULT_PROJECT_CONFIG.runtime,
    ...config.runtime,
    ...overrides,
  };
  if (runtime.maxDepth === undefined) {
    delete runtime.maxDepth;
  }

  return runtime;
}
```

If CLI overrides can set nested `qualityLoop`, merge the nested object deliberately rather than replacing user config accidentally.

---

### `src/ports/language-model-port.ts` (port, request-response)

**Analog:** `src/ports/language-model-port.ts`

**Completion options and purpose union pattern** (lines 13-21):
```typescript
export interface LanguageModelCompleteOptions {
  tools?: LanguageModelTool[];
  purpose?: LanguageModelPurpose | undefined;
  complexityDepth?: number;
  overrideModel?: string | undefined;
  constrainedToolCalling?: boolean | undefined;
}

export type LanguageModelPurpose = "depth" | "classify" | "decompose" | "answer" | "summarize" | "synthesize";
```

Only add loop phase purposes if Phase 12 needs model routing/trail records to distinguish `draft`, `critique`, `refine`, `gate`, and `best_of_progress`. Otherwise reuse existing `"answer"`/`"summarize"` purposes and keep this file unchanged.

---

### `src/application/model-provider.ts` (service, request-response)

**Analog:** `src/application/model-provider.ts`

**Purpose routing pattern** (lines 48-90, 118-124):
```typescript
async complete(
  messages: LanguageModelMessage[],
  completeOptions: LanguageModelCompleteOptions = {},
): Promise<LanguageModelResponse> {
  if (completeOptions.overrideModel) {
    const model = completeOptions.overrideModel;
    const runtime = await this.resolveRuntimeSelection();
    const response = await this.getModel(model, runtime).complete(messages, completeOptions);
    response.model ??= model;
    response.host ??= {
      id: runtime.hostId,
      kind: runtime.hostKind,
      endpoint: runtime.baseUrl,
    };
    this.options.recordSelection?.({
      purpose: completeOptions.purpose ?? "default",
      model,
      tier: "override",
      estimatedRamMb: 0,
      source: "configured",
      hostId: runtime.hostId,
      hostKind: runtime.hostKind,
      hostEndpoint: runtime.baseUrl,
    });
    return response;
  }

  const selection = await this.selectModel(completeOptions.purpose, completeOptions.complexityDepth);
  this.options.recordSelection?.(selection);
}

async selectModel(purpose: LanguageModelPurpose | undefined, complexityDepth = 0): Promise<ModelSelectionRecord> {
  const normalizedPurpose = purpose ?? "default";
  const configuredSelection = purpose ? this.options.agent.models[purpose] : undefined;
  const tierName = configuredSelection === "dynamic"
    ? selectDynamicTier(complexityDepth)
    : configuredSelection ?? "small";
```

If loop phase purposes are added, agent model maps must include them or this code must intentionally fall back to `"small"`/existing purposes without breaking strict TypeScript indexing.

---

### `src/cli/args.ts` (config, transform)

**Analog:** `src/cli/args.ts`

**Options/config override pattern** (lines 1-33):
```typescript
import type { ApprovalMode, RecursiveModelConfig } from "../domain/types.js";

export interface CliOptions {
  command: "ask" | "help" | "ui";
  prompt: string;
  config: RecursiveModelConfig;
  configOverrides: Partial<RecursiveModelConfig>;
  compact: boolean;
  json: boolean;
  trace: boolean;
  verbose: boolean;
  jsonStream: boolean;
  planOnly: boolean;
  requireApproval: boolean;
  approvalMode: ApprovalMode;
  approve: boolean;
  model: string;
}

const DEFAULT_CONFIG: RecursiveModelConfig = {
  maxDynamicDepth: 4,
  maxBranches: 3,
  maxPromptCharacters: 6_000,
  maxModelCalls: 24,
  maxToolRounds: 3,
};
```

Mirror config defaults here if Phase 12 exposes CLI loop flags.

**Runtime flag parse pattern** (lines 121-166):
```typescript
if (arg === "--depth") {
  const value = parsePositiveInteger(readValue(args, index, arg), arg);
  config.maxDepth = value;
  configOverrides.maxDepth = value;
  index += 1;
  continue;
}

if (arg === "--max-model-calls") {
  const value = parsePositiveInteger(readValue(args, index, arg), arg);
  config.maxModelCalls = value;
  configOverrides.maxModelCalls = value;
  index += 1;
  continue;
}
```

Use the same parse-and-record-in-`configOverrides` pattern for flags such as `--quality-loop` and `--quality-loop-iterations`, if included in Phase 12.

---

### `src/cli/render.ts` (utility, transform)

**Analog:** `src/cli/render.ts`

**Compact metadata pattern** (lines 33-54):
```typescript
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
    `answer: ${singleLine(result.answer)}`,
  ];
  if (result.metadata.executionGraph?.nodes.length) {
    const autoApprovedNodes = result.metadata.executionGraph.nodes.filter((node) => node.approvalSource === "auto").length;
    lines.push(`autoApprovedNodes=${autoApprovedNodes}`);
    lines.push("nodeModels:");
  }
```

Add concise loop summary lines here: status, stop reason, iterations, model calls, unresolved issue count, and selected candidate id.

**JSON pass-through pattern** (lines 72-94):
```typescript
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
```

Add `qualityLoop: result.metadata.qualityLoop` so JSON consumers receive the canonical runtime contract.

---

### `ui/src/main.tsx` (component, event-driven)

**Analog:** `ui/src/main.tsx`

**Execution node type mirror pattern** (lines 21-101):
```typescript
type ExecutionStatus =
  | "planned"
  | "ready"
  | "awaiting_approval"
  | "approved"
  | "running"
  | "completed"
  | "skipped"
  | "failed"
  | "cancelled";

type ExecutionNode = {
  id: string;
  parentId?: string;
  position?: { x: number; y: number };
  kind: "task" | "workflow-agent" | "workflow-qa";
  label: string;
  prompt?: string;
  originalPrompt?: string;
  plannedModel?: string;
  effectiveModel?: string;
  modelOverride?: string;
  modelOverrideSource?: "user" | "none";
  approvalMode?: "full" | "initial-plan" | "initial-plan-recursive";
  approvalSource?: "manual" | "auto" | "none";
  depth: number;
  status: ExecutionStatus;
};
```

Mirror any new `kind` and `loop` metadata shape here if the Phase 12 UI must show the collapsed loop node correctly. Keep rich controls deferred.

**Node-card model/status pattern** (lines 496-547):
```tsx
function ExecutionNodeCard({ data }: { data: FlowNodeData }) {
  const node = data.execution;
  const composer = node.composer;
  return (
    <div className={`node-card ${node.status}`}>
      <div className="node-header">
        <div>
          <div className="node-type">{composer?.type ?? node.kind}</div>
          <div className="node-runtime">{composer?.runtime ?? "runtime"} · {node.status}</div>
        </div>
        <span className={`complexity ${composer?.complexity ?? "low"}`}>{composer?.complexity ?? "low"}</span>
      </div>
      <div className="node-title">{node.label}</div>
      <div className="node-models">
        <div>P: {node.plannedModel ?? "resolved-at-runtime"}</div>
        <div>E: {node.effectiveModel ?? "pending"}</div>
        <div>Mode: {node.approvalMode ?? "full"}</div>
        <div>Approval: {node.approvalSource ?? "none"}</div>
        {node.spawnedAfterInitialApproval ? <div className="badge">spawned branch</div> : null}
      </div>
    </div>
  );
}
```

Add only compact loop signals in Phase 12, such as `Loop: stopReason`, iteration count, and unresolved issue count.

**Inspector metadata pattern** (lines 655-670):
```tsx
<div>
  <label>Model Trail</label>
  <div className="meta-row">Planned: {node.plannedModel ?? "resolved-at-runtime"}</div>
  <div className="meta-row">Effective: {node.effectiveModel ?? "pending"}</div>
  <div className="meta-row">Override Source: {node.modelOverrideSource ?? "none"}</div>
</div>
<div>
  <label>Approval</label>
  <div className="meta-row">Mode: {approvalModeLabel(node.approvalMode ?? "full")}</div>
  <div className="meta-row">Source: {node.approvalSource ?? "none"}</div>
  <div className="meta-row">Spawned after initial approval: {String(node.spawnedAfterInitialApproval ?? false)}</div>
</div>
```

If touched, add a small loop metadata block near these existing inspectable metadata sections.

---

### `tests/recursive-language-model.test.ts` (test, request-response)

**Analog:** `tests/recursive-language-model.test.ts`

**Fake model pattern** (lines 1-49, 80-87):
```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { RecursiveLanguageModel } from "../src/domain/recursive-language-model.js";
import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelResponse,
} from "../src/ports/language-model-port.js";
import { InMemoryTrace } from "../src/adapters/in-memory-trace.js";

type QueueResponse = string | LanguageModelResponse;

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

    return typeof response === "string" ? { content: response, toolCalls: [] } : response;
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
```

Use `QueueModel` for draft/critique/refine/gate phase responses and assert `model.calls` purposes/options when loop phase routing matters.

**Budget regression pattern** (lines 1066-1086):
```typescript
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
```

Add loop tests for budget preflight: no partial next iteration, `stopReason === "budget_exhausted"`, usage summary present, and best available answer returned when a candidate exists.

**Cancellation regression pattern** (lines 918-928):
```typescript
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
```

Add loop cancellation/human stop tests that assert loop terminal metadata includes stop reason and partial usage summary.

**Render contract pattern** (lines 946-961):
```typescript
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
```

Add compact and JSON render assertions for `qualityLoop` once renderer is updated.

---

### `tests/project-config-scopes.test.ts` (test, file-I/O)

**Analog:** `tests/project-config-scopes.test.ts`

**Temp YAML config pattern** (lines 9-77):
```typescript
test("layered config lets project agent override global agent with same id", async () => {
  const prevHome = process.env.HOME;
  const prevUserProfile = process.env.USERPROFILE;
  const prevCwd = process.cwd();
  const sandbox = await mkdtemp(join(tmpdir(), "rlm-scope-"));
  const fakeHome = join(sandbox, "home");
  const projectRoot = join(sandbox, "project");

  await mkdir(join(fakeHome, ".rlm", "agents"), { recursive: true });
  await mkdir(join(projectRoot, ".rlm", "agents"), { recursive: true });
  await writeFile(
    join(fakeHome, ".rlm", "agents", "a.yaml"),
    `tools: [shell]
models:
  depth: small
  classify: small
  decompose: small
  answer: small
  summarize: small
  synthesize: small
`,
    "utf8",
  );

  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  process.chdir(projectRoot);

  try {
    const loaded = await loadProjectConfig();
    assert.ok(loaded.config.agents["a"]?.tools.includes("web_search"));
  }
  finally {
    process.chdir(prevCwd);
    process.env.HOME = prevHome;
    process.env.USERPROFILE = prevUserProfile;
    await rm(sandbox, { recursive: true, force: true });
  }
});
```

Add config tests for project YAML `runtime.qualityLoop`, defaults, invalid `maxIterations`, and nested merge behavior if CLI/config overrides are introduced.

## Shared Patterns

### Canonical State In Metadata

**Source:** `src/domain/types.ts` lines 152-181 and `src/domain/recursive-language-model.ts` lines 1014-1026  
**Apply to:** `src/domain/types.ts`, `src/domain/recursive-language-model.ts`, `src/cli/render.ts`, `ui/src/main.tsx`, tests

Canonical runtime state belongs in `RecursivePromptMetadata` and `ExecutionGraphNode`. Events and trace records mirror lifecycle but are not the source of truth.

```typescript
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
```

### Budget Accounting

**Source:** `src/domain/recursive-language-model.ts` lines 724-733 and 770-779  
**Apply to:** loop runtime and loop tests

```typescript
private canSpendAnyModelCall(): boolean {
  return this.modelCalls < this.maxModelCalls;
}

private remainingModelCalls(): number {
  return this.maxModelCalls - this.modelCalls;
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
```

### Event Emission

**Source:** `src/domain/recursive-language-model.ts` lines 875-882 and 899-906  
**Apply to:** loop start, phase completion, continue/stop decision, terminal loop reason

```typescript
this.emitExecution({
  type: "execution",
  status: "completed",
  nodeId,
  modelCallsUsed: this.modelCalls,
  modelCallsRemaining: this.remainingModelCalls(),
  toolCallsUsed: this.metadata.toolCalls.length,
});
```

### Config Validation

**Source:** `src/application/project-config.ts` lines 135-164 and 680-690  
**Apply to:** `runtime.qualityLoop` schema/defaults and CLI overrides

```typescript
const runtimeSchema = z.object({
  maxDepth: z.number().int().nonnegative().optional(),
  maxDynamicDepth: z.number().int().nonnegative().default(4),
  maxBranches: z.number().int().nonnegative().default(3),
  maxPromptCharacters: z.number().int().positive().default(6_000),
  maxModelCalls: z.number().int().nonnegative().default(24),
  maxToolRounds: z.number().int().nonnegative().default(3),
});

export function resolveRuntimeConfig(config: ProjectConfig, overrides: Partial<RecursiveModelConfig> = {}): RecursiveModelConfig {
  const runtime: RecursiveModelConfig = {
    ...DEFAULT_PROJECT_CONFIG.runtime,
    ...config.runtime,
    ...overrides,
  };
```

### Testing With Queue Models

**Source:** `tests/recursive-language-model.test.ts` lines 30-49 and 1066-1086  
**Apply to:** loop bounds, budget exhaustion, stop reasons, metadata shape, non-loop preservation

```typescript
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

    return typeof response === "string" ? { content: response, toolCalls: [] } : response;
  }
}
```

## No Analog Found

No files lacked a close codebase analog. Phase 12 should not introduce a separate loop orchestration subsystem, separate trace store, or new test framework.

## Metadata

**Analog search scope:** `src/domain`, `src/application`, `src/ports`, `src/cli`, `ui/src`, `tests`  
**Files scanned:** 34 source/test/UI files via `rg --files`; 10 files read for excerpts  
**Pattern extraction date:** 2026-05-17
