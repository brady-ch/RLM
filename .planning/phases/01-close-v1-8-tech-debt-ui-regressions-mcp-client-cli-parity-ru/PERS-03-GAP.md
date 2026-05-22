# PERS-03 — Run-state resume gap documentation

## Phase 1 deliverables (Rust)

- `RunStatePersistence.persist_resume_cursor` writes `resumeCursor` with CAS retry and capability token (mirrors `persist_node_status`).
- `GraphExecutor` updates `resumeCursor` when the active node changes and after each node completes (`activeNodeId`, `completedNodeIds`, `variant: playbook`).
- `nodeStatuses` persistence behavior is unchanged.

## Shared limitation (TS + Rust)

TypeScript `src/domain/run-state-persistence.ts` persists **only** `nodeStatuses` today — it does not write `resumeCursor` or append `checkpoints`. Phase 1 extends Rust forward; it does not claim TS cursor parity.

## Not delivered in Phase 1

- Cross-session resume/reload consumer (no loader reapplies `resumeCursor` after process restart).
- Full checkpoint replay or orchestrator-level continuity across sessions.
- Pipeline vs playbook variant detection in the executor (Rust uses `playbook` until session exposes run variant).

## Store schema fields without readers

`FileRunStateStore` ACL allows `checkpoints` and `resumeCursor`. `checkpoints` remains write-only infrastructure; no graph executor hook appends checkpoint records yet.

## Recommended follow-on

1. Add resume loader in graph execution entry that reads `resumeCursor` + `nodeStatuses` before walking the graph.
2. Align TS `RunStatePersistence` to write the same cursor shape for dual-runtime parity.
3. Wire UI/control-server “resume run” to validated cursor replay with explicit user confirmation.
