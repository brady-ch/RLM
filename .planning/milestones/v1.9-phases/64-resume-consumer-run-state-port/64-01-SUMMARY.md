---
phase: 64-resume-consumer-run-state-port
plan: 01
subsystem: persistence
tags: [run-state, resume-cursor, ports, graph-executor, control-server]

requires:
  - phase: 63-quality-loop-parity
    provides: stable graph executor and quality loop metadata
provides:
  - RunStateStorePort trait decoupling domain from FileRunStateStore
  - Resume loader skipping completed nodes on graph entry
  - POST /api/chat/resume-run with confirm gate
  - TS persistResumeCursor matching Rust ResumeCursor shape
  - Integration test for cross-session resume
affects: [65-skill-interop, ui-resume-button]

tech-stack:
  added: []
  patterns:
    - "Domain RunStatePersistence depends on RunStateStorePort not concrete store"
    - "GraphExecutorInput.resume flag drives cursor replay on entry"

key-files:
  created:
    - crates/rlm-core/src/ports/run_state_store.rs
    - crates/rlm-core/tests/run_state_resume.rs
    - .planning/phases/64-resume-consumer-run-state-port/64-CONTEXT.md
  modified:
    - crates/rlm-core/src/domain/run_state_persistence.rs
    - crates/rlm-core/src/graph/executor.rs
    - crates/rlm-core/src/control_server/routes.rs
    - src/domain/run-state-persistence.ts
    - src/ports/run-state-store-port.ts

key-decisions:
  - "RunState snapshot/mutation types live in ports/; persistence re-exports for adapter callers"
  - "Resume requires explicit confirm:true on control-server; executor resume flag skips re-initialize"

patterns-established:
  - "RunStateStorePort: domain persistence uses Arc<dyn RunStateStorePort>"
  - "LoadedResumeState merges nodeStatuses completed entries with resumeCursor.completedNodeIds"

requirements-completed: [PERS-01, PERS-02, PERS-03, ARCH-01, REG-02]

duration: 45min
completed: 2026-05-22
---

# Phase 64 Plan 01: Resume Consumer + Run-State Port Summary

**Cross-session graph resume via RunStateStorePort, cursor replay skipping completed nodes, and dual-runtime cursor write parity.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 8/8
- **Files modified:** 11

## Accomplishments

- `RunStateStorePort` trait fixes ARCH-01 domain→persistence boundary violation
- Graph executor loads `resumeCursor` + `nodeStatuses` and skips completed nodes when `resume: true`
- Control-server `POST /api/chat/resume-run` requires `confirm: true`
- TS `RunStatePersistence.persistResumeCursor` writes `{ activeNodeId, completedNodeIds, variant }`
- Integration test proves single model call on resume after partial run

## Task Commits

1. **Task 1: Context + plan** - `e290221` (docs)
2. **Task 2: RunStateStorePort** - `96a37f9` (feat)
3. **Task 3: Resume loader** - `e5cfaf1` (feat)
4. **Task 4: Control-server endpoint** - `eee1a8a` (feat)
5. **Task 5: TS cursor parity** - `a673737` (feat)
6. **Task 6: Integration test** - `c826d39` (test)

## Deviations from Plan

None — plan executed as written.

## Known Stubs

| File | Line | Reason |
|------|------|--------|
| `src/application/graph/graph-executor.ts` | — | TS graph executor does not yet call `persistResumeCursor` at transitions; method exists on domain persistence for write-shape parity only |

## Threat Flags

None — resume endpoint reuses existing capability-token run state ACL; no new trust boundaries.

## Self-Check: PASSED

- FOUND: crates/rlm-core/src/ports/run_state_store.rs
- FOUND: crates/rlm-core/tests/run_state_resume.rs
- FOUND: e290221, 96a37f9, e5cfaf1, eee1a8a, a673737, c826d39

## Blockers for Phase 65

None.
