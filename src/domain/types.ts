import type { RuntimeLogger } from "../ports/runtime-logger-port.js";

export interface RecursiveModelConfig {
  maxDepth?: number;
  maxDynamicDepth: number;
  maxBranches: number;
  maxPromptCharacters: number;
  maxModelCalls: number;
  maxToolRounds: number;
}

export interface RecursivePromptRequest {
  prompt: string;
  config: RecursiveModelConfig;
  logger?: RuntimeLogger | undefined;
  execution?: ExecutionControl | undefined;
  agent?: {
    id: string;
    source: "auto" | "override";
    systemPrompt: string;
  };
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
    | "error";
  prompt: string;
  output: string;
}

export interface TaskNode {
  id: string;
  parentId?: string;
  prompt: string;
  depth: number;
  modelOverride?: string | undefined;
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
  kind: "task" | "workflow-agent" | "workflow-qa";
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
}

export interface ExecutionGraphEdge {
  from: string;
  to: string;
}

export interface ExecutionGraph {
  nodes: ExecutionGraphNode[];
  edges: ExecutionGraphEdge[];
}

export interface ExecutionEvent {
  type: "execution";
  status: ExecutionStatus;
  nodeId?: string | undefined;
  modelCallsUsed?: number | undefined;
  modelCallsRemaining?: number | undefined;
  toolCallsUsed?: number | undefined;
  message?: string | undefined;
}

export interface ExecutionControl {
  planOnly?: boolean | undefined;
  isCancelled: () => boolean;
  cancelReason?: () => string | undefined;
  onEvent?: ((event: ExecutionEvent) => void) | undefined;
  registerNode?: ((node: ExecutionGraphNode) => void) | undefined;
  updateNodeStatus?: ((nodeId: string, status: ExecutionStatus) => void) | undefined;
  waitForNodeApproval?: ((node: ExecutionGraphNode) => Promise<NodeApprovalDecision>) | undefined;
}

export interface NodeApprovalDecision {
  status: "approved" | "skipped" | "cancelled";
  prompt: string;
  modelOverride?: string | undefined;
}

export interface GraphMutationError {
  code: string;
  message: string;
  nodeIds: string[];
  details?: string | undefined;
  suggestedFix?: string | undefined;
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
  source?: "configured" | "rotation" | undefined;
  evaluatorModel?: string | undefined;
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
