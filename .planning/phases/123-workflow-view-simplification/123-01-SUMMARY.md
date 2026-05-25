---
phase: 123-workflow-view-simplification
plan: "01"
subsystem: ui
tags: [react, workflow-shell, topbar, run-panel]

requires:
  - phase: 121-ui-vision-audit-and-cut-list
    provides: Cut list demote targets for TopBar, RunPanel, WorkflowOverview
provides:
  - Thin TopBar (status, run/stop, Advanced)
  - Selection-gated RunPanel (approve/clarify only)
  - Canvas-first unselected workflow view
affects:
  - phase-124-styles-token-consolidation
  - phase-125-appshell-decomposition

tech-stack:
  added: []
  patterns:
    - "RunPanel returns null when unselected; CSS :has(.run-panel) expands canvas"
    - "ThemeToggle relocated to Advanced Settings appearance section"

key-files:
  created: []
  modified:
    - ui/src/app/TopBar.tsx
    - ui/src/app/AppShell.tsx
    - ui/src/run-panel/RunPanel.tsx
    - ui/src/advanced/SettingsView.tsx
    - tests/ui/shell-boundaries.test.ts

key-decisions:
  - "WorkflowOverview.tsx kept on disk but unmounted from workflow view"
  - "Theme toggle moved to Advanced Settings, not deleted"

patterns-established:
  - "Selection-gated run panel: null render drives grid layout without JS layout toggles"

requirements-completed: []

duration: 25min
completed: 2026-05-24
---

# Phase 123 Plan 01: Workflow View Simplification Summary

**Thin TopBar, canvas-first default view, Run panel on node select only with approve/clarify actions**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (+ 1 code-review fix)
- **Files modified:** 5

## Accomplishments

- Removed approval-mode pill, run-variant pill, and theme toggle from TopBar
- Moved ThemeToggle to Advanced Settings appearance section
- RunPanel returns null when no node selected — canvas fills workflow view
- Slimmed RunPanel to approve/skip and clarification only
- Extended shell-boundaries static tests for new contracts

## Task Commits

1. **Task 1: Trim TopBar and move theme to Advanced** - `1aae510` (feat)
2. **Task 2: Selection-gate RunPanel** - `6b2ce10` (feat)
3. **Code review fix: unused activeRunVariant** - `9ac8684` (fix)

**Plan metadata:** `ced4809` (docs: create phase plan)

## Files Created/Modified

- `ui/src/app/TopBar.tsx` - Thin chrome: status, run/stop/resume, Advanced
- `ui/src/advanced/SettingsView.tsx` - Appearance section with ThemeToggle
- `ui/src/run-panel/RunPanel.tsx` - Null when unselected; approve/clarify only
- `ui/src/app/AppShell.tsx` - Removed unused readiness props and activeRunVariant state
- `tests/ui/shell-boundaries.test.ts` - Selection-gate and thin TopBar assertions

## Decisions Made

- WorkflowOverview file retained but not mounted from RunPanel (Advanced reuse deferred)
- Removed activeRunVariant tracking entirely — was only for removed variant pill

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused activeRunVariant after TopBar trim**
- **Found during:** Code review
- **Issue:** ESLint unused variable after removing run-variant pill
- **Fix:** Dropped state/prop; confirm-run uses runVariant directly
- **Files modified:** TopBar.tsx, AppShell.tsx
- **Commit:** `9ac8684`

## Issues Encountered

None beyond lint fix above.

## Next Phase Readiness

- Phase 124 can prune dead CSS for removed pills/overview mount path
- Phase 125 can decompose AppShell fetches separately

## Self-Check: PASSED

- [x] ui/src/app/TopBar.tsx
- [x] ui/src/run-panel/RunPanel.tsx
- [x] Commits 1aae510, 6b2ce10, 9ac8684 found
