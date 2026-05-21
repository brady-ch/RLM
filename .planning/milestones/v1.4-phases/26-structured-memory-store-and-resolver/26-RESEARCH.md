# Phase 26 Research: Structured Memory Store and Resolver

**Date:** 2026-05-21

## Existing Patterns

- `FileRunStateStore` provides a useful model for optimistic version checks and audit logs.
- Phase 25 `FileSessionStore` provides a useful model for local atomic writes and explicit degraded states.
- Composer context policies already define memory scopes and limits, so Phase 26 should make those policies operational rather than add new graph metadata.

## Recommended Implementation

Implement a small but real memory subsystem:

- `MemoryStorePort`: read/create/patch scopes, append episodic entries, list audit records, get rolling summary, record/read packet metadata.
- `FileMemoryStore`: JSON files under `.rlm/memory/<session-id>/` with per-scope docs and JSONL-like arrays for episodic/audit state.
- `MemoryResolver`: builds context packets from allowed scopes and recent episodic entries, enforcing a conservative character limit.
- Integration: wire optional `memory` runtime context into recursive model execution so task nodes can receive a memory packet and completion summaries can append episodic entries.

## Constraints

- Do not implement semantic retrieval in this phase.
- Do not fail model calls just because memory has a degraded optional packet.
- Do not silently apply unauthorized writes.
- Do not overload `MemoryManager`.

## Verification Focus

- Unit test scope version conflicts and ACL rejection.
- Unit test context packet bounds/provenance/degraded metadata.
- Integration test that a recursive/UI task receives memory packet context and records episodic completion.
