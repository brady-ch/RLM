export type RunStateMutationAction = "set" | "delete";

export interface RunStateNodeStatus {
  nodeId: string;
  status: string;
  updatedAt: string;
}

export interface RunStateSnapshot {
  runId: string;
  version: number;
  metadata: Record<string, unknown>;
  nodeStatuses: RunStateNodeStatus[];
  artifactRefs: Record<string, string>;
  checkpoints: Record<string, unknown>[];
  resumeCursor?: string | undefined;
  mutationLog: RunStateMutationRecord[];
}

export interface RunStateMutationRecord {
  seq: number;
  actor: string;
  path: string;
  action: RunStateMutationAction;
  accepted: boolean;
  reason: string;
  timestamp: string;
}

export interface RunStateMutationRequest {
  actor: string;
  path: string;
  action: RunStateMutationAction;
  expectedVersion: number;
  value?: unknown;
  capabilityToken?: string | undefined;
}

export interface RunStateMutationResult {
  accepted: boolean;
  reason: string;
  nextVersion: number;
  seq: number;
}

export interface RunStateStorePort {
  getSnapshot(runId: string): Promise<RunStateSnapshot | undefined>;
  createRun(runId: string, seed?: Partial<Omit<RunStateSnapshot, "runId" | "version" | "mutationLog">>): Promise<RunStateSnapshot>;
  mutate(runId: string, request: RunStateMutationRequest): Promise<RunStateMutationResult>;
  listMutations(runId: string): Promise<RunStateMutationRecord[]>;
  buildOperationalReplay(runId: string): Promise<Array<Pick<RunStateMutationRecord, "seq" | "path" | "action" | "accepted" | "reason" | "timestamp">>>;
}
