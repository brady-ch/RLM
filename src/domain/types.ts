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
  depth: {
    selected: number;
    source: "model" | "override" | "fallback";
  };
  toolCalls: ToolCallRecord[];
  errors: string[];
}

export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "success" | "error";
  output: string;
}
