---
phase: 125-appshell-decomposition
plan: "01"
subsystem: ui
tags: [react, appshell, hooks, advanced-views, decomposition]

requires:
  - phase: 124-styles-token-consolidation
    provides: CSS module split and workflow shell styles

provides:
  - Workflow hooks (useWorkflowSession, useGraphCanvas, useViewRouter, useLauncherSessions)
  - Self-fetching Advanced views (models, plugins, memory, sessions, settings)
  - AppShell under 200 lines with no domain fetch on workflow mount

affects: [126-node-inspector-slim-down, 127-lazy-routes-bundle]

tech-stack:
  added: []
  patterns:
    - "Domain fetch colocation: Advanced views own state + mount fetch"
    - "Workflow hooks in ui/src/app/hooks/ for session/graph/routing"

key-files:
  created:
    - ui/src/app/hooks/useWorkflowSession.ts
    - ui/src/app/hooks/useGraphCanvas.ts
    - ui/src/app/hooks/useViewRouter.ts
    - ui/src/app/hooks/useLauncherSessions.ts
    - tests/ui/appshell-decomposition.test.ts
  modified:
    - ui/src/app/AppShell.tsx
    - ui/src/advanced/AdvancedHub.tsx
    - ui/src/advanced/ModelsView.tsx
    - ui/src/advanced/PluginsView.tsx
    - ui/src/advanced/MemoryView.tsx
    - ui/src/advanced/SessionsView.tsx
    - ui/src/advanced/SettingsView.tsx
    - tests/ui/shell-boundaries.test.ts

key-decisions:
  - "Workflow hooks live in ui/src/app/hooks/; domain hooks colocated in Advanced views"
  - "useLauncherSessions retains minimal saved-session fetch for first-run launcher only"
  - "Removed onMount prop pattern; views use internal useEffect for fetch"

patterns-established:
  - "AppShell orchestrates workflow only; Advanced views fetch on tab mount"
  - "useGraphCanvas owns nodeUiStateKey sync previously inline in AppShell"

requirements-completed: []

duration: 25min
completed: 2026-05-24
---

# Phase 125 Plan 01: AppShell State Decomposition Summary

**AppShell slimmed to 132 lines via workflow hooks; model/plugin/memory fetches moved into Advanced view mounts**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-24T00:00:00Z
- **Completed:** 2026-05-24T00:25:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- AppShell reduced from ~433 to 132 lines (target <200)
- Domain fetches (`/api/model-library`, `/api/plugins`, `/api/memory`) removed from AppShell
- Session SSE + graph canvas behavior preserved via extracted hooks
- Static tests enforce decomposition boundaries

## Task Commits

1. **Task 1: Extract workflow hooks from AppShell** - `33628fc` (feat)
2. **Task 2: Move domain fetches into Advanced views** - `05e9e56` (feat)
3. **Task 3: Slim AppShell and add decomposition test** - `74e150e` (test)

## Files Created/Modified

- `ui/src/app/hooks/useWorkflowSession.ts` - Session snapshot + SSE subscription
- `ui/src/app/hooks/useGraphCanvas.ts` - React Flow sync, layout, viewport
- `ui/src/app/hooks/useViewRouter.ts` - Workflow/advanced routing + launcher gate
- `ui/src/app/hooks/useLauncherSessions.ts` - Saved sessions for first-run launcher
- `ui/src/app/AppShell.tsx` - Thin orchestrator wiring hooks and views
- `ui/src/advanced/*View.tsx` - Self-contained domain state and fetch
- `tests/ui/appshell-decomposition.test.ts` - Line count and fetch boundary tests

## Decisions Made

- Workflow hooks in `app/hooks/`; Advanced views colocate fetch logic internally
- `useLauncherSessions` keeps minimal session list for FirstRunLauncher (workflow-only)
- Updated `shell-boundaries.test.ts` to assert `nodeUiStateKey` in `useGraphCanvas`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 126 (NodeInspector slim down) can proceed on simplified AdvancedHub
- Phase 127 (lazy routes) can code-split Advanced views independently

## Self-Check: PASSED

- FOUND: ui/src/app/AppShell.tsx (132 lines)
- FOUND: ui/src/app/hooks/useWorkflowSession.ts
- FOUND: tests/ui/appshell-decomposition.test.ts
- FOUND: 33628fc, 05e9e56, 74e150e

---
*Phase: 125-appshell-decomposition*
*Completed: 2026-05-24*
