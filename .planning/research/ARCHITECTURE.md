# Research: Architecture for v1.4 Session Memory

**Milestone:** v1.4 Session Memory  
**Date:** 2026-05-21

## Existing Integration Points

- `src/ports/run-state-store-port.ts` already defines run snapshots, mutation logs, artifact refs, checkpoints, versioning, and operational replay.
- `src/adapters/file-run-state-store.ts` already implements atomic JSON writes, per-run locks, ACL prefix checks, capability tokens, and optimistic version checks.
- `src/application/execution-controller.ts` owns interactive graph state, pending approvals, clarification history, graph layout, viewport, and `contextPolicyForType`.
- `src/application/control-server.ts` exposes `/api/session`, `/api/graph`, event streams, node mutation APIs, model library APIs, and run controls.
- `ui/src/main.tsx` already mirrors session snapshot types and renders graph/control state.
- `src/domain/run-state-persistence.ts` persists node status mutations during execution.

## Proposed Shape

### Phase A: Durable Session Bundle

Add `SessionStorePort` or extend run-state through a higher-level session service:

- save current `InteractiveExecutionSession.snapshot()`
- save run-state snapshot and mutation replay
- save memory store snapshot
- save artifact refs and restore manifest
- list saved sessions
- reopen into a new `InteractiveExecutionSession`

Keep this distinct from true process resume. The restored session is editable and can rerun or continue at explicit approval/clarification boundaries only.

### Phase B: Memory Store and Resolver

Add:

- `src/ports/memory-store-port.ts`
- `src/adapters/file-memory-store.ts`
- `src/application/memory-resolver.ts`

The resolver should:

1. Read node `contextPolicy.reads`, `writes`, `limits`, and `memoryScopes`.
2. Load authorized structured scopes.
3. Load rolling episodic summary.
4. Optionally request retrieval hits only when `reads` includes relevant memory entries.
5. Return bounded context packets with provenance.
6. Emit degraded events instead of silently dropping memory.

Wire before model completions in `runRecursivePrompt` / `RecursiveLanguageModel` and UI execution runner.

### Phase C: Preference Memory

Preferences should be first-class documents with source and lifetime:

- project preference scope
- optional user preference scope
- explicit apply path into planning/execution behavior
- UI/CLI edit/delete

Do not smuggle preferences into prompts without exposing source.

### Phase D: Vector Retrieval

Add:

- `EmbeddingPort`
- `OllamaEmbeddingAdapter`
- `VectorIndexPort`
- retrieval provenance in context packets
- async index job queue after episodic append/structured writes

Retrieval must filter by authorized memory scopes and fit packet limits.

## Build Order Recommendation

1. Session snapshot/save/reopen service with restore verification.
2. Structured memory scopes and episodic append-only log.
3. MemoryResolver and bounded packet injection.
4. UI/CLI inspection and preference editing.
5. Embedding adapter and vector retrieval with degraded-state handling.

This order matches the user priority: nothing gets lost before retrieval becomes clever.
