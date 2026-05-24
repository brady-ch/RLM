---
phase: 118-adapters-plugins-and-ts-tests-removal
plan: 01
subsystem: infra
tags: [typescript-removal, rust, adapters, plugins]

requires:
  - phase: 117-domain-and-ports-removal
    provides: domain/ports removed from src/
provides:
  - TS adapters and plugins layers deleted
  - AGENTS.md documents Rust-only runtime boundary
affects: [118-02, 118-03, 119-npm-toolchain-cleanup]

tech-stack:
  added: []
  patterns: [Rust-only adapters/plugins in crates/rlm-core]

key-files:
  created: []
  modified: [AGENTS.md]

key-decisions:
  - "TS src/adapters/ and src/plugins/ fully removed; Rust crates/rlm-core paths are canonical"

patterns-established:
  - "Phase 118 boundary: no TypeScript runtime layers remain in src/"

requirements-completed: [RETIRE-118-01]

duration: 5min
completed: 2026-05-24
---

# Phase 118 Plan 01: Adapters and Plugins Removal Summary

**Deleted 33 TypeScript adapter/plugin files; AGENTS.md now documents Rust-only runtime in crates/rlm-core**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 36 (35 deleted, 1 updated)

## Accomplishments

- Removed `src/adapters/` (9 files: persistence stores, model hosts)
- Removed `src/plugins/` (24 files: builtin, remote-fetch, loader)
- Updated AGENTS.md concern map, layout, plugin taxonomy, and extending sections for Phase 118

## Task Commits

1. **Task 1: Delete src/adapters/ and src/plugins/ trees** - `82846b7` (feat)
2. **Task 2: Update AGENTS.md for Phase 118 boundary** - `dd640f5` (docs)

## Files Created/Modified

- `src/adapters/` — deleted (9 files)
- `src/plugins/` — deleted (24 files)
- `AGENTS.md` — Rust-only boundary documentation

## Decisions Made

- Rust `crates/rlm-core/src/adapters/`, `persistence/`, and `plugins/` remain sole implementation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

- Ready for Plan 02 (mirrored TS test tree deletion)

## Self-Check: PASSED

- FOUND: AGENTS.md
- FOUND: commit 82846b7
- FOUND: commit dd640f5

---
*Phase: 118-adapters-plugins-and-ts-tests-removal*
*Completed: 2026-05-24*
