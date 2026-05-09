import type {
  ExecutionControl,
  ExecutionEvent,
  ExecutionGraph,
  ExecutionGraphNode,
  ExecutionStatus,
  NodeApprovalDecision,
} from "../domain/types.js";

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
};

export class InteractiveExecutionSession {
  private readonly nodes = new Map<string, ExecutionGraphNode>();
  private readonly edges: ExecutionGraph["edges"] = [];
  private readonly pending = new Map<string, PendingApproval>();
  private readonly statusWaiters = new Map<string, Array<(node: ExecutionGraphNode) => void>>();
  private readonly subscribers = new Set<(event: ExecutionEvent) => void>();
  private readonly cancellation = new CancellationController();

  readonly control: ExecutionControl = {
    isCancelled: () => this.cancellation.isCancelled(),
    cancelReason: () => this.cancellation.cancelReason(),
    onEvent: (event) => this.publish(event),
    registerNode: (node) => this.registerNode(node),
    updateNodeStatus: (nodeId, status) => this.updateNodeStatus(nodeId, status),
    waitForNodeApproval: (node) => this.waitForNodeApprovalInternal(node),
  };

  snapshot(): { graph: ExecutionGraph; status: ExecutionStatus; activeNodeId?: string | undefined } {
    const nodes = [...this.nodes.values()];
    const activeNode = nodes.find((node) => node.status === "awaiting_approval" || node.status === "running");
    const terminal = nodes.length > 0 && nodes.every((node) =>
      node.status === "completed" || node.status === "skipped" || node.status === "failed" || node.status === "cancelled"
    );
    return {
      graph: {
        nodes,
        edges: [...this.edges],
      },
      status: this.cancellation.isCancelled() ? "cancelled" : terminal ? "completed" : activeNode?.status ?? "planned",
      activeNodeId: activeNode?.id,
    };
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

  approveNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    const pending = this.pending.get(nodeId);
    if (!node || !pending) {
      throw new Error(`Node "${nodeId}" is not awaiting approval.`);
    }

    this.pending.delete(nodeId);
    this.updateNodeStatus(nodeId, "approved");
    pending.resolve({
      status: "approved",
      prompt: node.prompt ?? node.label,
    });
  }

  skipNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    const pending = this.pending.get(nodeId);
    if (!node || !pending) {
      throw new Error(`Node "${nodeId}" is not awaiting approval.`);
    }

    this.pending.delete(nodeId);
    this.updateNodeStatus(nodeId, "skipped");
    pending.resolve({
      status: "skipped",
      prompt: node.prompt ?? node.label,
    });
  }

  stop(reason = "stopped by user"): void {
    this.cancellation.cancel(reason);
    for (const [nodeId, pending] of this.pending) {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.status = "cancelled";
      }
      pending.resolve({
        status: "cancelled",
        prompt: node?.prompt ?? "",
      });
    }
    this.pending.clear();
    this.publish({ type: "execution", status: "cancelled", message: reason });
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
      editableFields: input.editableFields ?? ["prompt"],
    };
    this.nodes.set(node.id, node);
    if (node.parentId && !this.edges.some((edge) => edge.from === node.parentId && edge.to === node.id)) {
      this.edges.push({ from: node.parentId, to: node.id });
    }
    this.publish({ type: "execution", status: node.status, nodeId: node.id, message: "node registered" });
    this.notifyStatusWaiters(node);
  }

  private updateNodeStatus(nodeId: string, status: ExecutionStatus): void {
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
    this.publish({ type: "execution", status, nodeId });
    this.notifyStatusWaiters(node);
  }

  private waitForNodeApprovalInternal(input: ExecutionGraphNode): Promise<NodeApprovalDecision> {
    this.registerNode(input);
    const node = this.nodes.get(input.id);
    if (!node) {
      throw new Error(`Node "${input.id}" was not registered.`);
    }
    this.updateNodeStatus(input.id, "awaiting_approval");

    return new Promise((resolve) => {
      this.pending.set(input.id, { resolve });
    });
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

  private notifyStatusWaiters(node: ExecutionGraphNode): void {
    const waiters = this.statusWaiters.get(node.id) ?? [];
    this.statusWaiters.set(
      node.id,
      waiters.filter((waiter) => {
        waiter(node);
        return node.status !== "awaiting_approval" && node.status !== "completed" && node.status !== "skipped";
      }),
    );
  }
}

export function createInteractiveExecutionSession(): InteractiveExecutionSession {
  return new InteractiveExecutionSession();
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
