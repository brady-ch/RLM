---
phase: 97-persistence-config-facade
plan: 02
subsystem: infra
tags: [rust, boundary, baseline, persistence, config]

requires:
  - phase: 97-01
    provides: persistence/config implementation and public exports
provides:
  - Deleted application/config module
  - Ratcheted rust-boundary-baseline.json (no-persistence-to-application removed)
affects: [98-persistence-util-test-extraction]

tech-stack:
  added: []
  patterns:
    - "Config access exclusively via crate::persistence::{load_project_config, LoadedProjectConfig}"

key-files:
  created: []
  modified:
    - crates/rlm-core/src/application/mod.rs
    - scripts/rust-boundary-baseline.json
    - AGENTS.md

key-decisions:
  - "Removed transitional application/config entirely; no dead re-export facade"

patterns-established:
  - "no-persistence-to-application enforced without baseline suppression"

requirements-completed: [PERS-97-02, PERS-97-03, PERS-97-04]

duration: 10min
completed: 2026-05-24
---

# Phase 97 Plan 02: Remove application/config Summary

**application/config deleted; no-persistence-to-application baseline entry removed; persistence owns config resolution**

## Performance

- **Duration:** 10 min
- **Tasks:** 2
- **Files modified:** 8 (5 deleted, 3 modified)

## Accomplishments

- Deleted entire `application/config/` module tree
- Removed `pub mod config` from application/mod.rs
- Dropped no-persistence-to-application from rust-boundary-baseline.json (6→5 entries)
- Updated AGENTS.md transitional baseline table and persistence concern map

## Task Commits

1. **Task 1: Remove application/config module** - `145fb2d` (feat)
2. **Task 2: Drop baseline entry and update docs** - `34f66eb` (feat)

## Decisions Made

None - followed plan as specified.

## Deviations from Plan

### Deferred Issues (pre-existing, out of scope)

**1. Pre-existing no-adapters-to-application violation**
- `crates/rlm-core/src/adapters/ollama_language_model.rs` imports `CancellationController` from application
- Causes `npm run check:rust:boundaries` to fail (existed before Phase 97)
- Phase 97 goal (no-persistence-to-application) verified clean in strict scan
- Logged to deferred-items.md for Phase 105

## Issues Encountered

- `control_server_matches_golden_fixtures` fails when host RAM is low (runBlocked flips true) — environment-dependent, unrelated to config move
- Full boundary CI script blocked by pre-existing ollama adapter arc

## Self-Check: PASSED

- FOUND: scripts/rust-boundary-baseline.json (no no-persistence-to-application entry)
- FOUND: 145fb2d
- FOUND: 34f66eb

---
*Phase: 97-persistence-config-facade*
*Completed: 2026-05-24*
