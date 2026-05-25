---
phase: 121-ui-vision-audit-and-cut-list
plan: 01
subsystem: ui
tags: [audit, cut-list, react, planning]

requires: []
provides:
  - Authoritative 121-CUT-LIST.md with 26 Keep/Demote/Delete verdict rows
  - Phase 122-127 owner mapping for downstream execution
  - Spec drift callouts for RunPanel, NodeInspector, TopBar, AdvancedHub
affects: [122-advanced-hub-pruning, 123-workflow-view-simplification, 124-styles-token-consolidation, 125-appshell-decomposition, 126-node-inspector-slim-down, 127-lazy-routes-bundle]

tech-stack:
  added: []
  patterns: [5-question audit framework, component-level verdict table]

key-files:
  created:
    - .planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md
  modified:
    - .planning/notes/ui-product-simplification-decisions.md

key-decisions:
  - "RefineGraphPanel and QualityLoopInspector scored Delete (Phase 122) — not default-path graph surfaces"
  - "NodeInspector, GraphWorkflowPanel, inspectorHelpers scored Demote (Phase 126)"
  - "WorkflowOverview and TopBar scored Demote (Phase 123) for spec drift against thin-bar shell"
  - "AppShell Keep with Phase 125 decomposition owner; styles.css Demote with Phase 124 split"

patterns-established:
  - "Cut list format: directory-grouped verdict tables with Phase owner column"
  - "Audit-only phase: no ui/src modifications"

requirements-completed: []

duration: 15min
completed: 2026-05-24
---

# Phase 121 Plan 01: UI Vision Cut List Summary

**Complete UI surface cut list scoring 26 audit rows (25 tsx + styles.css) with Keep/Demote/Delete verdicts and Phase 122–127 owner assignments**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-24T00:00:00Z
- **Completed:** 2026-05-24T00:15:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Created `121-CUT-LIST.md` with inventory (27 tsx, 25 auditable, 1,803 CSS lines)
- Scored all 26 surfaces: 18 Keep, 6 Demote, 2 Delete
- Documented 4 spec drift callouts and mandatory surface summary table
- Cross-referenced cut list from `ui-product-simplification-decisions.md`

## Task Commits

1. **Task 1–2: Generate inventory and verdict table** - `4b4101f` (feat)
2. **Task 3: Summary counts and cross-references** - `7ff4468` (docs)

## Files Created/Modified

- `.planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md` - Authoritative cut list for Phases 122–127
- `.planning/notes/ui-product-simplification-decisions.md` - Phase sequence cross-reference

## Decisions Made

- RefineGraphPanel → Delete (122): chat refine not graph-first default path
- QualityLoopInspector → Delete (122): recoverable via QualityLoopCardSummary on node cards
- NodeInspector → Demote (126): 461 LOC duplicates node card/context menu actions
- WorkflowOverview → Demote (123): shown when no node selected, overlaps TopBar
- AppShell → Keep (125): structure preserved, decomposition flagged

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 122 can execute Delete rows (RefineGraphPanel, QualityLoopInspector)
- Phases 123–127 have Phase owner column mapping for Demote/Keep follow-ups
- Plan 121-02 adds automated completeness test and bundle baseline

## Self-Check: PASSED

- FOUND: .planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md
- FOUND: 4b4101f
- FOUND: 7ff4468

---
*Phase: 121-ui-vision-audit-and-cut-list*
*Completed: 2026-05-24*
