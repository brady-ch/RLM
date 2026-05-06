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
