---
phase: 78-legacy-panel-extraction
plan: 01
subsystem: ui
tags: [react, shell, advanced-hub, panels]

requires:
  - phase: 77-interaction-polish
    provides: Stable tier/canvas interactions before panel extraction
provides:
  - Colocated Advanced domain panel modules
  - Deleted legacy panels monolith
  - QualityLoopCardSummary on nodes layer
affects:
  - phase-79-shell-boundaries
  - phase-81-operator-uat

tech-stack:
  added: []
  patterns:
    - "One panel module per Advanced domain subdirectory"
    - "Settings inspector helpers colocated under advanced/settings/"

key-files:
  created:
    - ui/src/advanced/models/ModelLibraryPanel.tsx
    - ui/src/advanced/plugins/PluginPanel.tsx
    - ui/src/advanced/sessions/SavedSessionPanel.tsx
    - ui/src/advanced/memory/MemoryPanel.tsx
    - ui/src/advanced/settings/RefineGraphPanel.tsx
    - ui/src/advanced/settings/GraphWorkflowPanel.tsx
    - ui/src/advanced/settings/NodeInspector.tsx
    - ui/src/advanced/settings/QualityLoopInspector.tsx
    - ui/src/advanced/settings/inspectorHelpers.tsx
    - ui/src/nodes/QualityLoopCardSummary.tsx
  modified:
    - ui/src/advanced/*View.tsx
    - ui/src/nodes/ExecutionNodeCard.tsx
    - tests/domain/recursion/recursive-language-model.test.ts

key-decisions:
  - "Delete legacy/panels.tsx entirely — no re-export shim"
  - "QualityLoopCardSummary lives in nodes/ for ExecutionNodeCard"

patterns-established:
  - "Advanced views import panels from ./<domain>/ sibling modules only"

requirements-completed: [SHEL-01, SHEL-05]

duration: 15min
completed: 2026-05-22
---

# Phase 78 Plan 01: Legacy Panel Extraction Summary

**Domain panels moved from a 1.8k-line legacy monolith into nine focused modules under `advanced/*` and `nodes/`; the monolith is deleted.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- Models, Plugins, Sessions, Memory, and Settings Advanced views import colocated panel modules only
- `legacy/panels.tsx` deleted; no remaining `legacy/` UI code
- `main.tsx` unchanged — still thin AppShell entry
- UI build and full test suite (346) pass

## Task Commits

1. **T1–T2: Extract panels and remove legacy monolith** — `c848216` (feat)

## Files Created/Modified

- `ui/src/advanced/models/ModelLibraryPanel.tsx` — tier grid, HF search, install rows
- `ui/src/advanced/plugins/PluginPanel.tsx` — install, doctor, enable/disable
- `ui/src/advanced/sessions/SavedSessionPanel.tsx` — save/list/open sessions
- `ui/src/advanced/memory/MemoryPanel.tsx` — preferences, scopes, episodic
- `ui/src/advanced/settings/*` — workflows, refine chat, node inspector, quality loop drill-down
- `ui/src/nodes/QualityLoopCardSummary.tsx` — canvas card loop summary

## Deviations from Plan

None — plan executed as written.

## Self-Check: PASSED

- All created panel modules exist on disk
- `legacy/panels.tsx` absent
- `npm run build:ui` and `npm test` passed during execution
