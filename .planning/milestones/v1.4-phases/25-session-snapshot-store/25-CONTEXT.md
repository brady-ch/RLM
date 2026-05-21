# Phase 25: Session Snapshot Store - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 25 creates the durable saved-session foundation for v1.4. It must let users save, list, reopen, inspect, and verify interactive workflow sessions while preserving the contract for graph state, run-state, artifacts, structured memory, preferences, and vector retrieval metadata. Phase 25 does not need to implement the full memory resolver or full vector retrieval behavior, but it must reserve, serialize, and verify those sections so they cannot be dropped from the product path.

</domain>

<decisions>
## Implementation Decisions

### Snapshot Contract
- The canonical saved-session unit is a directory bundle under `.rlm/sessions/<session-id>/` with a manifest plus separate section files for graph/session state, run-state references or replay, artifact references, memory metadata, preference metadata, and vector retrieval/index metadata.
- Reopen semantics are document-snapshot semantics: a reopened session can be reviewed, edited, rerun, or continued only from safe approval/clarification boundaries. Phase 25 must not claim to resume in-flight model calls.
- Restore verification must be strict and explicit. Restores report `complete`, `degraded`, or `failed`, with concrete missing/corrupt/unsupported fields.
- Phase 25 reserves and verifies structured memory and vector retrieval fields in the snapshot contract. Phase 26 implements structured memory behavior; Phase 28 implements `VectorIndexPort` and concrete retrieval. The vector storage choice remains behind an adapter; start with a durable local/simple adapter unless LanceDB or sqlite-vec passes packaging smoke.

### CLI and UI Entry Points
- The CLI should expose explicit session operations for listing, saving, opening/restoring, and inspecting sessions. These should be scriptable and should not hide state in an internal-only autosave path.
- The UI should expose save/reopen controls plus restore status and session metadata in Phase 25. A full memory browser is deferred to Phase 27, but Phase 25 must show enough to prove the save/reopen loop.
- Autosave should occur on meaningful graph/run-state changes, while manual save remains available. The goal is to minimize loss without removing user agency.
- Partial restores must show degraded restore details with missing sections and must block unsafe continuation actions.

### Data Safety and Scope Boundaries
- Use a directory bundle with manifest JSON and separate section files so partial verification, future memory files, and index metadata can be validated independently.
- Every snapshot section must be schema-versioned. Unsupported versions should fail or degrade explicitly instead of silently migrating or overwriting.
- Artifact payloads should not be inlined. Store refs, hashes, sizes, and metadata so snapshots do not bloat.
- Corrupt files should be preserved. Report exact failure details and write any repair output separately rather than overwriting evidence in place.

</decisions>

<code_context>
## Existing Code Insights

- `src/ports/run-state-store-port.ts` already defines run snapshots, run-state mutation logs, artifact refs, checkpoints, resume cursors, versioning, and operational replay.
- `src/adapters/file-run-state-store.ts` already uses a local file-backed persistence model with per-run locks and atomic temp-file then rename writes. Phase 25 should reuse this durability pattern.
- `src/application/execution-controller.ts` owns the interactive session graph snapshot, approvals, clarification history, graph layout, viewport, cancellation state, and chat readiness.
- `src/application/control-server.ts` exposes `/api/session`, `/api/graph`, SSE events, graph mutation endpoints, and run controls. Phase 25 should add session persistence APIs here rather than inventing another UI server.
- `ui/src/main.tsx` mirrors the session snapshot type and already renders graph/run state, so save/reopen UI should extend the existing product surface.
- `src/domain/run-state-persistence.ts` already persists node status changes through `RunStateStorePort`; saved session bundles need to include or reference this existing run-state data.
- Existing research for v1.4 is in `.planning/research/`, especially `SUMMARY.md`, `ARCHITECTURE.md`, and `PITFALLS.md`.

</code_context>

<specifics>
## Specific Ideas

- Prefer a new `SessionStorePort` or small application-layer service over overloading `MemoryManager`, because `MemoryManager` currently means RAM reservation.
- Snapshot manifest should include section versions, created/updated timestamps, source run/session ids, expected section checksums or hashes, and restore verification expectations.
- CLI output should make degraded restore states impossible to miss.
- UI should expose saved-session actions with familiar controls and should not make memory state look complete if only the Phase 25 contract exists.
- Include vector metadata fields such as provider/config name, index version, indexed entry ids or index manifest refs, `rebuildNeeded`, and degraded reasons like `not_indexed`, `stale`, `provider_unavailable`, or `corrupt`.

</specifics>

<deferred>
## Deferred Ideas

- Full structured memory scope read/write behavior belongs in Phase 26.
- Full preference edit/delete workflow belongs in Phase 27.
- Concrete vector storage/retrieval implementation belongs in Phase 28 behind `VectorIndexPort`.
- True mid-model-call resume remains out of scope for v1.4 unless explicitly replanned later.

</deferred>
