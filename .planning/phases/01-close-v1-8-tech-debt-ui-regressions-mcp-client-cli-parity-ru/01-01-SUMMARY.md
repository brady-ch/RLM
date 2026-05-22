---
phase: 01-close-v1-8-tech-debt-ui-regressions-mcp-client-cli-parity-ru
plan: 01
subsystem: ui
tags: [react, topbar, modals, model-library, regressions]
requires: []
provides:
  - Pause future auto-approvals control in TopBar
  - HF model download wiring in ModelLibraryRow
  - GraphActionModal for graph mutations
  - Secondary and Run primary button styles
affects: [01-02 REG-01 UAT]
tech-stack:
  added: []
  patterns:
    - "GraphActionModal reuses legacy modal-overlay/modal-card pattern"
key-files:
  created:
    - ui/src/nodes/GraphActionModal.tsx
  modified:
    - ui/src/app/TopBar.tsx
    - ui/src/styles.css
    - ui/src/legacy/panels.tsx
    - ui/src/nodes/NodeContextMenu.tsx
    - ui/src/nodes/ExecutionNodeCard.tsx
key-decisions:
  - "HF install uses /api/model-library/download with entry.id as repo_id"
  - "Pause control only visible for initial-plan-recursive while running"
requirements-completed: [ENGN-02, MDLH-03, REG-01]
duration: 15min
completed: 2026-05-22
---

# Phase 1 Plan 01: UI bundle Summary

**Restored Phase 61 UI regressions: pause-auto-approvals, HF download, secondary/Run styles, and in-app graph modals.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments

- TopBar exposes Pause future auto-approvals for `initial-plan-recursive` runs
- ModelLibraryRow branches install to `/download` for Hugging Face sources
- Graph mutations use `GraphActionModal` instead of browser dialogs
- `.secondary` and `.btn-run-primary` CSS variants for Advanced vs Run

## Task Commits

1. **Task 1: Secondary CSS and TopBar Run/pause controls** - `293dbfc`
2. **Task 2: HF model download wiring** - `602179b`
3. **Task 3: Graph mutation modals and stale copy fix** - `e662042`

## Files Created/Modified

- `ui/src/nodes/GraphActionModal.tsx` - Prompt/confirm modal for graph actions
- `ui/src/app/TopBar.tsx` - Pause control + Run primary class
- `ui/src/styles.css` - `.secondary`, `.btn-run-primary`
- `ui/src/legacy/panels.tsx` - HF download branch
- `ui/src/nodes/NodeContextMenu.tsx` - Modal-driven graph mutations
- `ui/src/nodes/ExecutionNodeCard.tsx` - Root empty-state copy

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: ui/src/nodes/GraphActionModal.tsx
- FOUND: ui/src/app/TopBar.tsx
- FOUND: commits 293dbfc, 602179b, e662042
