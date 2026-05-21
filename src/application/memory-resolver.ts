import type { ComposerContextPolicy } from "../domain/types.js";
import type { EpisodicMemoryEntry, MemoryPacketMetadata, MemoryStorePort } from "../ports/memory-store-port.js";

export interface MemoryContextPacket {
  text: string;
  metadata: MemoryPacketMetadata;
}

export class MemoryResolver {
  constructor(
    private readonly store: MemoryStorePort,
    private readonly input: { sessionId: string; now?: () => string },
  ) {}

  async buildPacket(input: {
    nodeId: string;
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
