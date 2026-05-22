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

export type QualityLoopPhaseName = "draft" | "critique" | "refine" | "gate" | "best_of_progress";

export type QualityLoopIssue = {
  id: string;
  severity: "info" | "warning" | "error";
  text: string;
  sourcePhase: QualityLoopPhaseName;
};

export type QualityLoopPhaseRecord = {
  phase: QualityLoopPhaseName;
  status: ExecutionStatus | "idle" | "stopped" | "degraded";
  startedAt: string;
  completedAt?: string;
  candidateId?: string;
  summary?: string;
  score?: number;
  model?: string;
  plannedModel?: string;
  modelPurpose?: string;
  modelSelection?: string;
  modelSource?: "configured" | "phase_override" | "node_override";
  parseStatus?: "parsed" | "degraded" | "failed";
  parseError?: string;
  unresolvedIssues?: QualityLoopIssue[];
};

export type QualityLoopIteration = {
  index: number;
  status: ExecutionStatus | "idle" | "stopped" | "degraded";
  startedAt: string;
  completedAt?: string;
  phases: QualityLoopPhaseRecord[];
  unresolvedIssues: QualityLoopIssue[];
  critiqueEvaluation?: { summary: string; resolved: boolean; suggestedImprovements: string[] };
  gateEvaluation?: {
    decision: "pass" | "continue";
    score: number;
    passThreshold: number;
    critiqueResolved: boolean;
    meaningfulImprovement: boolean;
    rationale: string;
    failedConditions: string[];
  };
};

export type QualityLoopMetadata = {
  status: "idle" | "running" | "completed" | "stopped" | "degraded" | "failed" | "cancelled";
  stopReason?: string;
  rubric?: {
    id: string;
    label: string;
    rationale: string;
    confidence: number;
    matchedSignals: string[];
  };
  gate?: {
    decision: "pass" | "continue";
    score: number;
    passThreshold: number;
    rationale: string;
    failedConditions: string[];
  };
  selection?: {
    selectedCandidateId: string;
    rationale: string;
    scoreBasis: string[];
    comparisonNotes: string[];
    fallbackReason?: string;
    invalidCandidateId?: string;
  };
  phaseModels?: Record<
    string,
    {
      phase: QualityLoopPhaseName;
      plannedSelection: string;
      plannedModel: string;
      effectiveModel: string;
      source: string;
    }
  >;
  usage: { iterationsStarted: number; iterationsCompleted: number; modelCallsTotal: number };
  iterations: QualityLoopIteration[];
  candidates: Array<{
    id: string;
    iteration: number;
    phase: QualityLoopPhaseName;
    summary: string;
    isSelected?: boolean;
    selectionRationale?: string;
  }>;
  selectedCandidateId?: string;
  unresolvedIssues: QualityLoopIssue[];
  message?: string;
};

export type ExecutionNode = {
  id: string;
  parentId?: string;
  position?: { x: number; y: number };
  kind: "task" | "workflow-agent" | "workflow-qa" | "quality-loop";
  composer?: {
    type: "AI" | "Code" | "TTS" | "Splitter" | "Joiner" | "Validator";
    runtime: "model" | "code" | "tts";
    prompt?: string;
    codeEntry?: string;
    sandboxPolicy?: string;
    inputs: Array<{
      id: string;
      label: string;
      artifactType: string;
      schema?: string;
      required?: boolean;
    }>;
    outputs: Array<{
      id: string;
      label: string;
      artifactType: string;
      schema?: string;
      required?: boolean;
    }>;
    artifactRefs: Array<{
      id: string;
      uri: string;
      mediaType: string;
      sizeBytes?: number;
      durationMs?: number;
      hash?: string;
      producerNodeId?: string;
      orderingKey?: string;
      metadata?: Record<string, string | number | boolean>;
      validation?: {
        state: "validated" | "skipped" | "failed";
        reason?: string;
        policy?: "strict" | "lenient";
      };
    }>;
    contextPolicy: {
      reads: string[];
      writes: string[];
      limits: string[];
      memoryScopes: string[];
    };
    complexity: "low" | "medium" | "high";
    recommendedAction: "run" | "plan" | "break_down" | "review";
    planBudget: {
      maxDepth: number;
      maxNodes: number;
      usedDepth: number;
      usedNodes: number;
      remainingDepth: number;
      remainingNodes: number;
      approvalRequired: boolean;
      exhausted: boolean;
    };
    pendingPlan?: {
      parentNodeId: string;
      childNodeIds: string[];
      createdAt: string;
      summary: string;
    };
  };
  label: string;
  prompt?: string;
  originalPrompt?: string;
  approvalToken?: string;
  plannedModel?: string;
  effectiveModel?: string;
  modelOverride?: string;
  modelOverrideSource?: "user" | "none";
  expertAgentId?: "default" | "coding" | "qa" | "product_designer" | "research";
  expertAssignmentMode?: "planner" | "custom";
  expertRuntime?: "single-pass" | "rlm";
  expertToolAllowlist?: string[];
  expertPurposeTiers?: Record<string, string>;
  samplingOverride?: SamplingOptions;
  effectiveSampling?: {
    values: SamplingOptions;
    sources: Partial<
      Record<keyof SamplingOptions, "adapter_default" | "global" | "model_profile" | "node">
    >;
    warnings?: string[];
  };
  approvalMode?: "full" | "initial-plan" | "initial-plan-recursive";
  approvalSource?: "manual" | "auto" | "none";
  approvalReason?: string;
  spawnedAfterInitialApproval?: boolean;
  autoApprovalPaused?: boolean;
  depth: number;
  status: ExecutionStatus;
  loop?: QualityLoopMetadata;
};

export type SamplingOptions = {
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  maxTokens?: number;
  seed?: number;
};

export type ExecutionGraph = {
  nodes: ExecutionNode[];
  edges: Array<{ from: string; to: string; sourceHandle?: string; targetHandle?: string }>;
  viewport?: { x: number; y: number; zoom: number };
};

export type SessionSnapshot = {
  graph: ExecutionGraph;
  status: ExecutionStatus;
  activeNodeId?: string;
  approvalMode: "full" | "initial-plan" | "initial-plan-recursive";
  autoApprovalPaused: boolean;
  runSummary?: { message?: string };
  chat?: {
    readiness: {
      state: "draft" | "ready_to_run";
      reason: string;
    };
    pendingMutation?: {
      id: string;
      summary: string;
      requiresClarification: boolean;
      clarificationQuestion?: string;
      requiresDeleteChoice: boolean;
      pendingDeleteChoice?: {
        nodeId: string;
        options: Array<"delete_subtree" | "rewire_dependents">;
      };
    };
    pendingClarification?: {
      questionId: string;
      nodeId: string;
      promptText: string;
      askedAt: string;
    };
    clarificationHistory: Array<{
      question_id: string;
      node_id: string;
      prompt_text: string;
      user_answer: string;
      asked_at: string;
      answered_at: string;
      resume_event_id: string;
    }>;
  };
};

export type ModelLibraryEntry = {
  id: string;
  label: string;
  source: "curated" | "huggingface" | "installed";
  ollamaModel?: string;
  description: string;
  tags: string[];
  estimatedRamMb?: number;
  status: "available" | "installed" | "installing" | "failed" | "unsupported";
  reason?: string;
};

export type ModelInstallJob = {
  id: string;
  model: string;
  status: "queued" | "running" | "ready" | "failed";
  progress: number;
  message: string;
};

export type ModelLibrarySnapshot = {
  curated: ModelLibraryEntry[];
  installed: ModelLibraryEntry[];
  jobs: ModelInstallJob[];
  tiers: Record<string, string>;
};

export type PluginListSource = "builtin" | "local" | "configured";

export type PluginListItem = {
  id: string;
  name: string;
  version: string;
  category: string;
  source: PluginListSource;
  enabled: boolean;
  path: string;
  tools: string[];
  skillLoaders: string[];
  modelHosts: string[];
};

export type PluginDoctorIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  pluginId?: string;
  path?: string;
};

export type PluginDoctorResult = {
  ok: boolean;
  issues: PluginDoctorIssue[];
  fixesApplied?: string[];
};

export type PluginInstallPreview = {
  ok: false;
  needsConfirm: true;
  id: string;
  source: string;
  manifest: {
    id: string;
    version: string;
    category: string;
    name?: string;
  };
};

export type PluginMutationResult = {
  ok: true;
  id: string;
  requiresRestart: true;
};

export type PluginSnapshot = {
  plugins: PluginListItem[];
  doctor?: PluginDoctorResult;
};

export type SavedSessionRestoreStatus = "complete" | "degraded" | "failed";

export type SavedSessionSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: SavedSessionRestoreStatus;
  path: string;
};

export type SavedSessionVerification = {
  status: SavedSessionRestoreStatus;
  unsafeToContinue: boolean;
  missing: string[];
  corrupt: Array<{ section: string; reason: string }>;
  sections: Array<{
    name: string;
    status: SavedSessionRestoreStatus;
    path: string;
    version?: number;
    reason?: string;
  }>;
};

export type SavedSessionRecord = SavedSessionSummary & {
  verification: SavedSessionVerification;
};

export type GraphWorkflowSummary = {
  id: string;
  path: string;
  description?: string;
  updatedAt: string;
  variants: Array<"playbook" | "pipeline">;
};

export type GraphWorkflowSaveVariant = "playbook" | "pipeline" | "both";

export type MemorySnapshot = {
  sessionId: string;
  scopes: Array<{
    scopeId: string;
    lifetime: "session" | "project" | "permanent";
    version: number;
    content: Record<string, unknown>;
    updatedAt: string;
  }>;
  episodic: Array<{
    id: string;
    nodeId?: string;
    type: string;
    summary: string;
    scopeIds?: string[];
    timestamp: string;
  }>;
  packets: Array<{
    nodeId: string;
    scopeIds: string[];
    charsUsed: number;
    charLimit: number;
    truncated: boolean;
    degraded: boolean;
    reasons: string[];
    retrievalHits?: Array<{ scopeId: string; source: string; snippet: string; score: number }>;
    createdAt: string;
  }>;
  audit: Array<{
    seq: number;
    scopeId: string;
    actor: string;
    accepted: boolean;
    reason: string;
    timestamp: string;
  }>;
};
export type FlowNodeData = {
  execution: ExecutionNode;
  activeNodeId?: string | undefined;
  runSummaryMessage?: string | undefined;
  refresh?: () => Promise<void>;
  setErrorMessage?: (message: string | undefined) => void;
  planningNodeId?: string | undefined;
  setPlanningNodeId?: (nodeId: string | undefined) => void;
  planningErrorNodeId?: string | undefined;
  planningErrorMessage?: string | undefined;
  setPlanningError?: (error: { nodeId: string; message: string } | undefined) => void;
  onlyRoot?: boolean | undefined;
};
