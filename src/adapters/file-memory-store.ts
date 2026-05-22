import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type {
  EpisodicMemoryEntry,
  MemoryAuditRecord,
  MemoryPacketMetadata,
  MemoryScopeDocument,
  MemoryScopePatchRequest,
  MemoryScopePatchResult,
  MemoryStorePort,
} from "../ports/memory-store-port.js";

export class FileMemoryStore implements MemoryStorePort {
  private readonly baseDir: string;
  private readonly now: () => string;
  private writeCounter = 0;
  private locks = new Map<string, Promise<void>>();

  constructor(options: { baseDir: string; now?: () => string }) {
    this.baseDir = resolve(options.baseDir);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async readScope(sessionId: string, scopeId: string): Promise<MemoryScopeDocument | undefined> {
    for (const path of this.scopeReadPaths(sessionId, scopeId)) {
      try {
        return JSON.parse(await readFile(path, "utf8")) as MemoryScopeDocument;
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }
        throw error;
      }
    }
    return undefined;
  }

  async listScopes(sessionId: string): Promise<MemoryScopeDocument[]> {
    const documents = new Map<string, MemoryScopeDocument>();
    for (const dir of this.scopeListDirs(sessionId)) {
      for (const document of await this.readScopeDir(dir)) {
        documents.set(`${document.lifetime}:${document.scopeId}`, document);
      }
    }
    return [...documents.values()].sort((a, b) =>
      `${a.lifetime}:${a.scopeId}`.localeCompare(`${b.lifetime}:${b.scopeId}`),
    );
  }

  async patchScope(request: MemoryScopePatchRequest): Promise<MemoryScopePatchResult> {
    return this.withSessionLock(request.sessionId, async () => {
      const denied = this.authorize(request);
      if (denied) {
        return this.auditAndResult(request, false, denied, request.expectedVersion);
      }
      const existing = await this.readScope(request.sessionId, request.scopeId);
      const currentVersion = existing?.version ?? 0;
      if (request.expectedVersion !== currentVersion) {
        return this.auditAndResult(request, false, "etag/version conflict", currentVersion);
      }
      const next: MemoryScopeDocument = {
        sessionId: request.sessionId,
        scopeId: request.scopeId,
        lifetime: request.lifetime ?? existing?.lifetime ?? "session",
        version: currentVersion + 1,
        content: applyPatch(existing?.content ?? {}, request.patch),
        updatedAt: this.now(),
      };
      await this.writeJson(
        this.scopePathForLifetime(request.sessionId, request.scopeId, next.lifetime),
        next,
      );
      await this.appendEpisodicUnlocked({
        id: `episode-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sessionId: request.sessionId,
        type: "scope_write",
        summary: `Scope ${request.scopeId} updated by ${request.actor}.`,
        scopeIds: [request.scopeId],
        timestamp: this.now(),
      });
      return this.auditAndResult(request, true, "accepted", next.version);
    });
  }

  async listAudit(sessionId: string): Promise<MemoryAuditRecord[]> {
    return this.readArray<MemoryAuditRecord>(this.auditPath(sessionId));
  }

  async appendEpisodic(entry: EpisodicMemoryEntry): Promise<void> {
    await this.withSessionLock(entry.sessionId, async () => {
      await this.appendEpisodicUnlocked(entry);
    });
  }

  async listEpisodic(sessionId: string): Promise<EpisodicMemoryEntry[]> {
    return this.readArray<EpisodicMemoryEntry>(this.episodicPath(sessionId));
  }

  async getRollingSummary(
    sessionId: string,
    scopeIds: string[],
    maxChars: number,
  ): Promise<string> {
    const allowed = new Set(scopeIds);
    const entries = await this.readArray<EpisodicMemoryEntry>(this.episodicPath(sessionId));
    const lines = entries
      .filter(
        (entry) =>
          !entry.scopeIds ||
          entry.scopeIds.length === 0 ||
          entry.scopeIds.some((scope) => allowed.has(scope)),
      )
      .slice(-12)
      .map((entry) => `- ${entry.type}${entry.nodeId ? ` ${entry.nodeId}` : ""}: ${entry.summary}`);
    return truncate(lines.join("\n"), maxChars);
  }

  async recordPacketMetadata(metadata: MemoryPacketMetadata): Promise<void> {
    await this.withSessionLock(metadata.sessionId, async () => {
      const packets = await this.readArray<MemoryPacketMetadata>(
        this.packetPath(metadata.sessionId),
      );
      const filtered = packets.filter((packet) => packet.nodeId !== metadata.nodeId);
      filtered.push(metadata);
      await this.writeJson(this.packetPath(metadata.sessionId), filtered.slice(-200));
    });
  }

  async listPacketMetadata(sessionId: string): Promise<MemoryPacketMetadata[]> {
    return this.readArray<MemoryPacketMetadata>(this.packetPath(sessionId));
  }

  async getLastPacketMetadata(
    sessionId: string,
    nodeId: string,
  ): Promise<MemoryPacketMetadata | undefined> {
    const packets = await this.readArray<MemoryPacketMetadata>(this.packetPath(sessionId));
    return packets.findLast((packet) => packet.nodeId === nodeId);
  }

  async restoreSessionData(
    sessionId: string,
    data: {
      scopes: MemoryScopeDocument[];
      episodic: EpisodicMemoryEntry[];
      audit?: MemoryAuditRecord[];
      packets?: MemoryPacketMetadata[];
    },
  ): Promise<void> {
    await this.withSessionLock(sessionId, async () => {
      for (const scope of data.scopes) {
        const normalized: MemoryScopeDocument = {
          ...scope,
          sessionId,
        };
        await this.writeJson(
          this.scopePathForLifetime(sessionId, normalized.scopeId, normalized.lifetime),
          normalized,
        );
      }
      await this.writeJson(this.episodicPath(sessionId), data.episodic.slice(-500));
      if (data.audit) {
        await this.writeJson(this.auditPath(sessionId), data.audit);
      }
      if (data.packets) {
        await this.writeJson(this.packetPath(sessionId), data.packets.slice(-200));
      }
    });
  }

  private authorize(request: MemoryScopePatchRequest): string | undefined {
    if (!request.allowedScopes.includes(request.scopeId)) {
      return "memory scope ACL denied";
    }
    if (request.writes.length === 0) {
      return "memory writes not allowed by context policy";
    }
    return undefined;
  }

  private async auditAndResult(
    request: MemoryScopePatchRequest,
    accepted: boolean,
    reason: string,
    nextVersion: number,
  ): Promise<MemoryScopePatchResult> {
    const records = await this.readArray<MemoryAuditRecord>(this.auditPath(request.sessionId));
    const seq = (records.at(-1)?.seq ?? 0) + 1;
    records.push({
      seq,
      sessionId: request.sessionId,
      scopeId: request.scopeId,
      actor: request.actor,
      accepted,
      reason,
      timestamp: this.now(),
    });
    await this.writeJson(this.auditPath(request.sessionId), records);
    if (!accepted) {
      await this.appendEpisodicUnlocked({
        id: `episode-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sessionId: request.sessionId,
        type: "rejected_write",
        summary: `Rejected write to ${request.scopeId}: ${reason}`,
        scopeIds: [request.scopeId],
        timestamp: this.now(),
      });
    }
    return { accepted, reason, nextVersion, auditSeq: seq };
  }

  private async appendEpisodicUnlocked(entry: EpisodicMemoryEntry): Promise<void> {
    const entries = await this.readArray<EpisodicMemoryEntry>(this.episodicPath(entry.sessionId));
    entries.push(entry);
    await this.writeJson(this.episodicPath(entry.sessionId), entries.slice(-500));
  }

  private async readArray<T>(path: string): Promise<T[]> {
    try {
      return JSON.parse(await readFile(path, "utf8")) as T[];
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private async writeJson(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${process.pid}.${(this.writeCounter += 1)}.tmp`;
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temp, path);
  }

  private scopePathForLifetime(
    sessionId: string,
    scopeId: string,
    lifetime: MemoryScopeDocument["lifetime"],
  ): string {
    if (lifetime === "project") {
      return join(this.baseDir, "project", "scopes", `${safe(scopeId)}.json`);
    }
    if (lifetime === "permanent") {
      return join(this.baseDir, "permanent", "scopes", `${safe(scopeId)}.json`);
    }
    return join(this.sessionDir(sessionId), "scopes", `${safe(scopeId)}.json`);
  }

  private scopeReadPaths(sessionId: string, scopeId: string): string[] {
    return [
      this.scopePathForLifetime(sessionId, scopeId, "session"),
      this.scopePathForLifetime(sessionId, scopeId, "project"),
      this.scopePathForLifetime(sessionId, scopeId, "permanent"),
    ];
  }

  private scopeListDirs(sessionId: string): string[] {
    return [
      join(this.sessionDir(sessionId), "scopes"),
      join(this.baseDir, "project", "scopes"),
      join(this.baseDir, "permanent", "scopes"),
    ];
  }

  private async readScopeDir(dir: string): Promise<MemoryScopeDocument[]> {
    let names: string[];
    try {
      names = await readdir(dir);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
    const documents: MemoryScopeDocument[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) {
        continue;
      }
      documents.push(JSON.parse(await readFile(join(dir, name), "utf8")) as MemoryScopeDocument);
    }
    return documents;
  }

  private episodicPath(sessionId: string): string {
    return join(this.sessionDir(sessionId), "episodic.json");
  }

  private auditPath(sessionId: string): string {
    return join(this.sessionDir(sessionId), "audit.json");
  }

  private packetPath(sessionId: string): string {
    return join(this.sessionDir(sessionId), "packets.json");
  }

  private sessionDir(sessionId: string): string {
    return join(this.baseDir, safe(sessionId));
  }

  private async withSessionLock<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
    const key = safe(sessionId);
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolveLock) => {
      release = resolveLock;
    });
    const next = previous.catch(() => undefined).then(() => current);
    this.locks.set(key, next);
    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
      if (this.locks.get(key) === next) {
        this.locks.delete(key);
      }
    }
  }
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 15)).trimEnd()}\n[truncated]`;
}

function applyPatch(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return next;
}

function safe(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
  if (!normalized || normalized === "." || normalized === "..") {
    throw new Error("Memory identifiers must contain at least one safe character.");
  }
  return normalized;
}
