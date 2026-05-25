---
phase: 126-node-inspector-and-settings-slim-down
plan: 01
subsystem: ui
tags: [react, node-inspector, settings, cut-list, ui-slim-down]

requires:
  - phase: 125-appshell-decomposition
    provides: AppShell hooks and Advanced view fetch boundaries
provides:
  - Slim NodeInspector (metadata + Advanced overrides only)
  - Collapsed GraphWorkflowPanel without run-variant duplication
  - Shell-boundaries tests for inspector/settings invariants
affects:
  - phase-127-lazy-routes-bundle

tech-stack:
  added: []
  patterns:
    - "Demote cut-list surfaces by removing canvas-duplicated actions, not deleting files"

key-files:
  created: []
  modified:
    - ui/src/advanced/settings/NodeInspector.tsx
    - ui/src/advanced/settings/GraphWorkflowPanel.tsx
    - ui/src/advanced/SettingsView.tsx
    - ui/src/advanced/AdvancedHub.tsx
    - ui/src/app/AppShell.tsx
    - ui/src/styles/advanced.css
    - tests/ui/shell-boundaries.test.ts

key-decisions:
  - "NodeInspector keeps expert/model/sampling override forms as Advanced path from context menu"
  - "Prompt shown read-only; all edit/plan/run/graph mutations stay on canvas and context menu"
  - "GraphWorkflowPanel collapsed via details; run-variant controls removed as TopBar overlap"

patterns-established:
  - "Settings collapsible sections use details.settings-collapsible for Advanced-only panels"

requirements-completed: []

duration: 20min
completed: 2026-05-24
---

# Phase 126 Plan 01: Node Inspector and Settings Slim Down Summary

**NodeInspector cut from 453 to 318 LOC with no duplicate prompt/plan/run UI; GraphWorkflowPanel collapsed and stripped of run-variant controls.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Removed duplicate prompt textarea, Save prompt, plan/run actions, and graph mutations from NodeInspector
- Kept read-only composer metadata plus Advanced-only model/expert/sampling override forms
- Removed run-variant controls from GraphWorkflowPanel; wrapped in collapsed `<details>` in SettingsView
- Trimmed runVariant prop chain from AdvancedHub (TopBar retains playbook default for confirm-run)
- Added shell-boundaries tests enforcing slim-down invariants

## Task Commits

1. **Task 1: Slim NodeInspector** - `b53a873` (feat)
2. **Task 2: Collapse GraphWorkflowPanel** - `feed0bd` (feat)
3. **Task 3: Trim helpers and add tests** - `d885fcc` (test)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `ui/src/advanced/settings/NodeInspector.tsx` - Removed 137 lines of duplicate canvas actions
- `ui/src/advanced/settings/GraphWorkflowPanel.tsx` - Removed run-variant block
- `ui/src/advanced/SettingsView.tsx` - Collapsible graph workflows section
- `ui/src/advanced/AdvancedHub.tsx` - Dropped runVariant props
- `ui/src/app/AppShell.tsx` - AdvancedHub prop cleanup
- `ui/src/styles/advanced.css` - settings-collapsible styles
- `tests/ui/shell-boundaries.test.ts` - NodeInspector/GraphWorkflowPanel boundary tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Syntax error in shell-boundaries test**
- **Found during:** Task 3
- **Issue:** Stray `.test(` prefix broke TypeScript parse
- **Fix:** Corrected to `test(`
- **Files modified:** tests/ui/shell-boundaries.test.ts
- **Commit:** `d885fcc`

**2. Line count target**
- **Found during:** Task 1 verification
- **Issue:** Plan target `<280` lines; result 318 (still 30% reduction from 453)
- **Resolution:** Accepted — remaining lines are read-only composer metadata and Advanced override forms

## Self-Check: PASSED

- [x] ui/src/advanced/settings/NodeInspector.tsx exists
- [x] tests/ui/shell-boundaries.test.ts exists
- [x] Commits b53a873, feed0bd, d885fcc found in git log
