import type {
  ApprovalMode,
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
    } = {
      graph: {
        nodes,
        edges: [...this.edges],
      },
      status,
      activeNodeId: activeNode?.id,
      approvalMode: this.approvalMode,
      autoApprovalPaused: this.futureAutoApprovalsPaused,
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
    if (!this.nodes.has(nodeId)) {
      throw new MutationError("unknown_node", `Unknown node "${nodeId}".`, [nodeId], undefined, "Select an existing node.");
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

  stop(reason = "stopped by user"): void {
    this.cancellation.cancel(reason);
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
