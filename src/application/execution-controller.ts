import type {
  ApprovalMode,
  ChatMutationProposal,
  ChatRunReadiness,
  ClarificationQuestion,
  ClarificationRecord,
  ComposerComplexity,
  ComposerNodeType,
  ComposerPlanBudget,
  ComposerPort,
  DeleteStrategy,
  ExecutionControl,
  ExecutionEvent,
  ExecutionGraph,
  ExecutionGraphNode,
  ExecutionStatusUpdateDetail,
  GraphMutationError,
  ExecutionStatus,
  QualityLoopManualDecision,
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
  private graphViewport: { x: number; y: number; zoom: number } = { x: 0, y: 0, zoom: 1 };
  private readonly pending = new Map<string, PendingApproval>();
  private readonly resolvedApprovalTokens = new Set<string>();
  private readonly statusWaiters = new Map<string, Array<(node: ExecutionGraphNode) => void>>();
  private readonly statusWaitAbortHandlers = new Map<string, Set<(reason: string) => void>>();
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
  private pendingClarificationWaiter:
    | {
      questionId: string;
      resolve: (answer: string) => void;
      reject: (error: Error) => void;
    }
    | undefined;
  private clarificationHistory: ClarificationRecord[] = [];
  private readonly qualityLoopDecisions = new Map<string, QualityLoopManualDecision>();
  private abortSnapshot:
    | {
      graph: ExecutionGraph;
      pendingQuestion: ClarificationQuestion;
    }
    | undefined;

  constructor(input: { approvalMode?: ApprovalMode; seedRootPrompt?: string | undefined } = {}) {
    this.approvalMode = input.approvalMode ?? "full";
    if (input.seedRootPrompt) {
      this.seedRootComposer(input.seedRootPrompt);
    }
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
    requestClarification: (input) => this.requestClarification(input),
    getClarificationHistory: () => [...this.clarificationHistory],
    getQualityLoopDecision: (nodeId) => this.qualityLoopDecisions.get(nodeId),
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
        viewport: { ...this.graphViewport },
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

    return new Promise((resolve, reject) => {
      if (this.cancellation.isCancelled()) {
        reject(new Error(this.cancellation.cancelReason() ?? "Session stopped."));
        return;
      }

      const abort = (rejectReason: string) => {
        const bucket = this.statusWaitAbortHandlers.get(nodeId);
        if (bucket) {
          bucket.delete(abort);
          if (bucket.size === 0) {
            this.statusWaitAbortHandlers.delete(nodeId);
          }
        }
        reject(new Error(rejectReason));
      };

      const bucket = this.statusWaitAbortHandlers.get(nodeId) ?? new Set<(reason: string) => void>();
      bucket.add(abort);
      this.statusWaitAbortHandlers.set(nodeId, bucket);

      const waiters = this.statusWaiters.get(nodeId) ?? [];
      waiters.push((node) => {
        if (node.status === status) {
          const b = this.statusWaitAbortHandlers.get(nodeId);
          if (b) {
            b.delete(abort);
            if (b.size === 0) {
              this.statusWaitAbortHandlers.delete(nodeId);
            }
          }
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
    this.invalidateQualityLoopMetadata(node, "node prompt edited; quality loop metadata invalidated");
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
    this.invalidateQualityLoopMetadata(node, "node model override set; quality loop metadata invalidated");
    this.publish({ type: "execution", status: node.status, nodeId, message: "node model override set" });
  }

  planNode(nodeId: string): { plannedNodeIds: string[]; budget: ComposerPlanBudget; exhausted: boolean } {
    const node = this.requireEditableNode(nodeId);
    this.ensureNodePosition(node);
    node.composer = withComposerDefaults(node);
    const budgetRoot = this.findBudgetRoot(node);
    budgetRoot.composer = withComposerDefaults(budgetRoot);
    const budget = budgetRoot.composer.planBudget;
    const usedNodes = this.collectDescendants(budgetRoot.id).length;
    const remainingNodes = Math.max(0, budget.maxNodes - usedNodes);
    const remainingDepth = Math.max(0, budget.maxDepth - node.depth);
    if (remainingDepth <= 0 || remainingNodes <= 0) {
      const exhausted = {
        ...budget,
        usedNodes,
        usedDepth: Math.max(budget.usedDepth, node.depth),
        remainingDepth,
        remainingNodes,
        exhausted: true,
      };
      budgetRoot.composer.planBudget = exhausted;
      node.composer.planBudget = exhausted;
      node.status = "awaiting_approval";
      this.publish({ type: "execution", status: "awaiting_approval", nodeId, message: "plan budget exhausted; approval required to expand" });
      return { plannedNodeIds: [], budget: exhausted, exhausted: true };
    }

    const childSpecs = plannedChildrenFor(node).slice(0, remainingNodes);
    const created: string[] = [];
    const baseX = (node.position?.x ?? node.depth * 430) + 430;
    const baseY = node.position?.y ?? 0;
    for (const spec of childSpecs) {
      const id = `plan-${this.nodes.size + 1}`;
      const child: ExecutionGraphNode = {
        id,
        parentId: node.id,
        kind: "task",
        label: spec.label,
        prompt: spec.prompt,
        originalPrompt: spec.prompt,
        editableFields: ["prompt"],
        depth: node.depth + 1,
        status: "planned",
        position: { x: baseX, y: baseY + created.length * 220 },
        composer: createComposer({
          type: spec.type,
          prompt: spec.prompt,
          complexity: spec.complexity,
          budget: childBudgetFromRoot(budget, node.depth + 1, usedNodes + created.length + 1),
          parentNodeId: node.id,
        }),
      };
      this.registerNode(child);
      created.push(id);
    }

    const nextUsedNodes = usedNodes + created.length;
    const nextBudget = {
      ...budget,
      usedNodes: nextUsedNodes,
      usedDepth: Math.max(budget.usedDepth, node.depth + 1),
      remainingDepth: Math.max(0, budget.maxDepth - node.depth),
      remainingNodes: Math.max(0, budget.maxNodes - nextUsedNodes),
      exhausted: budget.maxDepth - node.depth <= 0 || budget.maxNodes - nextUsedNodes <= 0,
    };
    budgetRoot.composer.planBudget = nextBudget;
    node.composer.planBudget = nextBudget;
    node.composer.pendingPlan = {
      parentNodeId: node.id,
      childNodeIds: created,
      createdAt: new Date().toISOString(),
      summary: `${created.length} pending child node(s) planned. Execution requires explicit approval.`,
    };
    node.composer.recommendedAction = created.some((id) => this.nodes.get(id)?.composer?.complexity === "high") ? "break_down" : "review";
    this.chatReadiness = {
      state: "draft",
      reason: "Pending planned child graph: inspect and approve before running.",
    };
    this.publish({ type: "execution", status: node.status, nodeId, message: `planned ${created.length} pending child node(s)` });
    return { plannedNodeIds: created, budget: nextBudget, exhausted: false };
  }

  extendPlanBudget(nodeId: string, extension: Partial<Pick<ComposerPlanBudget, "maxDepth" | "maxNodes">> = {}): ComposerPlanBudget {
    const node = this.requireEditableNode(nodeId);
    node.composer = withComposerDefaults(node);
    if (!node.composer.planBudget.exhausted) {
      throw new MutationError(
        "budget_not_exhausted",
        "Plan budget can only be extended after expansion is exhausted.",
        [nodeId],
        undefined,
        "Plan or break down until the budget is exhausted, then extend explicitly.",
      );
    }
    const budgetRoot = this.findBudgetRoot(node);
    budgetRoot.composer = withComposerDefaults(budgetRoot);
    const current = budgetRoot.composer.planBudget.exhausted ? budgetRoot.composer.planBudget : node.composer.planBudget;
    const maxDepth = Math.max(current.maxDepth, extension.maxDepth ?? current.maxDepth + 1);
    const maxNodes = Math.max(current.maxNodes, extension.maxNodes ?? current.maxNodes + 4);
    const usedNodes = this.collectDescendants(budgetRoot.id).length;
    const nextBudget = {
      ...current,
      maxDepth,
      maxNodes,
      remainingDepth: Math.max(0, maxDepth - current.usedDepth),
      remainingNodes: Math.max(0, maxNodes - usedNodes),
      usedNodes,
      exhausted: false,
      approvalRequired: true,
    };
    budgetRoot.composer.planBudget = nextBudget;
    node.composer.planBudget = nextBudget;
    this.publish({ type: "execution", status: node.status, nodeId, message: "plan budget extended" });
    return nextBudget;
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
    this.ensureNodePosition(parent);
    const parentDepth = parent.depth;
    if (parentDepth + 1 > 64) {
      throw new MutationError("max_depth_exceeded", "Node depth exceeds configured max depth guardrail.", [input.parentId], `depth=${parentDepth + 1}`, "Attach under a shallower parent.");
    }
    const manualSiblings = [...this.nodes.values()].filter((n) => n.parentId === input.parentId).length;
    const id = `task-manual-${this.nodes.size + 1}`;
    const px = parent.position?.x ?? parent.depth * 430;
    const py = parent.position?.y ?? 0;
    const node: ExecutionGraphNode = {
      id,
      parentId: input.parentId,
      kind: input.kind ?? "task",
      label: preview(normalized, 80),
      prompt: normalized,
      originalPrompt: normalized,
      position: { x: px + 430, y: py + manualSiblings * 220 },
      composer: createComposer({
        type: inferNodeType(normalized),
        prompt: normalized,
        complexity: estimateComplexity(normalized),
        budget: defaultPlanBudget(parentDepth + 1),
        parentNodeId: input.parentId,
      }),
      editableFields: ["prompt"],
      depth: parentDepth + 1,
      status: "ready",
    };
    this.registerNode(node);
    this.reevaluateSubtreeFrom(input.parentId);
    return node;
  }

  connectNode(input: { nodeId: string; parentId: string; sourceHandle?: string; targetHandle?: string }): void {
    const node = this.nodes.get(input.nodeId);
    const parent = this.nodes.get(input.parentId);
    if (!node || !parent) {
      throw new MutationError("unknown_node", "Cannot connect unknown nodes.", [input.nodeId, input.parentId], undefined, "Select valid existing nodes.");
    }
    if (input.nodeId === input.parentId || this.collectDescendants(input.nodeId).includes(input.parentId)) {
      throw new MutationError(
        "cycle_detected",
        "Cannot connect a node to itself or one of its descendants.",
        [input.nodeId, input.parentId],
        undefined,
        "Choose a parent outside the node subtree.",
      );
    }
    for (let i = this.edges.length - 1; i >= 0; i -= 1) {
      if (this.edges[i]?.to === input.nodeId) {
        this.edges.splice(i, 1);
      }
    }
    node.parentId = input.parentId;
    this.updateDepthsFrom(node.id, parent.depth + 1);
    if (node.depth > 64) {
      throw new MutationError("max_depth_exceeded", "Node depth exceeds configured max depth guardrail.", [node.id, parent.id], `depth=${node.depth}`, "Connect under a shallower parent.");
    }
    const existing = this.edges.find((edge) => edge.from === input.parentId && edge.to === input.nodeId);
    if (existing) {
      existing.sourceHandle = input.sourceHandle;
      existing.targetHandle = input.targetHandle;
    } else {
      this.edges.push({
        from: input.parentId,
        to: input.nodeId,
        sourceHandle: input.sourceHandle,
        targetHandle: input.targetHandle,
      });
    }
    this.reevaluateSubtreeFrom(input.parentId);
  }

  updateGraphLayout(positions: Record<string, { x: number; y: number }>): void {
    for (const [id, pos] of Object.entries(positions)) {
      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
        continue;
      }
      const node = this.nodes.get(id);
      if (!node) {
        continue;
      }
      node.position = { x: pos.x, y: pos.y };
    }
    this.publish({ type: "execution", status: "planned", message: "graph layout updated" });
  }

  setGraphViewport(viewport: { x: number; y: number; zoom: number }): void {
    const zoom = Number.isFinite(viewport.zoom) && viewport.zoom > 0 ? viewport.zoom : 1;
    this.graphViewport = {
      x: Number.isFinite(viewport.x) ? viewport.x : 0,
      y: Number.isFinite(viewport.y) ? viewport.y : 0,
      zoom,
    };
    this.publish({ type: "execution", status: "planned", message: "graph viewport updated" });
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
      this.clearStatusWaitsForNode(id, `Node "${id}" was removed from the graph.`);
      this.nodes.delete(id);
      this.pending.delete(id);
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

  requestClarification(input: { nodeId: string; promptText: string }): Promise<string> {
    const question = this.raiseClarificationCheckpoint(input);
    return new Promise((resolve, reject) => {
      this.pendingClarificationWaiter = {
        questionId: question.questionId,
        resolve,
        reject,
      };
    });
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
    if (this.pendingClarificationWaiter?.questionId === pending.questionId) {
      this.pendingClarificationWaiter.resolve(normalizedAnswer);
      this.pendingClarificationWaiter = undefined;
    }
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
        viewport: { ...this.graphViewport },
      },
      pendingQuestion: pending,
    };
    if (this.pendingClarificationWaiter?.questionId === pending.questionId) {
      this.pendingClarificationWaiter.reject(new Error("aborted at clarification checkpoint"));
      this.pendingClarificationWaiter = undefined;
    }
    this.stop("aborted at clarification checkpoint");
  }

  acceptQualityLoop(nodeId: string, reason = "quality loop manually accepted"): void {
    const node = this.requireQualityLoopNode(nodeId);
    const decision: QualityLoopManualDecision = {
      action: "accept",
      reason,
      requestedAt: new Date().toISOString(),
      source: "user",
    };
    this.qualityLoopDecisions.set(nodeId, decision);
    if (node.loop) {
      node.loop.message = reason;
    }
    this.publish({
      type: "execution",
      status: node.status,
      nodeId,
      message: reason,
    });
  }

  stopQualityLoop(nodeId: string, reason = "quality loop manually stopped"): void {
    const node = this.requireQualityLoopNode(nodeId);
    const decision: QualityLoopManualDecision = {
      action: "stop",
      reason,
      requestedAt: new Date().toISOString(),
      source: "user",
    };
    this.qualityLoopDecisions.set(nodeId, decision);
    if (node.loop) {
      node.loop.status = "stopped";
      node.loop.stopReason = "stopped";
      node.loop.message = reason;
    }
    this.publish({
      type: "execution",
      status: node.status,
      nodeId,
      message: reason,
    });
  }

  stop(reason = "stopped by user"): void {
    this.cancellation.cancel(reason);
    const haltReason = this.cancellation.cancelReason() ?? reason;
    this.rejectAllStatusWaits(haltReason);
    if (this.pendingClarification) {
      if (this.pendingClarificationWaiter) {
        this.pendingClarificationWaiter.reject(new Error(reason));
        this.pendingClarificationWaiter = undefined;
      }
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

  private requireQualityLoopNode(nodeId: string): ExecutionGraphNode {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new MutationError("unknown_node", `Unknown node "${nodeId}".`, [nodeId]);
    }
    if (node.kind !== "quality-loop") {
      throw new MutationError("not_quality_loop", `Node "${nodeId}" is not a quality-loop node.`, [nodeId]);
    }
    return node;
  }

  private invalidateQualityLoopMetadata(node: ExecutionGraphNode, message: string): void {
    if (node.kind !== "quality-loop" || !node.loop) {
      return;
    }
    node.loop = undefined;
    this.qualityLoopDecisions.delete(node.id);
    this.publish({
      type: "execution",
      status: node.status,
      nodeId: node.id,
      message,
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
      const merged: ExecutionGraphNode = { ...existing, ...input, composer: input.composer ?? existing.composer };
      this.nodes.set(input.id, merged);
      this.ensureNodePosition(merged);
      return;
    }

    const node: ExecutionGraphNode = {
      ...input,
      prompt: input.prompt ?? input.label,
      originalPrompt: input.originalPrompt ?? input.prompt ?? input.label,
      composer: input.composer ?? createComposer({
        type: inferNodeType(input.prompt ?? input.label),
        prompt: input.prompt ?? input.label,
        complexity: estimateComplexity(input.prompt ?? input.label),
        budget: defaultPlanBudget(input.depth),
        parentNodeId: input.parentId,
      }),
      plannedModel: input.plannedModel ?? "resolved-at-runtime",
      modelOverrideSource: input.modelOverrideSource ?? "none",
      editableFields: input.editableFields ?? ["prompt"],
      approvalMode: input.approvalMode ?? this.approvalMode,
      approvalSource: input.approvalSource ?? "none",
      autoApprovalPaused: this.futureAutoApprovalsPaused,
    };
    this.nodes.set(node.id, node);
    this.ensureNodePosition(node);
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
      return new Promise((resolve, reject) => {
        const poll = () => {
          if (this.cancellation.isCancelled()) {
            reject(new Error(this.cancellation.cancelReason() ?? "Run was cancelled."));
            return;
          }
          if (!this.pendingClarification) {
            void this.waitForNodeApprovalInternal(input).then(resolve, reject);
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

  private seedRootComposer(prompt: string): void {
    const normalized = prompt.trim() || "Describe the workflow you want to build.";
    const node: ExecutionGraphNode = {
      id: "root-composer",
      kind: "task",
      label: preview(normalized, 80),
      prompt: normalized,
      originalPrompt: normalized,
      editableFields: ["prompt"],
      depth: 0,
      status: "planned",
      position: { x: 80, y: 120 },
      composer: createComposer({
        type: inferNodeType(normalized),
        prompt: normalized,
        complexity: estimateComplexity(normalized),
        budget: defaultPlanBudget(0),
      }),
    };
    this.registerNode(node);
  }

  private publish(event: ExecutionEvent): void {
    this.applyArtifactValidationFromEvent(event);
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  private applyArtifactValidationFromEvent(event: ExecutionEvent): void {
    if (!event.nodeId || !event.artifactValidation) {
      return;
    }
    const node = this.nodes.get(event.nodeId);
    if (!node?.composer || node.composer.artifactRefs.length === 0) {
      return;
    }
    const { accepted, policy, reason } = event.artifactValidation;
    const state = accepted ? "validated" : "failed";
    for (const ref of node.composer.artifactRefs) {
      ref.validation = { state, policy, reason };
    }
  }

  private ensureNodePosition(node: ExecutionGraphNode): void {
    if (
      node.position
      && Number.isFinite(node.position.x)
      && Number.isFinite(node.position.y)
    ) {
      return;
    }
    const parent = node.parentId ? this.nodes.get(node.parentId) : undefined;
    const siblings = [...this.nodes.values()]
      .filter((n) => n.parentId === node.parentId)
      .sort((a, b) => a.id.localeCompare(b.id));
    const idx = Math.max(0, siblings.findIndex((n) => n.id === node.id));
    if (parent?.position) {
      node.position = { x: parent.position.x + 430, y: parent.position.y + idx * 220 };
    } else {
      node.position = { x: node.depth * 430, y: idx * 245 };
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

  private findBudgetRoot(node: ExecutionGraphNode): ExecutionGraphNode {
    let current = node;
    while (current.parentId) {
      const parent = this.nodes.get(current.parentId);
      if (!parent) {
        break;
      }
      current = parent;
    }
    return current;
  }

  private updateDepthsFrom(nodeId: string, depth: number): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }
    node.depth = depth;
    for (const child of this.nodes.values()) {
      if (child.parentId === nodeId) {
        this.updateDepthsFrom(child.id, depth + 1);
      }
    }
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
    const parent = this.nodes.get(node.parentId);
    if (!parent) {
      throw new MutationError(
        "unknown_node",
        `Parent "${node.parentId}" is missing for rewiring.`,
        [nodeId, node.parentId],
        undefined,
        "Refresh the graph or choose a different delete strategy.",
      );
    }
    for (const dependentId of dependentIds) {
      const dependent = this.nodes.get(dependentId);
      if (!dependent) {
        continue;
      }
      dependent.parentId = node.parentId;
      this.updateDepthsFrom(dependent.id, parent.depth + 1);
      this.edges.push({ from: node.parentId, to: dependent.id });
    }
    this.clearStatusWaitsForNode(nodeId, `Node "${nodeId}" was removed from the graph.`);
    this.nodes.delete(nodeId);
    this.pending.delete(nodeId);
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

  private clearStatusWaitsForNode(nodeId: string, reason: string): void {
    const bucket = this.statusWaitAbortHandlers.get(nodeId);
    if (bucket) {
      for (const abort of [...bucket]) {
        abort(reason);
      }
    }
    this.statusWaitAbortHandlers.delete(nodeId);
    this.statusWaiters.delete(nodeId);
  }

  private rejectAllStatusWaits(reason: string): void {
    const aborts = [...this.statusWaitAbortHandlers.values()].flatMap((set) => [...set]);
    this.statusWaitAbortHandlers.clear();
    this.statusWaiters.clear();
    for (const abort of aborts) {
      abort(reason);
    }
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

export function createInteractiveExecutionSession(input: { approvalMode?: ApprovalMode; seedRootPrompt?: string | undefined } = {}): InteractiveExecutionSession {
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

function createComposer(input: {
  type: ComposerNodeType;
  prompt: string;
  complexity: ComposerComplexity;
  budget: ComposerPlanBudget;
  parentNodeId?: string | undefined;
}): NonNullable<ExecutionGraphNode["composer"]> {
  const ports = portsForType(input.type);
  return {
    type: input.type,
    runtime: runtimeForType(input.type),
    prompt: input.prompt,
    codeEntry: input.type === "Code" ? "scripts/node.ts" : undefined,
    sandboxPolicy: input.type === "Code" ? "subprocess" : undefined,
    inputs: ports.inputs,
    outputs: ports.outputs,
    artifactRefs: artifactRefsForType(input.type, input.parentNodeId),
    contextPolicy: contextPolicyForType(input.type),
    complexity: input.complexity,
    recommendedAction: input.complexity === "high" ? "break_down" : "plan",
    planBudget: input.budget,
  };
}

function withComposerDefaults(node: ExecutionGraphNode): NonNullable<ExecutionGraphNode["composer"]> {
  return node.composer ?? createComposer({
    type: inferNodeType(node.prompt ?? node.label),
    prompt: node.prompt ?? node.label,
    complexity: estimateComplexity(node.prompt ?? node.label),
    budget: defaultPlanBudget(node.depth),
    parentNodeId: node.parentId,
  });
}

function defaultPlanBudget(depth: number): ComposerPlanBudget {
  return {
    maxDepth: 3,
    maxNodes: 12,
    usedDepth: depth,
    usedNodes: 1,
    remainingDepth: Math.max(0, 3 - depth),
    remainingNodes: 11,
    approvalRequired: true,
    exhausted: false,
  };
}

function childBudgetFromRoot(root: ComposerPlanBudget, depth: number, usedNodes: number): ComposerPlanBudget {
  return {
    maxDepth: root.maxDepth,
    maxNodes: root.maxNodes,
    usedDepth: depth,
    usedNodes,
    remainingDepth: Math.max(0, root.maxDepth - depth),
    remainingNodes: Math.max(0, root.maxNodes - usedNodes),
    approvalRequired: true,
    exhausted: root.maxDepth - depth <= 0 || root.maxNodes - usedNodes <= 0,
  };
}

function inferNodeType(prompt: string): ComposerNodeType {
  const lower = prompt.toLowerCase();
  if (lower.includes("tts") || lower.includes("speech") || lower.includes("audio")) {
    return "TTS";
  }
  if (lower.includes("code") || lower.includes("script") || lower.includes("splice") || lower.includes("parse")) {
    return "Code";
  }
  if (lower.includes("split") || lower.includes("chunk") || lower.includes("segment")) {
    return "Splitter";
  }
  if (lower.includes("join") || lower.includes("merge")) {
    return "Joiner";
  }
  if (lower.includes("valid") || lower.includes("check")) {
    return "Validator";
  }
  return "AI";
}

function estimateComplexity(prompt: string): ComposerComplexity {
  const lower = prompt.toLowerCase();
  const signals = ["book", "workflow", "recursive", "audio", "artifact", "multiple", "pipeline", "graph", "entire"];
  const score = signals.filter((signal) => lower.includes(signal)).length + Math.floor(prompt.length / 180);
  if (score >= 3) {
    return "high";
  }
  if (score >= 1) {
    return "medium";
  }
  return "low";
}

function runtimeForType(type: ComposerNodeType): "model" | "code" | "tts" {
  if (type === "Code" || type === "Splitter" || type === "Joiner") {
    return "code";
  }
  if (type === "TTS") {
    return "tts";
  }
  return "model";
}

function portsForType(type: ComposerNodeType): { inputs: ComposerPort[]; outputs: ComposerPort[] } {
  switch (type) {
    case "Code":
      return {
        inputs: [{ id: "in-artifacts", label: "Artifacts", artifactType: "artifact/ref[]" }],
        outputs: [{ id: "out-artifacts", label: "Artifacts", artifactType: "artifact/ref[]" }],
      };
    case "TTS":
      return {
        inputs: [
          { id: "in-segments", label: "Text segments", artifactType: "text/segment[]" },
          { id: "in-voices", label: "Voice map", artifactType: "voice/profile[]" },
        ],
        outputs: [{ id: "out-audio", label: "Audio clips", artifactType: "audio/ref[]" }],
      };
    case "Splitter":
      return {
        inputs: [{ id: "in-document", label: "Document", artifactType: "document/ref" }],
        outputs: [{ id: "out-segments", label: "Segments", artifactType: "text/segment[]" }],
      };
    case "Joiner":
      return {
        inputs: [{ id: "in-ordered", label: "Ordered refs", artifactType: "artifact/ref[]" }],
        outputs: [{ id: "out-joined", label: "Joined artifact", artifactType: "artifact/ref" }],
      };
    case "Validator":
      return {
        inputs: [{ id: "in-candidate", label: "Candidate", artifactType: "artifact/ref" }],
        outputs: [{ id: "out-validation", label: "Validation", artifactType: "validation/report" }],
      };
    default:
      return {
        inputs: [{ id: "in-context", label: "Context", artifactType: "context/packet" }],
        outputs: [{ id: "out-structured", label: "Structured output", artifactType: "json/artifact" }],
      };
  }
}

function artifactRefsForType(type: ComposerNodeType, parentNodeId?: string): NonNullable<ExecutionGraphNode["composer"]>["artifactRefs"] {
  if (type === "TTS") {
    return [{
      id: "audio-ref-preview",
      uri: ".rlm/runs/<run-id>/artifacts/audio-clip.wav",
      mediaType: "audio/wav",
      durationMs: 0,
      producerNodeId: parentNodeId,
      orderingKey: "chapter:segment",
      metadata: { storage: "disk", payload: "external" },
    }];
  }
  if (type === "Splitter" || type === "Code") {
    return [{
      id: "manifest-ref-preview",
      uri: ".rlm/runs/<run-id>/artifacts/manifest.json",
      mediaType: "application/json",
      producerNodeId: parentNodeId,
      metadata: { storage: "disk", payload: "external" },
    }];
  }
  return [];
}

function contextPolicyForType(type: ComposerNodeType): NonNullable<ExecutionGraphNode["composer"]>["contextPolicy"] {
  if (type === "TTS") {
    return {
      reads: ["current text segment", "speaker bible entry", "voice profile"],
      writes: ["audio artifact refs", "clip timing metadata"],
      limits: ["max TTS duration per clip", "max segments per batch"],
      memoryScopes: ["speaker-bible", "segment-manifest"],
    };
  }
  if (type === "Code" || type === "Splitter" || type === "Joiner") {
    return {
      reads: ["artifact refs", "manifest metadata"],
      writes: ["artifact refs", "status metadata"],
      limits: ["stream files from disk", "do not embed payloads in graph state"],
      memoryScopes: ["run-manifest"],
    };
  }
  return {
    reads: ["current segment", "rolling summary", "relevant memory entries"],
    writes: ["structured annotations", "memory updates"],
    limits: ["bounded context packet", "schema-constrained output"],
    memoryScopes: ["speaker-bible", "chapter-summary"],
  };
}

function plannedChildrenFor(node: ExecutionGraphNode): Array<{
  label: string;
  prompt: string;
  type: ComposerNodeType;
  complexity: ComposerComplexity;
}> {
  const prompt = node.prompt ?? node.label;
  const lower = prompt.toLowerCase();
  if (lower.includes("book") || lower.includes("audio") || lower.includes("speech")) {
    return [
      { label: "Parse book into segments", prompt: "Parse the source book into ordered chapter and segment artifact refs.", type: "Splitter", complexity: "medium" },
      { label: "Interpret speakers", prompt: "Infer speaker attribution and update a persistent speaker bible from bounded text segments.", type: "AI", complexity: "high" },
      { label: "Generate TTS clips", prompt: "Generate consistent per-speaker audio clips from segment refs and voice profiles.", type: "TTS", complexity: "high" },
      { label: "Validate continuity", prompt: "Validate speaker and audio continuity across generated clips.", type: "Validator", complexity: "medium" },
      { label: "Splice final audio", prompt: "Splice ordered audio artifact refs into the final audiobook file.", type: "Code", complexity: "medium" },
    ];
  }
  return [
    { label: "Plan implementation slice", prompt: `Create the smallest safe implementation slice for: ${prompt}`, type: "AI", complexity: "medium" },
    { label: "Execute code changes", prompt: `Apply code or configuration changes for: ${prompt}`, type: "Code", complexity: "medium" },
    { label: "Validate results", prompt: `Validate the completed work for: ${prompt}`, type: "Validator", complexity: "low" },
  ];
}
