import type { ComposerContextPolicy } from "../domain/types.js";
import type {
  EpisodicMemoryEntry,
  MemoryAuditRecord,
  MemoryPacketMetadata,
  MemoryScopeDocument,
  MemoryScopeLifetime,
  MemoryStorePort,
} from "../ports/memory-store-port.js";
import type { SemanticMemoryIndex } from "./semantic-memory-index.js";

export interface MemoryContextPacket {
  text: string;
  metadata: MemoryPacketMetadata;
}

export interface MemoryInspectionSnapshot {
  sessionId: string;
  scopes: MemoryScopeDocument[];
  episodic: EpisodicMemoryEntry[];
  packets: MemoryPacketMetadata[];
  audit: MemoryAuditRecord[];
}

export class MemoryResolver {
  constructor(
    private readonly store: MemoryStorePort,
    private readonly input: { sessionId: string; now?: () => string },
    private readonly retrieval?: SemanticMemoryIndex,
  ) {}

  async buildPacket(input: {
    nodeId: string;
    prompt: string;
    policy: ComposerContextPolicy;
  }): Promise<MemoryContextPacket | undefined> {
    const scopeIds = input.policy.memoryScopes;
    if (scopeIds.length === 0) {
      return undefined;
    }
    const charLimit = resolveCharLimit(input.policy.limits);
    const provenance: MemoryPacketMetadata["provenance"] = [];
    const reasons: string[] = [];
    const chunks: string[] = [];
    let degraded = false;

    for (const scopeId of scopeIds) {
      try {
        const scope = await this.store.readScope(this.input.sessionId, scopeId);
        if (!scope) {
          reasons.push(`scope missing: ${scopeId}`);
          degraded = true;
          continue;
        }
        provenance.push({ kind: "scope", id: scopeId, version: scope.version });
        chunks.push(`Scope ${scopeId} v${scope.version}:\n${JSON.stringify(scope.content)}`);
      } catch (error: unknown) {
        degraded = true;
        reasons.push(`scope ${scopeId} read failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const summary = await this.store.getRollingSummary(this.input.sessionId, scopeIds, Math.floor(charLimit / 2));
    if (summary) {
      provenance.push({ kind: "episodic", id: "rolling-summary" });
      chunks.push(`Rolling summary:\n${summary}`);
    }

    let retrievalHits: MemoryPacketMetadata["retrievalHits"] | undefined;
    if (input.policy.reads.some((read) => /relevant memory/i.test(read))) {
      const result = await this.retrieval?.search({ query: input.prompt, scopeIds, limit: 4 });
      if (result?.status === "ready" && result.hits.length > 0) {
        retrievalHits = result.hits;
        provenance.push(...result.hits.map((hit) => ({ kind: "retrieval" as const, id: hit.id })));
        chunks.push(`Retrieval hits:\n${result.hits.map((hit) => `- ${hit.source}:${hit.scopeId} score=${hit.score.toFixed(3)} ${hit.snippet}`).join("\n")}`);
      } else if (result?.status === "degraded") {
        degraded = true;
        reasons.push(`retrieval degraded: ${result.reason ?? "unknown reason"}`);
      }
    }

    const raw = chunks.join("\n\n");
    const text = truncate(raw, charLimit);
    const metadata: MemoryPacketMetadata = {
      sessionId: this.input.sessionId,
      nodeId: input.nodeId,
      scopeIds,
      charLimit,
      charsUsed: text.length,
      truncated: raw.length > text.length,
      degraded,
      reasons,
      provenance,
      retrievalHits,
      createdAt: this.input.now?.() ?? new Date().toISOString(),
    };
    await this.store.recordPacketMetadata(metadata);
    if (!text && reasons.length === 0) {
      return undefined;
    }
    return { text: text ? `<memory_context>\n${text}\n</memory_context>` : "", metadata };
  }

  async appendNodeSummary(input: { nodeId: string; summary: string; scopeIds: string[]; artifactRefs?: string[] }): Promise<void> {
    const entry: EpisodicMemoryEntry = {
      id: `episode-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sessionId: this.input.sessionId,
      nodeId: input.nodeId,
      type: "summary",
      summary: truncate(input.summary, 600),
      artifactRefs: input.artifactRefs,
      scopeIds: input.scopeIds,
      timestamp: this.input.now?.() ?? new Date().toISOString(),
    };
    await this.store.appendEpisodic(entry);
  }

  async inspect(): Promise<MemoryInspectionSnapshot> {
    return {
      sessionId: this.input.sessionId,
      scopes: await this.store.listScopes(this.input.sessionId),
      episodic: await this.store.listEpisodic(this.input.sessionId),
      packets: await this.store.listPacketMetadata(this.input.sessionId),
      audit: await this.store.listAudit(this.input.sessionId),
    };
  }

  async setPreference(input: { key: string; value: string; source?: string; lifetime?: MemoryScopeLifetime; expectedVersion?: number }): Promise<void> {
    const key = input.key.trim();
    const value = input.value.trim();
    if (!key || !value) {
      throw new Error("Preference key and value are required.");
    }
    const existing = await this.store.readScope(this.input.sessionId, "project-preferences");
    await this.store.patchScope({
      sessionId: this.input.sessionId,
      scopeId: "project-preferences",
      actor: "user",
      expectedVersion: input.expectedVersion ?? existing?.version ?? 0,
      allowedScopes: ["project-preferences"],
      writes: ["preferences"],
      lifetime: input.lifetime ?? "project",
      patch: {
        [key]: {
          value,
          source: input.source ?? "user",
          updatedAt: this.input.now?.() ?? new Date().toISOString(),
        },
      },
    });
  }

  async deletePreference(input: { key: string; expectedVersion?: number }): Promise<void> {
    const key = input.key.trim();
    if (!key) {
      throw new Error("Preference key is required.");
    }
    const existing = await this.store.readScope(this.input.sessionId, "project-preferences");
    await this.store.patchScope({
      sessionId: this.input.sessionId,
      scopeId: "project-preferences",
      actor: "user",
      expectedVersion: input.expectedVersion ?? existing?.version ?? 0,
      allowedScopes: ["project-preferences"],
      writes: ["preferences"],
      lifetime: existing?.lifetime ?? "project",
      patch: {
        [key]: null,
      },
    });
  }
}

function resolveCharLimit(limits: string[]): number {
  for (const limit of limits) {
    const match = limit.match(/(\d{3,6})\s*(?:chars|characters)/i);
    if (match?.[1]) {
      return Math.max(256, Number(match[1]));
    }
  }
  return 2_000;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 15)).trimEnd()}\n[truncated]`;
}
