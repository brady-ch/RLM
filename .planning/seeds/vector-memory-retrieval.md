---
title: Vector Memory Retrieval
planted_date: 2026-05-20
trigger_condition: "When Phase 24 session memory store and MemoryResolver are shipped, stable, and covered by tests — and nodes with 'relevant memory entries' in contextPolicy need semantic retrieval beyond structured scopes and episodic summaries"
status: archived
archived_date: 2026-05-24
shipped_in: "v1.4 session memory block (Phases 25–28)"
---

## Intent

Phase 24 delivers **structured scopes + episodic log + save/reopen** with a resolver that packs bounded context packets. This seed captures **Phase 25 vector search**: local embedding index, async indexing, and lazy top-k retrieval filtered by `memoryScopes`.

## What to build

| Component | Detail |
|-----------|--------|
| **Embedding adapter** | Small local model tier or Ollama embeddings API; `EmbeddingPort` if needed |
| **Vector store** | Local sqlite-vec, LanceDB, or hnswlib — desktop-friendly, no cloud required |
| **Indexer** | Async job after episodic append + structured writes with text content |
| **Retriever** | Query = prompt + parent context; filter = allowed scopes; budget = `contextPolicy.limits` |
| **UI** | Inspector shows last retrieval hits (snippet, scope, score); optional manual pin into index |

## Evaluation checks (before building)

- Phase 24 resolver and ACL tests pass; no open bugs on save/reopen or scope versioning.
- Structured + episodic path insufficient for at least one real workflow (e.g. long book run, cross-node “find similar prior segment”).
- Embedding latency and index size acceptable on target hardware (document RAM/disk bounds).

## Constraints

- Retrieval only when `contextPolicy.reads` includes `relevant memory entries` (or equivalent flag).
- Do not embed full artifact files — chunk + ref only.
- Vector index must serialize inside session snapshot (Phase 24 format extended, not replaced).
- Failed embedding/index must not fail node completion; surface degraded state in trace.

## Depends on

- Phase 24: `.planning/notes/session-memory-architecture.md`
- `ComposerContextPolicy.memoryScopes` enforcement in `MemoryResolver`

## References

- `.planning/notes/hybrid-artifact-state-architecture.md`
- `src/application/execution-controller.ts` (`contextPolicyForType`)
- `src/domain/recursive-language-model.ts` (completion injection point)
