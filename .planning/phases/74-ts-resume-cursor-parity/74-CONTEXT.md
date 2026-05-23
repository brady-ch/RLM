# Phase 74: TS Resume Cursor Parity — Context

**Goal:** Node runtime persists resume cursor at transitions with the same shape as Rust.

**Requirements:** PERS-04

**Depends on:** Phase 73 (UI Resume Control) — execution gate; planning may proceed.

## Decisions

### D-01: Mirror Rust persist points

Invoke `RunStatePersistence.persistResumeCursor` at the same transitions as `crates/rlm-core/src/application/graph/executor.rs`: when a node enters `running` (before model call) and after a node completes successfully. Also persist node status via `persistNodeStatus` at status transitions when `input.runState` is present (parity with Rust `persist_run_state_status`).

### D-02: ResumeCursor shape

Use existing TS `ResumeCursor` in `src/domain/run-state-persistence.ts` with fields `activeNodeId`, `completedNodeIds`, `variant`. Set `variant: "playbook"` to match Rust `ResumeCursor` serde shape (`camelCase` JSON at path `resumeCursor`).

### D-03: Resume consumption on GraphExecutorInput

Add `resume?: boolean` to `GraphExecutorInput` (Rust parity). When `resume: true` and `runState` present: load persisted snapshot, apply completed node statuses to session, skip nodes in `completedNodeIds` without invoking model.

### D-04: Targeted tests only

Add focused unit/integration test(s) in `tests/application/graph/` seeding `FileRunStateStore` — partial run → resume → single model call. **Full test suite run deferred** per milestone planning directive; verify with scoped `node --test` only.

## Claude's Discretion

- Whether to add `loadResumeState()` helper on `RunStatePersistence` vs inline snapshot parse — prefer helper mirroring Rust `load_resume_state`.
- Exact test file name (`graph-executor-resume.test.ts` vs extending existing file) — keep resume test isolated if cleaner.

## Deferred Ideas

- Wiring `resume: true` through Rust control-server UI path (Phase 73/64 already handle Rust resume).
- Full `npm test` gate in phase verification — deferred.
- Pipeline variant resume semantics beyond `"playbook"` cursor — out of scope unless session metadata already distinguishes variant.

## Upstream

- Rust reference: `crates/rlm-core/src/application/graph/executor.rs` (`persist_resume_cursor`, `prepare_run_state`, `skip_completed`).
- TS `RunStatePersistence.persistResumeCursor` exists but `graph-executor.ts` never calls it (v1.9 audit tech debt).
- Phase 73 HTTP test seeds same run-state pattern as `crates/rlm-core/tests/run_state_resume.rs`.
