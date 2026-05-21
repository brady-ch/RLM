# Research Summary: v1.4 Session Memory

**Date:** 2026-05-21  
**Milestone:** v1.4 Session Memory

## Stack Additions

- Add memory/session ports rather than overloading the existing RAM `MemoryManager`.
- Start with file-backed JSON/JSONL session bundles under `.rlm/sessions/`, matching existing atomic write patterns.
- Use Ollama embeddings for the first local embedding adapter because Ollama is already the default local runtime and supports `/api/embed`.
- Keep vector DB behind a port. Evaluate `@lancedb/lancedb` only after package smoke validates its native bindings across target platforms.

## Feature Table Stakes

- Save/reopen session snapshots that include graph, approvals, clarification history, run metadata, artifact refs, run-state replay, memory scopes, episodic log, preferences, and vector metadata.
- Structured memory scopes with lifetimes, versioning, ACL enforcement, and audit records.
- Episodic append-only log and rolling summaries.
- Preference memory with visible source and edit/delete.
- UI and CLI inspection for saved sessions, restored memory, context packets, retrieval hits, and degraded states.
- Semantic retrieval filtered by memory scopes and bounded by context policy.

## Architecture Recommendation

Build in this order:

1. Durable session bundle and restore verification.
2. Structured memory scopes plus episodic log.
3. MemoryResolver and bounded context packet injection.
4. UI/CLI memory inspection and preference controls.
5. Ollama embedding adapter, async indexing, and retrieval hits.

## Watch Out For

- Do not let vector search become the canonical memory store.
- Do not silently restore partial sessions.
- Do not inject unbounded memory into every model call.
- Do not persist preferences invisibly.
- Do not make native vector DB bindings mandatory until packaging is proven.

## Requirement Implications

The roadmap should separate durability from retrieval. The first phases must make loss visible and prevent it; the later phases can add semantic recall once the canonical state survives save/reopen reliably.
