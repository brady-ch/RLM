---
phase: 79-shell-boundaries-context-menu
plan: 01
subsystem: ui
tags: [react, shell, context-menu, eslint, boundaries]

requires:
  - phase: 78-legacy-panel-extraction
    provides: Domain panels in advanced/* modules; thin main entry
provides:
  - Shell boundary contract tests in tests/ui/
  - ESLint no-restricted-imports for run-panel → advanced
  - Verified Variant B context menu and Run panel scope
affects:
  - phase-80-first-run-launcher
  - phase-81-operator-uat-sign-off

tech-stack:
  added: []
  patterns:
    - "UI shell boundaries enforced via ESLint + node:test contract tests"
    - "run-panel/ isolated from advanced/ per ui-shell-architecture.md"

key-files:
  created:
    - tests/ui/shell-boundaries.test.ts
    - .planning/phases/79-shell-boundaries-context-menu/79-CONTEXT.md
    - .planning/phases/79-shell-boundaries-context-menu/79-01-PLAN.md
    - .planning/phases/79-shell-boundaries-context-menu/79-VERIFICATION.md
  modified:
    - eslint.config.js
    - ui/src/run-panel/RunPanel.tsx

key-decisions:
  - "Use ESLint no-restricted-imports instead of depcruise for UI run-panel boundary (depcruise targets src/ only)"
  - "Contract tests verify Phase 61 shell; no structural rewrite needed"

patterns-established:
  - "tests/ui/shell-boundaries.test.ts ratchets SHEL-02–04 invariants on every npm test run"

requirements-completed: [SHEL-02, SHEL-03, SHEL-04]

duration: 12min
completed: 2026-05-23
---

# Phase 79 Plan 01: Shell Boundaries & Context Menu Summary

**Verified Phase 61 shell with ESLint run-panel boundary rule and six contract tests ratcheting SHEL-02–04**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-23T02:07:51Z
- **Completed:** 2026-05-23T02:20:00Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments

- Confirmed workflow view is TopBar + canvas + RunPanel; Advanced hub is full-screen takeover only
- Confirmed RunPanel is approve/clarify/readiness on select — no edit fields or plan buttons
- Confirmed NodeContextMenu Variant B with right-click, ⋮, and Shift+F10 keyboard access
- Added ESLint `no-restricted-imports` blocking `run-panel/` → `advanced/` imports
- Added `tests/ui/shell-boundaries.test.ts` (6 contract tests)

## Task Commits

1. **Task 1: Shell boundary contract test** - `8b9ca50` (test)
2. **Task 2: ESLint run-panel boundary rule** - `f07cea5` (chore)
3. **Task 3: Run panel test id** - `a775368` (feat)

## Files Created/Modified

- `tests/ui/shell-boundaries.test.ts` — Contract tests for SHEL-02–04 invariants
- `eslint.config.js` — `no-restricted-imports` on `ui/src/run-panel/**`
- `ui/src/run-panel/RunPanel.tsx` — `data-testid="run-panel"`

## Decisions Made

- ESLint over depcruise for UI boundary — dependency-cruiser config only covers `src/`
- Verify-and-ratchet approach — Phase 61 implementation was complete; Phase 79 adds enforcement

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Shell boundaries enforced and tested — ready for Phase 80 First-Run Launcher
- REG-01 UAT can use `data-testid="run-panel"` and existing `workflow-main` / `advanced-main` selectors

## Self-Check: PASSED

- `tests/ui/shell-boundaries.test.ts`: FOUND
- `.planning/phases/79-shell-boundaries-context-menu/79-VERIFICATION.md`: FOUND
- Commits `8b9ca50`, `f07cea5`, `a775368`: FOUND

---
*Phase: 79-shell-boundaries-context-menu*
*Completed: 2026-05-23*
