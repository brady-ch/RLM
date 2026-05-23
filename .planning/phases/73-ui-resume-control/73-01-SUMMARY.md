---
phase: 73-ui-resume-control
plan: 01
subsystem: api
tags: [rust, axum, sse, run-state, typescript]

requires:
  - phase: 64-resume-run
    provides: POST /api/chat/resume-run and RunStatePersistence
provides:
  - session_snapshot_json runState enrichment on REST and SSE
  - SessionSnapshot.runState TypeScript typing
affects: [73-03-ui-resume-control]

tech-stack:
  added: []
  patterns: [JSON-layer snapshot enrichment without Rust SessionSnapshot struct change]

key-files:
  created: []
  modified:
    - crates/rlm-core/src/control_server/handlers/common.rs
    - crates/rlm-core/src/control_server/handlers/session.rs
    - crates/rlm-core/src/control_server/handlers/events.rs
    - ui/src/shared/types.ts
    - tests/fixtures/control-server/session-idle.json

key-decisions:
  - "Resumable predicate mirrors chat_resume_run: not running + persisted resumeCursor"
  - "runState enrichment stays at JSON layer like snapshot_with_extra"

requirements-completed: [RESU-01]

duration: 25min
completed: 2026-05-22
---

# Phase 73 Plan 01: Session runState.resumable Summary

**Server-computed `runState.resumable` on GET /api/session and SSE initial snapshot for UI resume visibility**

## Performance

- **Duration:** 25 min
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added `session_snapshot_json` helper with running-session guard and resumeCursor check
- Wired `/api/session` and SSE `snapshot` event to enriched payload
- Extended `SessionSnapshot` TS type with optional `runState`

## Task Commits

1. **Plan commit** - `88cf7b4` (feat)

## Files Created/Modified

- `crates/rlm-core/src/control_server/handlers/common.rs` - `session_snapshot_json` helper
- `crates/rlm-core/src/control_server/handlers/session.rs` - REST handler uses enrichment
- `crates/rlm-core/src/control_server/handlers/events.rs` - SSE initial snapshot uses enrichment
- `ui/src/shared/types.ts` - `runState` typing
- `tests/fixtures/control-server/session-idle.json` - idle fixture includes `runState.resumable: false`

## Decisions Made

- Resumable when not actively executing and persisted snapshot has `resumeCursor`
- IO errors loading run state treated as not resumable (session endpoint never fails)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated idle session golden fixture**
- **Found during:** Task 2 verification
- **Issue:** `control_server_matches_golden_fixtures` failed after runState added
- **Fix:** Added `runState: { resumable: false }` to `session-idle.json`
- **Files modified:** `tests/fixtures/control-server/session-idle.json`
- **Committed in:** `88cf7b4`

## Issues Encountered

None beyond fixture update above.

## Self-Check: PASSED

- Files exist: common.rs, session.rs, events.rs, types.ts, session-idle.json
- Commit `88cf7b4` found in git log

---
*Phase: 73-ui-resume-control*
*Completed: 2026-05-22*
