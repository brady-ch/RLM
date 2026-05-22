---
phase: 51-plugin-manager-ui
plan: 01
subsystem: ui
tags: [plugin-manager, control-server, react, plugins-panel]

requires:
  - phase: 50-remote-fetch
    provides: remote install confirm and doctor --fix API routes
provides:
  - PluginPanel in UI inspector rail
  - CLI-aligned plugin list/doctor copy and restart banner
  - Remote install trust confirm modal in UI
affects: []

tech-stack:
  added: []
  patterns:
    - "Plugin UI consumes /api/plugins/* without new server handlers"
    - "postJson helper for install preview responses with ok:false"

key-files:
  created:
    - .planning/phases/51-plugin-manager-ui/51-UI-SPEC.md
    - .planning/phases/51-plugin-manager-ui/51-UI-REVIEW.md
  modified:
    - ui/src/main.tsx
    - ui/src/styles.css

key-decisions:
  - "Plugin panel self-contained below Model Library; no new control-server routes (UI-01 already satisfied Phase 49–50)"
  - "Remote install confirm mirrors CLI --yes; local install proceeds without modal"
  - "restartRequired banner persists until page reload after any mutation returning requiresRestart"

requirements-completed: [UI-01, UI-02, UI-03, UI-04]

duration: 20min
completed: 2026-05-22
---

# Phase 51 Plan 01: Plugin Manager UI Summary

**Plugin panel in the inspector rail with CLI-aligned list/doctor copy, remote install confirm modal, and persistent restart banner via existing `/api/plugins` routes**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-22T17:00:00Z
- **Completed:** 2026-05-22T17:20:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `PluginPanel` lists plugins with `formatPluginLine` vocabulary matching CLI
- Install flow handles `needsConfirm` preview for remote URLs before `{ confirm: true }`
- Doctor section shows ERROR/WARN issue codes; **Doctor --fix** posts `/api/plugins/doctor/fix`
- Restart banner shown after enable/disable/uninstall/install/fix mutations

## Task Commits

1. **Task 1: UI design contract** - `6fd312b` (docs)
2. **Task 2: Plugin panel component** - `08c046a` (feat)
3. **Task 3: Verification** - (this metadata commit)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `ui/src/main.tsx` - PluginPanel, PluginRow, types, refreshPlugins, postJson
- `ui/src/styles.css` - plugin-panel styles matching model-library panel
- `.planning/phases/51-plugin-manager-ui/51-UI-SPEC.md` - design contract
- `.planning/phases/51-plugin-manager-ui/51-UI-REVIEW.md` - 6-pillar audit

## Decisions Made

- No backend changes; UI-01 satisfied by Phase 49–50 handlers
- Built-in plugins hide enable/disable/uninstall controls (registry rejects mutations)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

- Milestone v1.7 Phase 51 complete; plugin manager UX parity across CLI and UI
- Optional follow-up: modal overlay for remote confirm; dedicated `.secondary` button style

## Self-Check: PASSED

- FOUND: ui/src/main.tsx
- FOUND: ui/src/styles.css
- FOUND: 6fd312b, 08c046a

---
*Phase: 51-plugin-manager-ui*
*Completed: 2026-05-22*
