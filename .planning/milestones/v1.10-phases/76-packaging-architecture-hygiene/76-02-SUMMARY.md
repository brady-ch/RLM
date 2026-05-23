---
phase: 76-packaging-architecture-hygiene
plan: 02
subsystem: infra
tags: [rust, boundaries, agents-md, architecture, baseline]

requires:
  - phase: 70-rust-boundary-enforcement
    provides: check-rust-boundaries.sh and baseline mode
provides:
  - Refreshed 71-DECISION with Phase 70 met
  - AGENTS ratchet table for 7 baseline arcs
  - Regression test for baseline script failure propagation
affects: [71-optional-crate-split, check:rust]

tech-stack:
  added: []
  patterns:
    - "Baseline arcs documented with removal conditions in AGENTS.md"

key-files:
  created:
    - scripts/measure-rust-compile-baseline.test.mjs
  modified:
    - AGENTS.md
    - .planning/milestones/v1.9-phases/71-optional-crate-split/71-DECISION.md

key-decisions:
  - "Default CI stays baseline mode; strict mode only when arc count reaches zero"
  - "71-DECISION defer outcome unchanged; only prerequisite language updated"

patterns-established:
  - "Transitional boundary ratchet table mirrors rust-boundary-baseline.json entries"

requirements-completed: [ARCH-07, ARCH-08]

duration: 10min
completed: 2026-05-22
---

# Phase 76 Plan 02: Architecture Docs & Baseline Summary

**71-DECISION reflects Phase 70 complete; AGENTS documents all 7 transitional Rust boundary arcs with ratchet removal conditions.**

## Performance

- **Duration:** 10 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Refreshed 71-DECISION.md: Phase 70 prerequisites met, stale denial removed, defer unchanged
- Added measure-rust-compile-baseline.test.mjs regression guard for run_timed_step exit 1
- Added AGENTS.md ratchet table listing all 7 baseline arcs with removal conditions
- `npm run check:rust:boundaries` passes unchanged in default baseline mode

## Task Commits

1. **Task 1: Refresh 71-DECISION.md** - `b40da11` (docs)
2. **Task 2: Baseline script guard + AGENTS ratchet table** - `7895a46` (feat)

## Files Created/Modified

- `.planning/milestones/v1.9-phases/71-optional-crate-split/71-DECISION.md` - Phase 70 met, optional refresh note
- `scripts/measure-rust-compile-baseline.test.mjs` - bash -n + source pattern assertions
- `AGENTS.md` - transitional boundary baseline ratchet table

## Decisions Made

- Default CI remains baseline mode per D-03; no strict-mode flip this phase

## Deviations from Plan

None - plan executed exactly as written. Baseline script already had correct exit 1 propagation; test documents regression guard only.

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

ARCH-07 and ARCH-08 closed; contributors have explicit ratchet plan for transitional arcs.

---
*Phase: 76-packaging-architecture-hygiene*
*Completed: 2026-05-22*

## Self-Check: PASSED

- FOUND: scripts/measure-rust-compile-baseline.test.mjs
- FOUND: commit b40da11
- FOUND: commit 7895a46
