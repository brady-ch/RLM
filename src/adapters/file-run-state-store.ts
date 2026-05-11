import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type {
  RunStateMutationRecord,
  RunStateMutationRequest,
  RunStateMutationResult,
  RunStateSnapshot,
  RunStateStorePort,
} from "../ports/run-state-store-port.js";

interface FileRunStateStoreOptions {
  baseDir: string;
  now?: () => string;
}

interface PersistedRunState extends RunStateSnapshot {
  aclPrefixes: string[];
  capabilityTokens: Record<string, string[]>;
}

export class FileRunStateStore implements RunStateStorePort {
  private readonly baseDir: string;
  private readonly now: () => string;

  constructor(options: FileRunStateStoreOptions) {
    this.baseDir = resolve(options.baseDir);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async getSnapshot(runId: string): Promise<RunStateSnapshot | undefined> {
    const state = await this.read(runId);
    if (!state) {
      return undefined;
    }
    return this.publicSnapshot(state);
  }

  async createRun(runId: string, seed: Partial<Omit<RunStateSnapshot, "runId" | "version" | "mutationLog">> = {}): Promise<RunStateSnapshot> {
    const existing = await this.read(runId);
    if (existing) {
      return this.publicSnapshot(existing);
    }
    const state: PersistedRunState = {
      runId,
      version: 1,
      metadata: seed.metadata ?? {},
      nodeStatuses: seed.nodeStatuses ?? [],
      artifactRefs: seed.artifactRefs ?? {},
      checkpoints: seed.checkpoints ?? [],
      resumeCursor: seed.resumeCursor,
      mutationLog: [],
      aclPrefixes: ["metadata", "nodeStatuses", "artifactRefs", "checkpoints", "resumeCursor"],
      capabilityTokens: {},
    };
    await this.write(runId, state);
    return this.publicSnapshot(state);
  }

  async mutate(runId: string, request: RunStateMutationRequest): Promise<RunStateMutationResult> {
    const state = await this.read(runId);
    if (!state) {
      throw new Error(`Unknown run state: ${runId}`);
    }

    const deniedReason = this.authorize(state, request);
    if (deniedReason) {
      return this.recordAndReturn(state, runId, request, false, deniedReason);
    }
    if (request.expectedVersion !== state.version) {
      return this.recordAndReturn(state, runId, request, false, "etag/version conflict");
    }

    applyPathMutation(state, request.path, request.action, request.value);
    state.version += 1;
    return this.recordAndReturn(state, runId, request, true, "accepted");
  }

  async listMutations(runId: string): Promise<RunStateMutationRecord[]> {
    const state = await this.read(runId);
    return state?.mutationLog ?? [];
  }

  async buildOperationalReplay(runId: string): Promise<Array<Pick<RunStateMutationRecord, "seq" | "path" | "action" | "accepted" | "reason" | "timestamp">>> {
    const state = await this.read(runId);
    return (state?.mutationLog ?? []).map((entry) => ({
      seq: entry.seq,
      path: entry.path,
      action: entry.action,
      accepted: entry.accepted,
      reason: entry.reason,
      timestamp: entry.timestamp,
    }));
  }

  private authorize(state: PersistedRunState, request: RunStateMutationRequest): string | undefined {
    const allowedPrefix = state.aclPrefixes.some((prefix) => request.path === prefix || request.path.startsWith(`${prefix}.`));
    if (!allowedPrefix) {
      return "path ACL denied";
    }
    if (!request.capabilityToken) {
      return "missing capability token";
    }
    const allowed = state.capabilityTokens[request.actor] ?? [];
    if (!allowed.includes(request.capabilityToken)) {
      return "capability token denied";
    }
    return undefined;
  }

  async registerCapabilityToken(runId: string, actor: string, token: string): Promise<void> {
    const state = await this.read(runId);
    if (!state) {
      throw new Error(`Unknown run state: ${runId}`);
    }
    const tokens = new Set(state.capabilityTokens[actor] ?? []);
    tokens.add(token);
    state.capabilityTokens[actor] = [...tokens];
    await this.write(runId, state);
  }

  private async recordAndReturn(
    state: PersistedRunState,
    runId: string,
    request: RunStateMutationRequest,
    accepted: boolean,
    reason: string,
  ): Promise<RunStateMutationResult> {
    const seq = (state.mutationLog.at(-1)?.seq ?? 0) + 1;
    state.mutationLog.push({
      seq,
      actor: request.actor,
      path: request.path,
      action: request.action,
      accepted,
      reason,
      timestamp: this.now(),
    });
    await this.write(runId, state);
    return {
      accepted,
      reason,
      nextVersion: state.version,
      seq,
    };
  }

  private async read(runId: string): Promise<PersistedRunState | undefined> {
    try {
      const raw = await readFile(this.filePath(runId), "utf8");
      return JSON.parse(raw) as PersistedRunState;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  private async write(runId: string, state: PersistedRunState): Promise<void> {
    const filePath = this.filePath(runId);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private filePath(runId: string): string {
    return join(this.baseDir, `${runId}.json`);
  }

  private publicSnapshot(state: PersistedRunState): RunStateSnapshot {
    return {
      runId: state.runId,
      version: state.version,
      metadata: state.metadata,
      nodeStatuses: state.nodeStatuses,
      artifactRefs: state.artifactRefs,
      checkpoints: state.checkpoints,
      resumeCursor: state.resumeCursor,
      mutationLog: state.mutationLog,
    };
  }
}

function applyPathMutation(state: PersistedRunState, path: string, action: "set" | "delete", value: unknown): void {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) {
    throw new Error("Mutation path cannot be empty.");
  }

  const [root, ...tail] = parts;
  if (!root) {
    throw new Error("Mutation path root is required.");
  }
  const target = (state as unknown as Record<string, unknown>)[root];
  if (tail.length === 0) {
    if (action === "delete") {
      delete (state as unknown as Record<string, unknown>)[root];
      return;
    }
    (state as unknown as Record<string, unknown>)[root] = value;
    return;
  }

  if (!target || typeof target !== "object") {
    throw new Error(`Cannot mutate non-object path root: ${root}`);
  }

  let cursor = target as Record<string, unknown>;
  for (let index = 0; index < tail.length - 1; index += 1) {
    const key = tail[index];
    if (!key) {
      throw new Error("Invalid mutation path segment.");
    }
    const next = cursor[key];
    if (!next || typeof next !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  const leaf = tail.at(-1);
  if (!leaf) {
    throw new Error("Invalid mutation path leaf.");
  }
  if (action === "delete") {
    delete cursor[leaf];
  } else {
    cursor[leaf] = value;
  }
}
