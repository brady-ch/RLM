---
phase: 122-advanced-hub-pruning
plan: 01
subsystem: ui
tags: [react, advanced-hub, cut-list, ui-pruning]

requires:
  - phase: 121-ui-vision-audit-and-cut-list
    provides: Delete verdicts for RefineGraphPanel and QualityLoopInspector
provides:
  - Advanced hub without RefineGraphPanel and QualityLoopInspector
  - Tab order Models, Sessions, Plugins, Memory, Settings
  - Cleaned AppShell prop chain (no chat refine state)
affects:
  - phase-126-node-inspector-slim-down
  - phase-127-lazy-routes-bundle

tech-stack:
  added: []
  patterns:
    - "Execute Phase 121 Delete rows by removing files and full prop-chain cleanup"

key-files:
  created: []
  modified:
    - ui/src/advanced/AdvancedHub.tsx
    - ui/src/advanced/SettingsView.tsx
    - ui/src/advanced/settings/NodeInspector.tsx
    - ui/src/app/AppShell.tsx
    - ui/src/styles.css
    - tests/ui/cut-list-completeness.test.ts

key-decisions:
  - "Quality loop accept/stop actions removed with inspector; inline card summary retained on canvas"
  - "Cut-list test uses >= row count to tolerate historical Delete rows after file removal"

patterns-established:
  - "Panel deletion includes AppShell→AdvancedHub→View prop chain cleanup, not just component file removal"

requirements-completed: []

duration: 15min
completed: 2026-05-24
---

# Phase 122 Plan 01: Advanced Hub Pruning Summary

**Deleted RefineGraphPanel and QualityLoopInspector; reordered Advanced tabs with Models and Sessions first; removed ~400 lines of dead UI/CSS.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-24T00:00:00Z
- **Completed:** 2026-05-24T00:15:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Removed RefineGraphPanel and QualityLoopInspector from codebase and SettingsView wiring
- Reordered Advanced hub tabs: Models, Sessions, Plugins, Memory, Settings
- Removed orphaned chatMessage/deleteStrategy/graphHasPlannedNodes state from AppShell chain
- Removed CSS blocks exclusive to deleted panels (~78 lines)
- Bundle reduced: JS 516.52 kB (was 522.60 kB), CSS 44.55 kB (was 45.52 kB)

## Task Commits

1. **Task 1: Delete panel components and remove wiring** - `5fcf61a` (feat)
2. **Task 2: Reorder Advanced tabs and remove exclusive CSS** - `f9c6542` (refactor)
3. **Task 3: Update cut-list test and verify build** - `c888f0a` (test)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `ui/src/advanced/settings/RefineGraphPanel.tsx` - Deleted
- `ui/src/advanced/settings/QualityLoopInspector.tsx` - Deleted
- `ui/src/advanced/SettingsView.tsx` - Removed deleted panel sections and props
- `ui/src/advanced/settings/NodeInspector.tsx` - Removed QualityLoopInspector embed
- `ui/src/advanced/AdvancedHub.tsx` - Tab reorder + prop cleanup
- `ui/src/app/AppShell.tsx` - Removed chat refine state
- `ui/src/styles.css` - Removed panel-exclusive CSS
- `tests/ui/cut-list-completeness.test.ts` - Relaxed row count for post-deletion inventory

## Decisions Made

- Quality loop drill-down and accept/stop actions dropped with inspector; status remains on node cards via QualityLoopCardSummary
- Cut-list completeness test uses `>=` row count since 121-CUT-LIST retains historical Delete rows

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 123 (workflow chrome trim) can proceed independently
- Phase 126 (NodeInspector slim-down) still owns Demote items
- Phase 127 (lazy routes) can measure bundle delta from this baseline

## Self-Check: PASSED

- [x] 122-01-SUMMARY.md exists
- [x] Commits 5fcf61a, f9c6542, c888f0a found in git log

---
*Phase: 122-advanced-hub-pruning*
*Completed: 2026-05-24*
