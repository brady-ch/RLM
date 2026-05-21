import type { EmbeddingPort } from "../ports/embedding-port.js";
import type { MemoryStorePort } from "../ports/memory-store-port.js";
import { FileVectorIndex, type VectorIndexRecord } from "../adapters/file-vector-index.js";

export interface RetrievalHit {
  id: string;
  source: "scope" | "episodic" | "artifact";
  scopeId: string;
  snippet: string;
  score: number;
}

export interface RetrievalResult {
  hits: RetrievalHit[];
  status: "ready" | "empty" | "degraded";
  reason?: string | undefined;
}

export class SemanticMemoryIndex {
  private rebuildPending = false;

  constructor(
    private readonly input: {
      sessionId: string;
      store: MemoryStorePort;
      embeddings: EmbeddingPort;
      index: FileVectorIndex;
      now?: () => string;
    },
  ) {}

  enqueueRebuild(): void {
    if (this.rebuildPending) {
      return;
    }
    this.rebuildPending = true;
    void this.rebuild()
      .catch(() => undefined)
      .finally(() => {
        this.rebuildPending = false;
      });
  }

  async search(input: { query: string; scopeIds: string[]; limit?: number }): Promise<RetrievalResult> {
    try {
      const records = await this.input.index.read();
      if (records.length === 0) {
        return { hits: [], status: "empty", reason: "index empty; rebuild scheduled asynchronously" };
      }
      const allowed = new Set(input.scopeIds);
      const eligible = records.filter((record) => allowed.has(record.scopeId));
      if (eligible.length === 0) {
        return { hits: [], status: "empty" };
      }
      const queryEmbedding = await this.input.embeddings.embed(input.query);
      const hits = eligible
        .map((record) => ({
          id: record.id,
          source: record.source,
          scopeId: record.scopeId,
          snippet: truncate(record.text, 220),
          score: cosine(queryEmbedding, record.embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit ?? 4);
      return { hits, status: "ready" };
    } catch (error: unknown) {
      return {
        hits: [],
        status: "degraded",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async rebuild(): Promise<VectorIndexRecord[]> {
    const records: VectorIndexRecord[] = [];
    const now = this.input.now?.() ?? new Date().toISOString();
    for (const scope of await this.input.store.listScopes(this.input.sessionId)) {
      const text = `Scope ${scope.scopeId}: ${JSON.stringify(scope.content)}`;
      if (text.length > 20) {
        records.push({
          id: `scope:${scope.lifetime}:${scope.scopeId}`,
          sessionId: this.input.sessionId,
          scopeId: scope.scopeId,
          source: "scope",
          text,
          embedding: await this.input.embeddings.embed(text),
          updatedAt: now,
        });
      }
    }
    for (const entry of await this.input.store.listEpisodic(this.input.sessionId)) {
      const scopeId = entry.scopeIds?.[0];
      if (!scopeId || entry.summary.trim().length === 0) {
        continue;
      }
      records.push({
        id: `episodic:${entry.id}`,
        sessionId: this.input.sessionId,
        scopeId,
        source: "episodic",
        text: entry.summary,
        embedding: await this.input.embeddings.embed(entry.summary),
        updatedAt: now,
      });
    }
    await this.input.index.mergeSessionRecords(this.input.sessionId, records);
    return records;
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    dot += (a[index] ?? 0) * (b[index] ?? 0);
    aMag += (a[index] ?? 0) ** 2;
    bMag += (b[index] ?? 0) ** 2;
  }
  if (aMag === 0 || bMag === 0) {
    return 0;
  }
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 15).trimEnd()}\n[truncated]`;
}
