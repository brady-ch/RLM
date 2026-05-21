# Research: Stack Additions for v1.4 Session Memory

**Milestone:** v1.4 Session Memory  
**Date:** 2026-05-21  
**Scope:** New durable session memory, preferences, save/reopen, and semantic retrieval for the existing local-first RLM CLI/UI.

## Existing Stack to Preserve

- TypeScript/Node ESM with strict compiler settings.
- Layered ports/adapters architecture under `src/ports/` and `src/adapters/`.
- Existing file-backed run-state persistence in `FileRunStateStore`.
- React/Vite UI using `@xyflow/react` and local control-server APIs.
- Ollama as the default local model runtime.
- Local-first desktop packaging through Tauri.

## Recommended Additions

### Structured Session Store

Use the existing file-backed approach first:

- Extend the current run-state/session snapshot model with memory-specific documents.
- Store session bundles under `.rlm/sessions/<session-id>/`.
- Keep atomic writes through temp-file + rename, matching `FileRunStateStore`.
- Persist artifact refs and summaries, not full artifact payloads.

SQLite can be introduced later if query needs exceed JSON/JSONL, but the first implementation should keep durability simple and inspectable.

### Memory Ports

Add new boundaries rather than overloading the existing RAM-oriented `MemoryManager`:

- `MemoryStorePort` for structured scopes, episodic entries, snapshot/restore, and preference records.
- `MemoryResolver` in application layer for context packet assembly.
- Optional `EmbeddingPort` for vector retrieval.

### Vector Retrieval

Use Ollama embeddings as the first embedding provider because the desktop product already manages Ollama readiness. Ollama documents `/api/embed`, batch input, recommended embedding models, and L2-normalized vectors suitable for cosine similarity.

For vector storage, prefer a narrow internal adapter contract and start with a minimal local implementation:

- Foundation phase: deterministic lexical fallback or simple in-memory/file index for tests.
- Retrieval phase: evaluate `@lancedb/lancedb` only after packaging impact is tested. Its JS SDK supports Linux, macOS, and Windows native bindings, but native binary packaging increases release risk.
- Avoid `node:sqlite` for now because this repo’s package targets Node runtimes below the latest built-in SQLite feature set; if SQLite is selected later, use a normal dependency and test packaged runtime compatibility.

## What Not to Add

- No cloud vector database.
- No remote preference sync.
- No in-flight model-call resume.
- No full artifact embedding by default.
- No hidden memory auto-injection outside explicit `contextPolicy`.

## References

- Existing note: `.planning/notes/session-memory-architecture.md`
- Existing note: `.planning/notes/hybrid-artifact-state-architecture.md`
- Ollama embeddings docs: https://docs.ollama.com/capabilities/embeddings
- LanceDB JS SDK docs: https://lancedb.github.io/lancedb/js/
