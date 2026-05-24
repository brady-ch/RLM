---
phase: 116-application-layer-removal
plan: 02
subsystem: testing
tags: [typescript-removal, agent-safe-verify, rust-tests]

requires:
  - phase: 116-application-layer-removal
    provides: Deleted src/application/ (Plan 01)
provides:
  - Deleted tests/application/ mirror
  - Light verify profile uses Rust config loader smoke
affects: [116-03, 119-npm-toolchain-and-ci-rust-only-cleanup]

tech-stack:
  added: []
  patterns: [agent-safe-verify light profile uses cargo test loader smoke]

key-files:
  created: []
  modified: [scripts/agent-safe-verify.mjs]

key-decisions:
  - "Replaced TS validation.unit.test.ts with cargo test -p rlm-core loader in light and reg03 profiles"

patterns-established:
  - "Agent verify config smoke delegated to Rust persistence config loader test"

requirements-completed: [RETIRE-116-02]

duration: 3min
completed: 2026-05-24
---

# Phase 116 Plan 02: Application Tests Removal Summary

**Deleted mirrored `tests/application/` (~14 files) and rewired agent-safe-verify light profile to Rust config loader smoke**

## Performance

- **Duration:** ~3 min
- **Tasks:** 2
- **Files modified:** 15 (14 deleted + agent-safe-verify.mjs)

## Accomplishments
- Removed entire `tests/application/` tree (config, execution, graph, memory, plugins)
- Updated `PROFILES.light` and `PROFILES.reg03` to use RAM-gated `cargo test -p rlm-core loader`
- Rust tests at `crates/rlm-core/tests/application/` remain authoritative

## Task Commits

1. **Task 1: Delete tests/application/ mirror** - `74dec5a` (feat)
2. **Task 2: Update agent-safe-verify light profile** - `25ba8a2` (chore)

## Files Created/Modified
- `tests/application/` - Removed entirely (14 files)
- `scripts/agent-safe-verify.mjs` - Rust loader smoke replaces TS config validation

## Decisions Made
- Used `loader` filter for cargo test (matches `parse_yaml_includes_path_context` in persistence config loader)

## Deviations from Plan

None - plan executed exactly as written.

## Verification
- `test ! -d tests/application` — PASS
- `npm run test:agent:verify:light` — PASS (3/3 steps)

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- Plan 03 can prune orphaned TS imports and run full Phase 116 gates

## Self-Check: PASSED
- FOUND: scripts/agent-safe-verify.mjs
- FOUND: 74dec5a, 25ba8a2

---
*Phase: 116-application-layer-removal*
*Completed: 2026-05-24*
