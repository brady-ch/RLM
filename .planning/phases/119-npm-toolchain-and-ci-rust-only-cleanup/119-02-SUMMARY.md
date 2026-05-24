---
phase: 119-npm-toolchain-and-ci-rust-only-cleanup
plan: 02
subsystem: infra
tags: [eslint, test-runner, depcruise-removal, ui-only]

requires:
  - phase: 119-01
    provides: UI-scoped lint/format scripts in package.json
provides:
  - UI-only eslint.config.js
  - RAM-gated test runner without tsc/dist/tests
  - Deleted root TS compile and depcruise artifacts
affects: [119-03]

tech-stack:
  added: []
  patterns: ["tests/ui via tsx in run-test-suite.mjs"]

key-files:
  created: []
  modified: [eslint.config.js, scripts/run-test-suite.mjs]
  deleted: [tsconfig.json, .dependency-cruiser.js, dependency-cruiser-baseline.json, tests/depcruise/]

key-decisions:
  - "ui/tsconfig.json retained; root tsconfig.json removed"
  - "Test runner includes ui static wiring, packaging, and rlm-runtime smoke"

patterns-established:
  - "ESLint and Prettier scope limited to ui/src"

requirements-completed: [RETIRE-119-03]

duration: 8min
completed: 2026-05-24
---

# Phase 119 Plan 02: TS Toolchain Artifact Removal Summary

**Deleted root tsconfig/depcruise artifacts and rewired eslint and test runner for UI-only Node usage**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-24T15:40:00Z
- **Completed:** 2026-05-24T15:43:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Deleted tsconfig.json, .dependency-cruiser.js, dependency-cruiser-baseline.json, tests/depcruise/
- Scoped eslint.config.js to ui/src with ui/tsconfig.json project
- Replaced run-test-suite STEPS: ui tests (tsx), packaging, rlm-runtime smoke
- Formatted 4 ui/src files exposed by narrowed prettier scope

## Task Commits

1. **Task 1: Delete TS build and depcruise artifacts** - `d8696e1` (feat)
2. **Task 2: Rewire eslint and run-test-suite for UI-only** - `c088b18` (feat)

## Files Created/Modified

- `eslint.config.js` - UI-only lint config
- `scripts/run-test-suite.mjs` - No tsc or dist/tests steps
- `ui/src/app/FirstRunLauncher.tsx` - Prettier formatting
- `ui/src/nodes/NodeContextMenu.tsx` - Prettier formatting
- `ui/src/run-panel/RunPanel.tsx` - Prettier formatting
- `ui/src/shared/ThemeToggle.tsx` - Prettier formatting

## Decisions Made

None - followed plan as specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adjusted run-test-suite comment to pass verify grep**
- **Found during:** Task 2
- **Issue:** Plan verify script greps entire file for `dist/tests`; comment contained that substring
- **Fix:** Reworded file header comment
- **Files modified:** scripts/run-test-suite.mjs
- **Commit:** c088b18

**2. [Rule 3 - Blocking] Removed empty tests/depcruise directory**
- **Found during:** Task 1
- **Issue:** Directory remained after file deletes, failing verify
- **Fix:** rmdir tests/depcruise
- **Commit:** d8696e1

## Issues Encountered

Prettier format:check failed on 4 ui/src files when scope narrowed from src/tests/ui — fixed with npm run format.

## User Setup Required

None

## Next Phase Readiness

119-03 can update AGENTS.md and run full Phase 119 gate suite.

---
*Phase: 119-npm-toolchain-and-ci-rust-only-cleanup*
*Completed: 2026-05-24*

## Self-Check: PASSED

- eslint.config.js, scripts/run-test-suite.mjs: FOUND
- Commits d8696e1, c088b18: FOUND
