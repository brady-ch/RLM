# Research: Pitfalls for v1.4 Session Memory

**Milestone:** v1.4 Session Memory  
**Date:** 2026-05-21

## Pitfall 1: Treating Retrieval as Memory

Vector search is not the source of truth. If the vector index is missing, stale, or corrupt, the session must still reopen with graph, run-state, structured scopes, episodic log, preferences, and artifact refs intact.

**Prevention:** Make structured/session snapshot durability the first phase. Store vector index metadata and degraded status separately.

## Pitfall 2: Silent Empty Restores

An empty or partial restore is worse than a visible failure because the user explicitly does not want anything lost.

**Prevention:** Add restore verification that checks expected graph node count, run id, memory scope count, episodic count, artifact ref count, and schema version. Surface partial restore as degraded/error in CLI and UI.

## Pitfall 3: Unbounded Prompt Injection

Dumping all memory into every node will regress answer quality and cost, and it weakens policy isolation.

**Prevention:** `MemoryResolver` must enforce scope ACLs and packet limits. Context packets need provenance and truncation/degraded metadata.

## Pitfall 4: Preference Drift

Persisted preferences can silently steer future runs after they become stale.

**Prevention:** Store preferences with source, created/updated timestamps, lifetime, and visible application points. Provide edit/delete controls.

## Pitfall 5: Native Vector Dependency Packaging

Native vector DB bindings can break Tauri/package builds across platforms.

**Prevention:** Hide vector storage behind a port, keep tests independent of native packages, and prove package smoke before making a native vector dependency mandatory.

## Pitfall 6: Confusing Save/Reopen with Runtime Resume

Users may expect a saved session to resume a half-finished model call.

**Prevention:** Document and implement snapshot restore semantics clearly: rerun or continue from safe approval/clarification gates, not mid-call continuation.

## Pitfall 7: Artifact Bloat

Embedding or copying full artifacts into memory will grow snapshots rapidly.

**Prevention:** Store refs, summaries, hashes, and selected chunks only. Keep artifact bytes in artifact storage.
