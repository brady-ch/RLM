import type { RuntimeLogger } from "../ports/runtime-logger-port.js";
import type { RunStateStorePort } from "../ports/run-state-store-port.js";
import type { ExecutionFailureCategory } from "./execution-failure.js";

export interface RecursiveModelConfig {
  maxDepth?: number;
  maxDynamicDepth: number;
  maxBranches: number;
  maxPromptCharacters: number;
  maxModelCalls: number;
  maxToolRounds: number;
  qualityLoop?: QualityLoopConfig | undefined;
}

export type QualityLoopPhaseName = "draft" | "critique" | "refine" | "gate" | "best_of_progress";

export type QualityLoopStopReason =
  | "passed"
  | "critique_resolved"
  | "no_meaningful_improvement"
  | "max_iterations"
  | "budget_exhausted"
  | "human_accepted"
  | "stopped"
  | "degraded"
  | "failed";

export type QualityLoopStatus =
  | "idle"
  | "running"
  | "completed"
  | "stopped"
  | "degraded"
  | "failed"
  | "cancelled";

export type QualityLoopBudgetBehavior = "stop_before_partial_iteration";

export interface QualityLoopConfig {
  enabled: boolean;
  maxIterations: number;
  budgetBehavior: QualityLoopBudgetBehavior;
  phaseModels?: Partial<Record<QualityLoopPhaseName, string>> | undefined;
}

export interface QualityLoopPhaseModelAssignment {
  phase: QualityLoopPhaseName;
  purpose: string;
  plannedSelection: string;
  plannedModel: string;
  effectiveModel: string;
  tier: string;
  source: "configured" | "phase_override" | "node_override";
  hostId?: string | undefined;
  hostKind?: "ollama" | "http" | undefined;
  hostEndpoint?: string | undefined;
}

export interface QualityLoopManualDecision {
  action: "accept" | "stop";
  reason: string;
  requestedAt: string;
  source: "user";
}

export interface QualityLoopUsageSummary {
  iterationsStarted: number;
  iterationsCompleted: number;
  phaseCallCounts: Record<QualityLoopPhaseName, number>;
  modelCallsTotal: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  unknownCompletions: number;
}

export interface QualityLoopIssue {
  id: string;
  severity: "info" | "warning" | "error";
  text: string;
  sourcePhase: QualityLoopPhaseName;
}

export interface QualityLoopCandidateSummary {
  id: string;
  iteration: number;
  phase: QualityLoopPhaseName;
  summary: string;
  score?: number | undefined;
  selectionScore?: number | undefined;
  selectionRationale?: string | undefined;
  sourceIssueIds?: string[] | undefined;
  artifactRef?: string | undefined;
  isSelected?: boolean | undefined;
}

export interface QualityLoopPhaseRecord {
  phase: QualityLoopPhaseName;
  status: QualityLoopStatus;
  startedAt: string;
  completedAt?: string | undefined;
  candidateId?: string | undefined;
  summary?: string | undefined;
  score?: number | undefined;
  model?: string | undefined;
  plannedModel?: string | undefined;
  modelPurpose?: string | undefined;
  modelSelection?: string | undefined;
  modelSource?: QualityLoopPhaseModelAssignment["source"] | undefined;
  usage?: TokenUsageTrace | undefined;
  unresolvedIssues?: QualityLoopIssue[] | undefined;
  parseStatus?: QualityLoopEvaluatorParseStatus | undefined;
  parseError?: string | undefined;
}

export interface QualityLoopCritiqueEvaluation {
  summary: string;
  issues: QualityLoopIssue[];
  resolved: boolean;
  suggestedImprovements: string[];
}

export interface QualityLoopGateEvaluation {
  decision: "pass" | "continue";
  score: number;
  passThreshold: number;
  rubricFit: boolean;
  critiqueResolved: boolean;
  meaningfulImprovement: boolean;
  rationale: string;
  failedConditions: string[];
  unresolvedIssues: QualityLoopIssue[];
}

export interface QualityLoopBestOfProgressEvaluation {
  selectedCandidateId: string;
  rationale: string;
  score: number;
  comparisonNotes: string[];
}

export interface QualityLoopSelectionMetadata {
  selectedCandidateId: string;
  rationale: string;
  scoreBasis: string[];
  comparisonNotes: string[];
  fallbackReason?: string | undefined;
  invalidCandidateId?: string | undefined;
}

export type QualityLoopEvaluatorParseStatus = "parsed" | "degraded" | "failed";

export interface QualityLoopIterationRecord {
  index: number;
  status: QualityLoopStatus;
  startedAt: string;
  completedAt?: string | undefined;
  phases: QualityLoopPhaseRecord[];
  candidates: QualityLoopCandidateSummary[];
  unresolvedIssues: QualityLoopIssue[];
  critiqueEvaluation?: QualityLoopCritiqueEvaluation | undefined;
  gateEvaluation?: QualityLoopGateEvaluation | undefined;
  bestOfProgressEvaluation?: QualityLoopBestOfProgressEvaluation | undefined;
}

export interface QualityLoopMetadata {
  config: QualityLoopConfig;
  status: QualityLoopStatus;
  rubric?: QualityLoopRubricSelection | undefined;
  gate?: QualityLoopGateEvaluation | undefined;
  selection?: QualityLoopSelectionMetadata | undefined;
  phaseModels?: Partial<Record<QualityLoopPhaseName, QualityLoopPhaseModelAssignment>> | undefined;
  stopReason?: QualityLoopStopReason | undefined;
  usage: QualityLoopUsageSummary;
  iterations: QualityLoopIterationRecord[];
  candidates: QualityLoopCandidateSummary[];
  selectedCandidateId?: string | undefined;
  unresolvedIssues: QualityLoopIssue[];
  message?: string | undefined;
}

export type QualityLoopRubricId =
  | "general_answer_quality"
  | "code_engineering"
  | "planning_architecture"
  | "user_facing_writing"
  | "structured_artifact";

export interface QualityLoopRubricCriterion {
  id: string;
  label: string;
  description: string;
}

export interface QualityLoopRubricSelection {
  id: QualityLoopRubricId;
  label: string;
  rationale: string;
  matchedSignals: string[];
  confidence: number;
  criteria: QualityLoopRubricCriterion[];
}

export interface RecursivePromptRequest {
  prompt: string;
  config: RecursiveModelConfig;
  logger?: RuntimeLogger | undefined;
  execution?: ExecutionControl | undefined;
  runState?: RuntimeRunState | undefined;
  agent?: {
    id: string;
    source: "auto" | "override";
    systemPrompt: string;
  };
}

export interface RuntimeRunState {
  runId: string;
  store: RunStateStorePort;
  actor: string;
  capabilityToken: string;
}

export interface RecursivePromptResult {
  answer: string;
  trace: TraceEvent[];
  metadata: RecursivePromptMetadata;
}

export interface TraceEvent {
  id: string;
  parentId?: string;
  depth: number;
  kind:
    | "depth"
    | "classify"
    | "decompose"
    | "answer"
    | "summarize"
    | "synthesize"
    | "tool-call"
    | "tool-result"
    | "code_execution"
    | "error";
  prompt: string;
  output: string;
}

export interface TaskNode {
  id: string;
  parentId?: string;
  prompt: string;
  depth: number;
  kind?: "task" | "code" | undefined;
  artifactContract?: ArtifactContract | undefined;
  modelOverride?: string | undefined;
}

export interface ArtifactContract {
  inputSchema?: string | undefined;
  outputSchema?: string | undefined;
  edgeNarrowingSchema?: string | undefined;
  validationPolicy?: "strict" | "lenient" | undefined;
}

export type ComposerNodeType = "AI" | "Code" | "TTS" | "Splitter" | "Joiner" | "Validator";

export type ComposerComplexity = "low" | "medium" | "high";

export interface ComposerPort {
  id: string;
  label: string;
  artifactType: string;
  schema?: string | undefined;
  required?: boolean | undefined;
}

export interface ComposerArtifactRef {
  id: string;
  uri: string;
  mediaType: string;
  sizeBytes?: number | undefined;
  durationMs?: number | undefined;
  hash?: string | undefined;
  producerNodeId?: string | undefined;
  orderingKey?: string | undefined;
  metadata?: Record<string, string | number | boolean> | undefined;
  /** Last-known validation from runtime events (e.g. run-state / artifact policy). */
  validation?: {
    state: "validated" | "skipped" | "failed";
    reason?: string | undefined;
    policy?: "strict" | "lenient" | undefined;
  } | undefined;
}

export interface ComposerPlanBudget {
  maxDepth: number;
  maxNodes: number;
  usedDepth: number;
  usedNodes: number;
  remainingDepth: number;
  remainingNodes: number;
  approvalRequired: boolean;
  exhausted: boolean;
}

export interface ComposerContextPolicy {
  reads: string[];
  writes: string[];
  limits: string[];
  memoryScopes: string[];
}

export interface NodeComposer {
  type: ComposerNodeType;
  runtime: "model" | "code" | "tts";
  prompt?: string | undefined;
  codeEntry?: string | undefined;
  sandboxPolicy?: string | undefined;
  inputs: ComposerPort[];
  outputs: ComposerPort[];
  artifactRefs: ComposerArtifactRef[];
  contextPolicy: ComposerContextPolicy;
  complexity: ComposerComplexity;
  recommendedAction: "run" | "plan" | "break_down" | "review";
  planBudget: ComposerPlanBudget;
  pendingPlan?: {
    parentNodeId: string;
    childNodeIds: string[];
    createdAt: string;
    summary: string;
  } | undefined;
}

export interface SolvedTask {
  id: string;
  prompt: string;
  answer: string;
  summary: string;
}

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
  qualityLoop?: QualityLoopMetadata | undefined;
  clarificationHistory?: ClarificationRecord[] | undefined;
  errors: string[];
}

export type ExecutionStatus =
  | "planned"
  | "ready"
  | "awaiting_approval"
  | "approved"
  | "running"
  | "completed"
  | "skipped"
  | "failed"
  | "cancelled";

export type ApprovalMode = "full" | "initial-plan" | "initial-plan-recursive";

export interface ExecutionBudget {
  estimatedModelCalls: number;
  estimatedToolRounds: number;
  modelCallsUsed: number;
  modelCallsRemaining: number;
  toolCallsUsed: number;
}

export interface ExecutionGraphNode {
  id: string;
  parentId?: string;
  kind: "task" | "workflow-agent" | "workflow-qa" | "quality-loop";
  /** Authoritative canvas position for the control-server session graph. */
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
  loop?: QualityLoopMetadata | undefined;
}

export interface ExecutionGraphEdge {
  from: string;
  to: string;
  /** Output port id on the `from` node when the edge was created from handles. */
  sourceHandle?: string | undefined;
  /** Input port id on the `to` node when the edge was created from handles. */
  targetHandle?: string | undefined;
}

export interface ExecutionGraph {
  nodes: ExecutionGraphNode[];
  edges: ExecutionGraphEdge[];
  /** Last persisted React Flow viewport for this session (optional). */
  viewport?: { x: number; y: number; zoom: number } | undefined;
}

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

export interface ExecutionStatusUpdateDetail {
  failureCategory?: ExecutionFailureCategory | undefined;
  code?: string | undefined;
  message?: string | undefined;
}

export interface ExecutionControl {
  planOnly?: boolean | undefined;
  approvalMode?: ApprovalMode | undefined;
  isCancelled: () => boolean;
  cancelReason?: () => string | undefined;
  onEvent?: ((event: ExecutionEvent) => void) | undefined;
  registerNode?: ((node: ExecutionGraphNode) => void) | undefined;
  updateNodeStatus?: ((nodeId: string, status: ExecutionStatus, detail?: ExecutionStatusUpdateDetail) => void) | undefined;
  waitForNodeApproval?: ((node: ExecutionGraphNode) => Promise<NodeApprovalDecision>) | undefined;
  pauseFutureAutoApprovals?: (() => void) | undefined;
  autoApprovalPaused?: (() => boolean) | undefined;
  requestClarification?: ((input: { nodeId: string; promptText: string }) => Promise<string>) | undefined;
  getClarificationHistory?: (() => ClarificationRecord[]) | undefined;
  getQualityLoopDecision?: ((nodeId: string) => QualityLoopManualDecision | undefined) | undefined;
}

export interface NodeApprovalDecision {
  status: "approved" | "skipped" | "cancelled";
  prompt: string;
  modelOverride?: string | undefined;
  approvalSource?: "manual" | "auto" | "none" | undefined;
  approvalReason?: string | undefined;
}

export interface GraphMutationError {
  code: string;
  message: string;
  nodeIds: string[];
  details?: string | undefined;
  suggestedFix?: string | undefined;
}

export type ChatGraphReadinessState = "draft" | "ready_to_run";

export interface ChatRunReadiness {
  state: ChatGraphReadinessState;
  reason: string;
}

export type DeleteStrategy = "delete_subtree" | "rewire_dependents";

export interface PendingDeleteChoice {
  nodeId: string;
  options: DeleteStrategy[];
}

export interface ChatMutationProposal {
  id: string;
  summary: string;
  requiresClarification: boolean;
  clarificationQuestion?: string | undefined;
  requiresDeleteChoice: boolean;
  pendingDeleteChoice?: PendingDeleteChoice | undefined;
}

export interface ClarificationQuestion {
  questionId: string;
  nodeId: string;
  promptText: string;
  askedAt: string;
}

export interface ClarificationRecord {
  question_id: string;
  node_id: string;
  prompt_text: string;
  user_answer: string;
  asked_at: string;
  answered_at: string;
  resume_event_id: string;
}

export interface TokenUsageTrace {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  unknownCompletions: number;
}

export interface ModelSelectionTrace {
  agent: string;
  purpose: string;
  model: string;
  tier: string;
  estimatedRamMb: number;
  source?: "configured" | undefined;
  hostId?: string | undefined;
  hostKind?: "ollama" | "http" | undefined;
  hostEndpoint?: string | undefined;
}

export interface MemoryReservationTrace {
  agent: string;
  requestedRamMb: number;
  availableRamMb: number;
  waitedMs: number;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "success" | "error";
  output: string;
}

export interface ValidationCommandResult {
  command: string;
  status: "success" | "error";
  output: string;
}

export interface WorkflowTaskQueue {
  id: string;
  priority: number;
  items: WorkflowTaskQueueItem[];
}

export interface WorkflowTaskQueueItem {
  id: string;
  task: string;
  keywords: string[];
  sourceAgent: string;
}
