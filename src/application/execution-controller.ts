import type {
  ApprovalMode,
  ChatMutationProposal,
  ChatRunReadiness,
  ClarificationQuestion,
  ClarificationRecord,
  DeleteStrategy,
  ExecutionControl,
  ExecutionEvent,
  ExecutionGraph,
  ExecutionGraphNode,
  ExecutionStatusUpdateDetail,
  GraphMutationError,
  ExecutionStatus,
  NodeApprovalDecision,
} from "../domain/types.js";
import { EXECUTION_FAILURE_CODES, summarizeRunFromNodes } from "../domain/execution-failure.js";
import { createClarificationQuestion, createClarificationRecord } from "./runtime-events.js";

export class CancellationController {
  private cancelled = false;
  private reason: string | undefined;

  cancel(reason = "cancelled"): void {
    this.cancelled = true;
    this.reason = reason;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  cancelReason(): string | undefined {
    return this.reason;
  }
}

type PendingApproval = {
  resolve: (decision: NodeApprovalDecision) => void;
  token: string;
};

type PendingMutation =
  | { kind: "edit"; nodeId: string; prompt: string }
  | { kind: "delete"; nodeId: string; strategy?: DeleteStrategy };

class MutationError extends Error implements GraphMutationError {
  constructor(
    public readonly code: string,
    message: string,
    public readonly nodeIds: string[],
    public readonly details?: string,
    public readonly suggestedFix?: string,
  ) {
    super(message);
    this.name = "MutationError";
  }
}

export class InteractiveExecutionSession {
  private readonly nodes = new Map<string, ExecutionGraphNode>();
  private readonly edges: ExecutionGraph["edges"] = [];
  private readonly pending = new Map<string, PendingApproval>();
  private readonly resolvedApprovalTokens = new Set<string>();
  private readonly statusWaiters = new Map<string, Array<(node: ExecutionGraphNode) => void>>();
  private readonly subscribers = new Set<(event: ExecutionEvent) => void>();
  private readonly cancellation = new CancellationController();
  private approvalMode: ApprovalMode = "full";
  private initialPlanAccepted = false;
  private futureAutoApprovalsPaused = false;
  private approvalVersion = 0;
  private chatReadiness: ChatRunReadiness = {
    state: "draft",
    reason: "Draft graph: confirm graph and run to start execution.",
  };
  private pendingMutation: { id: string; mutation: PendingMutation; proposal: ChatMutationProposal } | undefined;
  private mutationVersion = 0;
  private pendingClarification: ClarificationQuestion | undefined;
  private clarificationHistory: ClarificationRecord[] = [];
  private abortSnapshot:
    | {
      graph: ExecutionGraph;
      pendingQuestion: ClarificationQuestion;
    }
    | undefined;

  constructor(input: { approvalMode?: ApprovalMode } = {}) {
    this.approvalMode = input.approvalMode ?? "full";
  }

  readonly control: ExecutionControl = {
    approvalMode: this.approvalMode,
    isCancelled: () => this.cancellation.isCancelled(),
    cancelReason: () => this.cancellation.cancelReason(),
    onEvent: (event) => this.publish(event),
    registerNode: (node) => this.registerNode(node),
    updateNodeStatus: (nodeId, status, detail) => this.updateNodeStatus(nodeId, status, detail),
    waitForNodeApproval: (node) => this.waitForNodeApprovalInternal(node),
    pauseFutureAutoApprovals: () => this.pauseFutureAutoApprovals(),
    autoApprovalPaused: () => this.autoApprovalPaused(),
  };

  snapshot(): {
    graph: ExecutionGraph;
    status: ExecutionStatus;
    activeNodeId?: string | undefined;
    approvalMode: ApprovalMode;
    autoApprovalPaused: boolean;
    runSummary?: { message?: string };
    chat: {
      readiness: ChatRunReadiness;
      pendingMutation?: ChatMutationProposal | undefined;
      pendingClarification?: ClarificationQuestion | undefined;
      clarificationHistory: ClarificationRecord[];
      abortSnapshot?: {
        graph: ExecutionGraph;
        pendingQuestion: ClarificationQuestion;
      } | undefined;
    };
  } {
    const nodes = [...this.nodes.values()];
    const activeNode = nodes.find((node) => node.status === "awaiting_approval" || node.status === "running");
    const terminal = nodes.length > 0 && nodes.every((node) =>
      node.status === "completed" || node.status === "skipped" || node.status === "failed" || node.status === "cancelled"
    );
    // Cancelled session wins over per-node failed when both apply (user stop after partial failure).
    const status: ExecutionStatus = !terminal
      ? activeNode?.status ?? "planned"
      : this.cancellation.isCancelled()
        ? "cancelled"
        : nodes.some((node) => node.status === "failed")
          ? "failed"
          : "completed";
    let runSummary: { message?: string } | undefined;
    if (terminal && (status === "failed" || status === "cancelled")) {
      const message = status === "cancelled"
        ? (this.cancellation.cancelReason() ?? "Run was cancelled.")
        : summarizeRunFromNodes(nodes).primaryMessage;
      runSummary = message ? { message } : {};
    }
    const snapshotPayload: {
      graph: ExecutionGraph;
      status: ExecutionStatus;
      activeNodeId?: string | undefined;
      approvalMode: ApprovalMode;
      autoApprovalPaused: boolean;
      runSummary?: { message?: string };
      chat: {
        readiness: ChatRunReadiness;
        pendingMutation?: ChatMutationProposal | undefined;
        pendingClarification?: ClarificationQuestion | undefined;
        clarificationHistory: ClarificationRecord[];
        abortSnapshot?: {
          graph: ExecutionGraph;
          pendingQuestion: ClarificationQuestion;
        } | undefined;
      };
    } = {
      graph: {
        nodes,
        edges: [...this.edges],
      },
      status,
      activeNodeId: activeNode?.id,
      approvalMode: this.approvalMode,
      autoApprovalPaused: this.futureAutoApprovalsPaused,
      chat: {
        readiness: this.chatReadiness,
        pendingMutation: this.pendingMutation?.proposal,
        pendingClarification: this.pendingClarification,
        clarificationHistory: [...this.clarificationHistory],
        abortSnapshot: this.abortSnapshot,
      },
    };
    if (runSummary !== undefined) {
      snapshotPayload.runSummary = runSummary;
    }
    return snapshotPayload;
  }

  subscribe(subscriber: (event: ExecutionEvent) => void): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  waitForNodeStatus(nodeId: string, status: ExecutionStatus): Promise<ExecutionGraphNode> {
    const existing = this.nodes.get(nodeId);
    if (existing?.status === status) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve) => {
      const waiters = this.statusWaiters.get(nodeId) ?? [];
      waiters.push((node) => {
        if (node.status === status) {
          resolve(node);
        }
      });
      this.statusWaiters.set(nodeId, waiters);
    });
  }

  editNodePrompt(nodeId: string, prompt: string): void {
    const node = this.requireEditableNode(nodeId);
    const normalized = prompt.trim();
    if (!normalized) {
      throw new Error("Node prompt cannot be empty.");
    }

    node.prompt = normalized;
    node.label = preview(normalized, 80);
    this.publish({ type: "execution", status: node.status, nodeId, message: "node prompt edited" });
  }

  setNodeModelOverride(nodeId: string, model: string): void {
    const node = this.requireEditableNode(nodeId);
    const normalized = model.trim();
    if (!normalized) {
      throw new MutationError("invalid_model", "Model override cannot be empty.", [nodeId], undefined, "Provide a model name.");
    }
    node.modelOverride = normalized;
    node.modelOverrideSource = "user";
    this.publish({ type: "execution", status: node.status, nodeId, message: "node model override set" });
  }

  addNode(input: {
    parentId: string;
    prompt: string;
    kind?: ExecutionGraphNode["kind"];
  }): ExecutionGraphNode {
    const parent = this.nodes.get(input.parentId);
    if (!parent) {
      throw new MutationError("invalid_parent", `Unknown parent node "${input.parentId}".`, [input.parentId], undefined, "Choose an existing parent node.");
    }
    const normalized = input.prompt.trim();
    if (!normalized) {
      throw new MutationError("invalid_prompt", "Node prompt cannot be empty.", [input.parentId], undefined, "Provide a non-empty prompt.");
    }
    const parentDepth = parent.depth;
    if (parentDepth + 1 > 64) {
      throw new MutationError("max_depth_exceeded", "Node depth exceeds configured max depth guardrail.", [input.parentId], `depth=${parentDepth + 1}`, "Attach under a shallower parent.");
    }
    const id = `task-manual-${this.nodes.size + 1}`;
    const node: ExecutionGraphNode = {
      id,
      parentId: input.parentId,
      kind: input.kind ?? "task",
      label: preview(normalized, 80),
      prompt: normalized,
      originalPrompt: normalized,
      editableFields: ["prompt"],
      depth: parentDepth + 1,
      status: "ready",
    };
    this.registerNode(node);
    this.reevaluateSubtreeFrom(input.parentId);
    return node;
  }

  connectNode(input: { nodeId: string; parentId: string }): void {
    const node = this.nodes.get(input.nodeId);
    const parent = this.nodes.get(input.parentId);
    if (!node || !parent) {
      throw new MutationError("unknown_node", "Cannot connect unknown nodes.", [input.nodeId, input.parentId], undefined, "Select valid existing nodes.");
    }
    node.parentId = input.parentId;
    node.depth = parent.depth + 1;
    if (node.depth > 64) {
      throw new MutationError("max_depth_exceeded", "Node depth exceeds configured max depth guardrail.", [node.id, parent.id], `depth=${node.depth}`, "Connect under a shallower parent.");
    }
    if (!this.edges.some((edge) => edge.from === input.parentId && edge.to === input.nodeId)) {
      this.edges.push({ from: input.parentId, to: input.nodeId });
    }
    this.reevaluateSubtreeFrom(input.parentId);
  }

  deleteNode(nodeId: string): { deleted: string[] } {
    return this.deleteNodeWithStrategy(nodeId);
  }

  deleteNodeWithStrategy(nodeId: string, strategy?: DeleteStrategy): { deleted: string[] } {
    if (!this.nodes.has(nodeId)) {
      throw new MutationError("unknown_node", `Unknown node "${nodeId}".`, [nodeId], undefined, "Select an existing node.");
    }
    const dependents = this.directDependents(nodeId);
    if (dependents.length > 0 && !strategy) {
      throw new MutationError(
        "delete_requires_choice",
        "Delete requires explicit choice for dependent nodes.",
        [nodeId, ...dependents.map((node) => node.id)],
        `dependents=${dependents.map((node) => node.id).join(",")}`,
        "Choose delete_subtree or rewire_dependents.",
      );
    }
    if (strategy === "rewire_dependents") {
      return this.rewireAndDeleteNode(nodeId, dependents.map((node) => node.id));
    }
    const deleted = this.collectDescendants(nodeId);
    for (const id of deleted) {
      this.nodes.delete(id);
      this.pending.delete(id);
      this.statusWaiters.delete(id);
    }
    for (let i = this.edges.length - 1; i >= 0; i -= 1) {
      const edge = this.edges[i];
      if (!edge) {
        continue;
      }
      if (deleted.includes(edge.from) || deleted.includes(edge.to)) {
        this.edges.splice(i, 1);
      }
    }
    this.publish({ type: "execution", status: "ready", message: `deleted ${deleted.length} node(s)` });
    return { deleted };
  }

  previewMutationFromChat(message: string): ChatMutationProposal {
    const normalized = message.trim();
    if (!normalized) {
      throw new MutationError("invalid_prompt", "Chat message cannot be empty.", [], undefined, "Describe the graph change.");
    }
    const lower = normalized.toLowerCase();
    if (lower.startsWith("edit ")) {
      const parsed = normalized.match(/^edit\s+(.+?)\s*:\s*(.+)$/i);
      if (!parsed) {
        throw new MutationError("invalid_prompt", "Edit format must be: edit <node> : <new prompt>.", [], undefined, "Use a node label or id.");
      }
      const nodeId = this.resolveNodeTarget(parsed[1] ?? "", "edit");
      const prompt = (parsed[2] ?? "").trim();
      if (!prompt) {
        throw new MutationError("invalid_prompt", "Edited prompt cannot be empty.", [nodeId], undefined, "Provide replacement text.");
      }
      return this.setPendingMutation({ kind: "edit", nodeId, prompt }, `Edit ${nodeId} prompt`);
    }
    if (lower.startsWith("delete ")) {
      const parsed = normalized.match(/^delete\s+(.+)$/i);
      const nodeId = this.resolveNodeTarget(parsed?.[1] ?? "", "delete");
      const dependents = this.directDependents(nodeId);
      if (dependents.length > 0) {
        return this.setPendingMutation(
          { kind: "delete", nodeId },
          `Delete ${nodeId} requires dependency choice`,
          {
            requiresDeleteChoice: true,
            pendingDeleteChoice: { nodeId, options: ["delete_subtree", "rewire_dependents"] },
          },
        );
      }
      return this.setPendingMutation({ kind: "delete", nodeId, strategy: "delete_subtree" }, `Delete subtree for ${nodeId}`);
    }

    throw new MutationError("unsupported_mutation", "Unsupported chat mutation command.", [], undefined, "Use edit <node>:<prompt> or delete <node>.");
  }

  applyPendingMutation(input?: { proposalId?: string; deleteStrategy?: DeleteStrategy }): {
    applied: true;
    summary: string;
    deletedNodeIds?: string[] | undefined;
  } {
    const pending = this.pendingMutation;
    if (!pending) {
      throw new MutationError("missing_pending_mutation", "No pending mutation to apply.", [], undefined, "Preview a mutation in chat first.");
    }
    if (input?.proposalId && input.proposalId !== pending.id) {
      throw new MutationError("stale_mutation", "Pending mutation id does not match.", [], undefined, "Refresh and apply latest preview.");
    }
    let summary = pending.proposal.summary;
    let deletedNodeIds: string[] | undefined;
    if (pending.mutation.kind === "edit") {
      this.editNodePrompt(pending.mutation.nodeId, pending.mutation.prompt);
    } else {
      const strategy = input?.deleteStrategy ?? pending.mutation.strategy;
      const deleted = this.deleteNodeWithStrategy(pending.mutation.nodeId, strategy);
      deletedNodeIds = deleted.deleted;
      summary = `Deleted ${deleted.deleted.length} node(s) using ${strategy ?? "delete_subtree"}`;
    }
    this.pendingMutation = undefined;
    this.chatReadiness = {
      state: "draft",
      reason: "Draft graph: confirm graph and run to start execution.",
    };
    return { applied: true, summary, deletedNodeIds };
  }

  clearPendingMutation(): void {
    this.pendingMutation = undefined;
  }

  confirmGraphAndRun(): ChatRunReadiness {
    const reasons: string[] = [];
    if (this.nodes.size === 0) {
      reasons.push("No graph nodes are available.");
    }
    if (this.pendingMutation) {
      reasons.push("Resolve the pending mutation preview first.");
    }
    if (reasons.length > 0) {
      this.chatReadiness = { state: "draft", reason: `Draft graph: ${reasons.join(" ")}` };
      return this.chatReadiness;
    }
    this.chatReadiness = {
      state: "ready_to_run",
      reason: "Graph confirmed. Run can start.",
    };
    return this.chatReadiness;
  }

  approveNode(nodeId: string, token?: string): { duplicate: boolean } {
    const node = this.nodes.get(nodeId);
    const pending = this.pending.get(nodeId);
    if (!node) {
      throw new Error(`Unknown node "${nodeId}".`);
    }

    if (!pending) {
      if (token && this.resolvedApprovalTokens.has(token)) {
        return { duplicate: true };
      }
      throw new Error(`Node "${nodeId}" is not awaiting approval.`);
    }
    if (token && token !== pending.token) {
      throw new Error(`Stale approval token for node "${nodeId}".`);
    }

    this.pending.delete(nodeId);
    this.resolvedApprovalTokens.add(pending.token);
    node.approvalToken = undefined;
    node.approvalSource = "manual";
    node.approvalReason = "manually approved";
    this.initialPlanAccepted = true;
    this.updateNodeStatus(nodeId, "approved");
    pending.resolve({
      status: "approved",
      prompt: node.prompt ?? node.label,
      modelOverride: node.modelOverride,
      approvalSource: "manual",
      approvalReason: node.approvalReason,
    });
    return { duplicate: false };
  }

  skipNode(nodeId: string, token?: string): { duplicate: boolean } {
    if (this.pendingClarification?.nodeId === nodeId) {
      throw new MutationError(
        "clarification_requires_answer_or_abort",
        "Clarification checkpoints do not allow skip/dismiss; answer and continue or abort.",
        [nodeId],
      );
    }
    const node = this.nodes.get(nodeId);
    const pending = this.pending.get(nodeId);
    if (!node) {
      throw new Error(`Unknown node "${nodeId}".`);
    }

    if (!pending) {
      if (token && this.resolvedApprovalTokens.has(token)) {
        return { duplicate: true };
      }
      throw new Error(`Node "${nodeId}" is not awaiting approval.`);
    }
    if (token && token !== pending.token) {
      throw new Error(`Stale approval token for node "${nodeId}".`);
    }

    this.pending.delete(nodeId);
    this.resolvedApprovalTokens.add(pending.token);
    node.approvalToken = undefined;
    this.updateNodeStatus(nodeId, "skipped");
    pending.resolve({
      status: "skipped",
      prompt: node.prompt ?? node.label,
      modelOverride: node.modelOverride,
    });
    return { duplicate: false };
  }

  raiseClarificationCheckpoint(input: { nodeId: string; promptText: string }): ClarificationQuestion {
    const node = this.nodes.get(input.nodeId);
    if (!node) {
      throw new Error(`Unknown node "${input.nodeId}".`);
    }
    if (this.pendingClarification) {
      throw new MutationError(
        "clarification_already_pending",
        "A clarification question is already pending.",
        [this.pendingClarification.nodeId],
      );
    }
    const question = createClarificationQuestion({
      nodeId: input.nodeId,
      promptText: input.promptText,
    });
    this.pendingClarification = question;
    this.updateNodeStatus(input.nodeId, "awaiting_approval", {
      message: "clarification required",
    });
    this.publish({
      type: "execution",
      status: "awaiting_approval",
      nodeId: input.nodeId,
      message: "clarification required",
      pendingClarification: question,
    });
    return question;
  }

  answerClarificationAndContinue(input: { questionId: string; userAnswer: string }): ClarificationRecord {
    const pending = this.pendingClarification;
    if (!pending || pending.questionId !== input.questionId) {
      throw new MutationError("unknown_question", "Unknown or resolved clarification question.", []);
    }
    const normalizedAnswer = input.userAnswer.trim();
    if (!normalizedAnswer) {
      throw new MutationError("invalid_answer", "Clarification answer cannot be empty.", [pending.nodeId]);
    }
    const resumeEventId = `${pending.nodeId}:resume:${Date.now()}`;
    const record = createClarificationRecord({
      question: pending,
      userAnswer: normalizedAnswer,
      resumeEventId,
    });
    this.clarificationHistory.push(record);
    this.pendingClarification = undefined;
    this.updateNodeStatus(pending.nodeId, "approved", {
      message: "clarification answered; resuming",
    });
    this.publish({
      type: "execution",
      status: "approved",
      nodeId: pending.nodeId,
      message: "clarification answered; resuming",
      clarificationRecord: record,
    });
    return record;
  }

  abortRunFromClarification(input: { questionId: string }): void {
    const pending = this.pendingClarification;
    if (!pending || pending.questionId !== input.questionId) {
      throw new MutationError("unknown_question", "Unknown or resolved clarification question.", []);
    }
    this.abortSnapshot = {
      graph: {
        nodes: [...this.nodes.values()].map((node) => ({ ...node })),
        edges: [...this.edges],
      },
      pendingQuestion: pending,
    };
    this.stop("aborted at clarification checkpoint");
  }

  stop(reason = "stopped by user"): void {
    this.cancellation.cancel(reason);
    if (this.pendingClarification) {
      const blockingNode = this.nodes.get(this.pendingClarification.nodeId);
      if (blockingNode) {
        blockingNode.status = "cancelled";
        blockingNode.approvalToken = undefined;
      }
      this.pendingClarification = undefined;
    }
    for (const [nodeId, pending] of this.pending) {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.status = "cancelled";
        node.approvalToken = undefined;
      }
      pending.resolve({
        status: "cancelled",
        prompt: node?.prompt ?? "",
      });
    }
    this.pending.clear();
    this.publish({
      type: "execution",
      status: "cancelled",
      message: reason,
      failureCategory: "cancelled",
      code: EXECUTION_FAILURE_CODES.cancelled,
    });
  }

  pauseFutureAutoApprovals(): void {
    this.futureAutoApprovalsPaused = true;
    this.publish({
      type: "execution",
      status: "ready",
      message: "future auto-approvals paused",
      approvalMode: this.approvalMode,
    });
  }

  autoApprovalPaused(): boolean {
    return this.futureAutoApprovalsPaused;
  }

  private registerNode(input: ExecutionGraphNode): void {
    const existing = this.nodes.get(input.id);
    if (existing) {
      this.nodes.set(input.id, { ...existing, ...input });
      return;
    }

    const node: ExecutionGraphNode = {
      ...input,
      prompt: input.prompt ?? input.label,
      originalPrompt: input.originalPrompt ?? input.prompt ?? input.label,
      plannedModel: input.plannedModel ?? "resolved-at-runtime",
      modelOverrideSource: input.modelOverrideSource ?? "none",
      editableFields: input.editableFields ?? ["prompt"],
      approvalMode: input.approvalMode ?? this.approvalMode,
      approvalSource: input.approvalSource ?? "none",
      autoApprovalPaused: this.futureAutoApprovalsPaused,
    };
    this.nodes.set(node.id, node);
    if (node.parentId && !this.edges.some((edge) => edge.from === node.parentId && edge.to === node.id)) {
      this.edges.push({ from: node.parentId, to: node.id });
    }
    this.publish({ type: "execution", status: node.status, nodeId: node.id, message: "node registered" });
    this.notifyStatusWaiters(node);
  }

  private updateNodeStatus(nodeId: string, status: ExecutionStatus, detail?: ExecutionStatusUpdateDetail): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }

    node.status = status;
    if (status === "running") {
      node.startedAt = new Date().toISOString();
    }
    if (status === "completed" || status === "skipped" || status === "failed" || status === "cancelled") {
      node.completedAt = new Date().toISOString();
    }
    const event: ExecutionEvent = {
      type: "execution",
      status,
      nodeId,
      message: detail?.message,
      failureCategory: detail?.failureCategory,
      code: detail?.code,
    };
    this.publish(event);
    this.notifyStatusWaiters(node);
  }

  private waitForNodeApprovalInternal(input: ExecutionGraphNode): Promise<NodeApprovalDecision> {
    if (this.pendingClarification && this.pendingClarification.nodeId !== input.id) {
      this.registerNode(input);
      this.updateNodeStatus(input.id, "awaiting_approval", {
        message: "blocked by unresolved clarification checkpoint",
      });
      return new Promise((resolve) => {
        const poll = () => {
          if (!this.pendingClarification) {
            void this.waitForNodeApprovalInternal(input).then(resolve);
            return;
          }
          setTimeout(poll, 25);
        };
        poll();
      });
    }
    this.registerNode(input);
    const node = this.nodes.get(input.id);
    if (!node) {
      throw new Error(`Node "${input.id}" was not registered.`);
    }
    node.autoApprovalPaused = this.futureAutoApprovalsPaused;
    const autoDecision = this.shouldAutoApprove(node);
    if (autoDecision.auto) {
      node.approvalToken = undefined;
      node.approvalSource = "auto";
      node.approvalReason = autoDecision.reason;
      this.updateNodeStatus(input.id, "approved");
      this.publish({
        type: "execution",
        status: "approved",
        nodeId: input.id,
        message: "node auto-approved",
        approvalMode: this.approvalMode,
        approvalSource: "auto",
      });
      return Promise.resolve({
        status: "approved",
        prompt: node.prompt ?? node.label,
        modelOverride: node.modelOverride,
        approvalSource: "auto",
        approvalReason: node.approvalReason,
      });
    }
    const token = `${input.id}:${++this.approvalVersion}`;
    node.approvalToken = token;
    node.approvalReason = autoDecision.reason;
    this.updateNodeStatus(input.id, "awaiting_approval");

    return new Promise((resolve) => {
      this.pending.set(input.id, { resolve, token });
    });
  }

  private shouldAutoApprove(node: ExecutionGraphNode): { auto: boolean; reason: string } {
    if (this.approvalMode === "full" || this.futureAutoApprovalsPaused) {
      return {
        auto: false,
        reason: "full checkpoint approval required",
      };
    }

    if (!this.initialPlanAccepted) {
      return {
        auto: false,
        reason: "initial checkpoint approval required",
      };
    }

    if (this.approvalMode === "initial-plan") {
      if (node.spawnedAfterInitialApproval === true) {
        return {
          auto: false,
          reason: "new recursive branch requires approval",
        };
      }
      return {
        auto: true,
        reason: "initial plan approved",
      };
    }

    return {
      auto: true,
      reason: node.spawnedAfterInitialApproval ? "recursive branch auto-approved" : "initial plan approved",
    };
  }

  toMutationError(error: unknown): GraphMutationError | undefined {
    if (error instanceof MutationError) {
      return {
        code: error.code,
        message: error.message,
        nodeIds: error.nodeIds,
        details: error.details,
        suggestedFix: error.suggestedFix,
      };
    }
    return undefined;
  }

  private requireEditableNode(nodeId: string): ExecutionGraphNode {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Unknown node "${nodeId}".`);
    }
    if (node.status !== "planned" && node.status !== "ready" && node.status !== "awaiting_approval") {
      throw new Error(`Node "${nodeId}" cannot be edited while ${node.status}.`);
    }
    return node;
  }

  private publish(event: ExecutionEvent): void {
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  private collectDescendants(nodeId: string): string[] {
    const result = [nodeId];
    for (let i = 0; i < result.length; i += 1) {
      const current = result[i];
      for (const node of this.nodes.values()) {
        if (node.parentId === current && !result.includes(node.id)) {
          result.push(node.id);
        }
      }
    }
    return result;
  }

  private resolveNodeTarget(target: string, action: string): string {
    const normalized = target.trim().toLowerCase();
    const matches = [...this.nodes.values()].filter((node) =>
      node.id.toLowerCase() === normalized || node.label.toLowerCase().includes(normalized)
    );
    if (matches.length === 0) {
      throw new MutationError("unknown_node", `No node matches "${target}".`, [], undefined, "Use a known node id or label.");
    }
    if (matches.length > 1) {
      throw new MutationError(
        "ambiguous_node_target",
        `Ambiguous ${action} target "${target}".`,
        matches.map((node) => node.id),
        `matches=${matches.map((node) => node.id).join(",")}`,
        "Choose a unique node id.",
      );
    }
    return matches[0]!.id;
  }

  private setPendingMutation(
    mutation: PendingMutation,
    summary: string,
    overrides?: Partial<ChatMutationProposal>,
  ): ChatMutationProposal {
    const id = `mutation-${++this.mutationVersion}`;
    const proposal: ChatMutationProposal = {
      id,
      summary,
      requiresClarification: false,
      requiresDeleteChoice: false,
      ...overrides,
    };
    this.pendingMutation = { id, mutation, proposal };
    return proposal;
  }

  private directDependents(nodeId: string): ExecutionGraphNode[] {
    return [...this.nodes.values()].filter((node) => node.parentId === nodeId);
  }

  private rewireAndDeleteNode(nodeId: string, dependentIds: string[]): { deleted: string[] } {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new MutationError("unknown_node", `Unknown node "${nodeId}".`, [nodeId], undefined, "Select an existing node.");
    }
    if (!node.parentId) {
      throw new MutationError(
        "rewire_requires_parent",
        "Cannot rewire dependents when deleting a root node.",
        [nodeId, ...dependentIds],
        undefined,
        "Use delete_subtree for root deletes.",
      );
    }
    for (const dependentId of dependentIds) {
      const dependent = this.nodes.get(dependentId);
      if (!dependent) {
        continue;
      }
      dependent.parentId = node.parentId;
      dependent.depth = Math.max(0, node.depth);
      this.edges.push({ from: node.parentId, to: dependent.id });
    }
    this.nodes.delete(nodeId);
    this.pending.delete(nodeId);
    this.statusWaiters.delete(nodeId);
    for (let i = this.edges.length - 1; i >= 0; i -= 1) {
      const edge = this.edges[i];
      if (!edge) {
        continue;
      }
      if (edge.to === nodeId || edge.from === nodeId) {
        this.edges.splice(i, 1);
      }
    }
    this.publish({ type: "execution", status: "ready", message: `rewired and deleted ${nodeId}` });
    return { deleted: [nodeId] };
  }

  private reevaluateSubtreeFrom(nodeId: string): void {
    for (const node of this.nodes.values()) {
      if (node.parentId === nodeId) {
        node.status = "ready";
        node.startedAt = undefined;
        node.completedAt = undefined;
      }
    }
    this.publish({ type: "execution", status: "ready", nodeId, message: "subtree scheduled for reevaluation" });
  }

  private notifyStatusWaiters(node: ExecutionGraphNode): void {
    const waiters = this.statusWaiters.get(node.id) ?? [];
    this.statusWaiters.set(
      node.id,
      waiters.filter((waiter) => {
        waiter(node);
        if (node.status === "failed" || node.status === "cancelled") {
          return false;
        }
        return node.status !== "awaiting_approval" && node.status !== "completed" && node.status !== "skipped";
      }),
    );
  }
}

export function createInteractiveExecutionSession(input: { approvalMode?: ApprovalMode } = {}): InteractiveExecutionSession {
  return new InteractiveExecutionSession(input);
}

export function createExecutionControl(input: {
  planOnly?: boolean | undefined;
  cancellation: CancellationController;
  onEvent?: ((event: ExecutionEvent) => void) | undefined;
}): ExecutionControl {
  return {
    planOnly: input.planOnly,
    isCancelled: () => input.cancellation.isCancelled(),
    cancelReason: () => input.cancellation.cancelReason(),
    onEvent: input.onEvent,
  };
}

function preview(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}
