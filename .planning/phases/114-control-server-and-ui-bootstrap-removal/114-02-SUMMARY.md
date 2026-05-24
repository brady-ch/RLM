---
phase: 114-control-server-and-ui-bootstrap-removal
plan: 02
subsystem: api
tags: [control-server, rust-migration, node-retirement]

requires:
  - phase: 114-control-server-and-ui-bootstrap-removal
    provides: Rust-only parity gate from plan 01
provides:
  - Deleted src/application/control-server/ (12 files)
  - Deleted src/cli/run-modes/ui.ts
  - index.ts ui command redirects to Rust with exit code 1
affects: [114-03, phase-115-cli-entry-removal]

tech-stack:
  added: []
  patterns: [TS HTTP transport removed; Rust Axum sole server]

key-files:
  created: []
  modified: [src/index.ts, tests/domain/recursion/recursive-language-model.test.ts]
  deleted: [src/application/control-server/, src/cli/run-modes/ui.ts]

key-decisions:
  - "index.ts ui branch exits with stderr redirect; does not spawn Rust (Phase 115 scope)"
  - "HTTP integration tests removed from domain test file; coverage in Rust golden fixtures"

patterns-established:
  - "grep gate: zero application/control-server imports in src/ and tests/"

requirements-completed: [RETIRE-114-01, RETIRE-114-04]

duration: 10min
completed: 2026-05-24
---

# Phase 114 Plan 02: Delete TS Control Server Summary

**Removed entire TypeScript control server and UI bootstrap; Node CLI `ui` command now redirects operators to Rust.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2
- **Files modified:** 15 (13 deleted, 2 updated)

## Accomplishments

- Deleted all 12 files under `src/application/control-server/` and `src/cli/run-modes/ui.ts`
- Removed 7 HTTP integration tests booting TS control server from domain test file
- Refactored approval mode contract test to CLI/UI static checks only
- Updated `src/index.ts` with Phase 114 redirect message for `ui` command
- `npm run build` succeeds after deletion

## Task Commits

1. **Task 1: Remove HTTP integration tests** - `5580d97` (feat)
2. **Task 2: Delete TS control server and UI bootstrap** - `2d96f5d` (feat)

## Files Created/Modified

- `src/index.ts` - ui command stderr redirect to `npm run rlm -- ui`
- `tests/domain/recursion/recursive-language-model.test.ts` - removed startControlServer tests
- `src/application/control-server/` - deleted (12 files)
- `src/cli/run-modes/ui.ts` - deleted

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `src/application/control-server` absent
- `src/cli/run-modes/ui.ts` absent
- grep gate clean for control-server imports
- Commits `5580d97`, `2d96f5d` found in git log
