---
phase: 114-control-server-and-ui-bootstrap-removal
plan: 01
subsystem: testing
tags: [parity, rust, golden-fixtures, ci-gates]

requires:
  - phase: 113-node-runtime-retirement-audit-and-cutover-gates
    provides: 113-GATES.md Rust-only check:parity target and deletion inventory
provides:
  - Rust-only check:parity script via cargo-with-ram-gate.mjs
  - Removed TS cross-runtime parity artifacts
affects: [114-02, 114-03, phase-115-cli-entry-removal]

tech-stack:
  added: []
  patterns: [Rust golden fixtures as sole HTTP contract gate]

key-files:
  created: []
  modified: [package.json]
  deleted: [scripts/parity/compare-runtimes.mjs, tests/integration/control-server-fixtures.test.ts]

key-decisions:
  - "check:parity invokes only control_server_matches_golden_fixtures with RAM gate wrapper"
  - "Shared tests/fixtures/control-server/ JSON preserved for Rust test"

patterns-established:
  - "HTTP contract verification: Rust golden fixtures only, no TS server boot"

requirements-completed: [RETIRE-114-04]

duration: 5min
completed: 2026-05-24
---

# Phase 114 Plan 01: Retire TS Parity Scripts Summary

**Removed TS cross-runtime parity scripts; `check:parity` now runs Rust golden fixtures only via RAM-gated cargo test.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 2
- **Files modified:** 3 (2 deleted, 1 updated)

## Accomplishments

- Deleted `scripts/parity/compare-runtimes.mjs` and `tests/integration/control-server-fixtures.test.ts`
- Removed empty `scripts/parity/` directory
- Replaced `check:parity` with Rust-only `cargo-with-ram-gate.mjs` invocation

## Task Commits

1. **Task 1: Delete TS parity scripts and fixture test** - `1212128` (feat)
2. **Task 2: Narrow check:parity to Rust golden fixtures** - `0349b7f` (feat)

## Files Created/Modified

- `package.json` - Rust-only `check:parity` script
- `scripts/parity/compare-runtimes.mjs` - deleted
- `tests/integration/control-server-fixtures.test.ts` - deleted

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `package.json` check:parity verified via node script
- Deletion gates confirmed absent files
- Commits `1212128`, `0349b7f` found in git log
