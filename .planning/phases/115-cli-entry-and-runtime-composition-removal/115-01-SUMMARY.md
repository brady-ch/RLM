---
phase: 115-cli-entry-and-runtime-composition-removal
plan: 01
subsystem: infra
tags: [rust, cli, npm, dispatcher]

requires:
  - phase: 113-node-runtime-retirement-audit-and-cutover-gates
    provides: Phase 115 gate definitions and deletion inventory
provides:
  - Rust-only npm rlm dispatcher via scripts/rlm-runtime.mjs
  - package.json without Node CLI entry scripts
affects: [115-02, 115-03, phase-116]

tech-stack:
  added: []
  patterns: [Rust-only CLI dispatch, stale RLM_RUNTIME env warning]

key-files:
  created: []
  modified: [scripts/rlm-runtime.mjs, scripts/rlm-runtime.test.mjs, package.json]

key-decisions:
  - "RLM_RUNTIME env warns and is ignored rather than erroring on stale shell env"
  - "Removed main/dev/start/rlm:node from package.json; bin.rlm unchanged"

patterns-established:
  - "npm rlm always spawns target/release|debug/rlm binary"

requirements-completed: [RETIRE-115-02, RETIRE-115-04]

duration: 8min
completed: 2026-05-24
---

# Phase 115 Plan 01: Rust-only Dispatcher Summary

**npm rlm dispatches exclusively to Rust rlm-cli with stale RLM_RUNTIME warning and no Node fallback**

## Performance

- **Duration:** 8 min
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Rewrote `scripts/rlm-runtime.mjs` to Rust-only dispatch with `resolveRustBinary()` preserved
- Updated tests to assert no `runNode`, Rust subcommands in `--help`, and RLM_RUNTIME warning behavior
- Removed `dev`, `start`, `rlm:node` scripts and `main` field from package.json

## Task Commits

1. **Task 1: Rust-only rlm-runtime dispatcher** - `ae202f3` (feat)
2. **Task 2: Update rlm-runtime tests** - `0c1bfeb` (test)
3. **Task 3: Prune package.json Node CLI scripts** - `9ba8b90` (chore)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

---
*Phase: 115-cli-entry-and-runtime-composition-removal*
*Completed: 2026-05-24*
