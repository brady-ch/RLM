---
title: Rust Vector Index
planted_date: 2026-05-22
trigger_condition: "When migrating runtime to Rust or when session memory retrieval latency/degraded states indicate JSON linear scan is insufficient — e.g. thousands of indexed records, slow reopen, or UI-visible search timeouts"
status: active
---

## Intent

Replace the current TypeScript vector path (`FileVectorIndex` JSON store + brute-force cosine in `SemanticMemoryIndex`) with a **Rust-native approximate nearest-neighbor index** embedded in the runtime. This is the highest-ROI performance migration independent of fine-tuning.

## Current baseline

| Component | Today |
|-----------|--------|
| Storage | `.rlm/memory/vector-index.json` — full file read/write |
| Search | Linear scan + in-process cosine similarity |
| Embeddings | Ollama HTTP (`OllamaEmbeddingModel`) |
| Scale | Fine for small session counts; degrades as records grow |

## Target components

| Component | Direction |
|-----------|-----------|
| **Index engine** | HNSW or USEARCH — embedded, no separate server |
| **Persistence** | Incremental updates; session snapshot merge compatible with v1.4 format |
| **Embedding adapter** | Keep Ollama HTTP initially; optional local embed via `fastembed` or candle later |
| **API surface** | Same retrieval semantics: scope-filtered top-k, degraded/empty states visible in UI |
| **Rebuild** | Async background rebuild; must not block node completion |

## Evaluation checks (before building)

- Profile current index size and search latency on representative session (book-scale episodic log)
- Confirm session save/reopen still merges vector metadata losslessly
- Benchmark candidate crates on target hardware (Linux desktop, Apple Silicon)
- Verify degraded path when embedding host unavailable

## Open research

See `.planning/research/questions.md` — **2026-05-22 Rust Vector + Inference Crate Selection**.

## Constraints

- Filter by allowed `memoryScopes` before or after ANN search — ACL must not leak cross-scope hits
- Do not embed full artifact files — chunk + ref only (unchanged from Phase 24/25)
- Index corruption must surface explicit degraded state, not silent empty results

## Depends on

- Rust runtime migration seam (control server + memory ports)
- `.planning/seeds/vector-memory-retrieval.md` (shipped semantic retrieval behavior)
- `.planning/notes/session-memory-architecture.md`

## References

- `src/adapters/persistence/file-vector-index.ts`
- `src/application/memory/semantic-memory-index.ts`
- `.planning/notes/rust-runtime-migration-direction.md`
