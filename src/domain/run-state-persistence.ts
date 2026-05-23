import type { ExecutionEvent, ExecutionStatus, RuntimeRunState } from "./types.js";
import type { RunStateSnapshot } from "../ports/run-state-store-port.js";

export interface ResumeCursor {
  activeNodeId: string;
  completedNodeIds: string[];
  variant: string;
}

export interface LoadedResumeState {
  completedNodeIds: string[];
  activeNodeId?: string | undefined;
  variant?: string | undefined;
}

export function parseLoadedResumeState(snapshot: RunStateSnapshot): LoadedResumeState {
  const completed = new Set<string>();
  for (const entry of snapshot.nodeStatuses) {
    if (entry.status === "completed") {
      completed.add(entry.nodeId);
    }
  }
  const cursor = snapshot.resumeCursor;
  if (cursor) {
    const cursorCompleted = Array.isArray(cursor.completedNodeIds)
      ? cursor.completedNodeIds
      : [];
    for (const nodeId of cursorCompleted) {
      if (typeof nodeId === "string") {
        completed.add(nodeId);
      }
    }
    return {
      completedNodeIds: [...completed],
      activeNodeId: cursor.activeNodeId,
      variant: cursor.variant,
    };
  }
  return {
    completedNodeIds: [...completed],
  };
}

export class RunStatePersistence {
  private readonly runState: RuntimeRunState;
  private readonly emit: (event: ExecutionEvent) => void;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(runState: RuntimeRunState, emit: (event: ExecutionEvent) => void) {
    this.runState = runState;
    this.emit = emit;
  }

  async initialize(prompt: string, agentId: string): Promise<void> {
    await this.runState.store.createRun(this.runState.runId, {
      metadata: {
        prompt,
        agent: agentId,
      },
    });
    await this.runState.store.registerCapabilityToken?.(
      this.runState.runId,
      this.runState.actor,
      this.runState.capabilityToken,
    );
  }

  async persistNodeStatus(nodeId: string, status: string): Promise<void> {
    const write = this.writeQueue
      .catch(() => undefined)
      .then(() => this.persistNodeStatusNow(nodeId, status));
    this.writeQueue = write;
    await write;
  }

  async persistResumeCursor(cursor: ResumeCursor): Promise<void> {
    const write = this.writeQueue
      .catch(() => undefined)
      .then(() => this.persistResumeCursorNow(cursor));
    this.writeQueue = write;
    await write;
  }

  async loadResumeState(): Promise<LoadedResumeState | undefined> {
    const snapshot = await this.runState.store.getSnapshot(this.runState.runId);
    if (!snapshot) {
      return undefined;
    }
    return parseLoadedResumeState(snapshot);
  }

  private async persistResumeCursorNow(cursor: ResumeCursor): Promise<void> {
    let result: Awaited<ReturnType<RuntimeRunState["store"]["mutate"]>> | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const snapshot = await this.runState.store.getSnapshot(this.runState.runId);
      if (!snapshot) {
        return;
      }
      result = await this.runState.store.mutate(this.runState.runId, {
        actor: this.runState.actor,
        capabilityToken: this.runState.capabilityToken,
        expectedVersion: snapshot.version,
        action: "set",
        path: "resumeCursor",
        value: cursor,
      });
      if (result.accepted || !result.reason.includes("etag/version conflict")) {
        break;
      }
    }
    if (!result) {
      return;
    }
    this.emit({
      type: "execution",
      status: "running",
      message: result.accepted
        ? "run-state resume cursor persisted"
        : `run-state resume cursor rejected: ${result.reason}`,
    });
  }

  private async persistNodeStatusNow(nodeId: string, status: string): Promise<void> {
    let result: Awaited<ReturnType<RuntimeRunState["store"]["mutate"]>> | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const snapshot = await this.runState.store.getSnapshot(this.runState.runId);
      if (!snapshot) {
        return;
      }
      const updatedAt = new Date().toISOString();
      result = await this.runState.store.mutate(this.runState.runId, {
        actor: this.runState.actor,
        capabilityToken: this.runState.capabilityToken,
        expectedVersion: snapshot.version,
        action: "set",
        path: `nodeStatuses.${nodeId}`,
        value: {
          nodeId,
          status,
          updatedAt,
        },
      });
      if (result.accepted || !result.reason.includes("etag/version conflict")) {
        break;
      }
    }
    if (!result) {
      return;
    }
    this.emit({
      type: "execution",
      status: toExecutionStatus(status),
      nodeId,
      artifactValidation: {
        accepted: result.accepted,
        policy: "strict",
        reason: result.reason,
      },
      message: result.accepted
        ? "run-state node status persisted"
        : `run-state node status rejected: ${result.reason}`,
    });
  }
}

function toExecutionStatus(status: string): ExecutionStatus {
  return status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "skipped"
    ? status
    : "running";
}
