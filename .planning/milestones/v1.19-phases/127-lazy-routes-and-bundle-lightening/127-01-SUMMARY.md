---
phase: 127-lazy-routes-and-bundle-lightening
plan: "01"
subsystem: ui
tags: [react, lazy-loading, code-splitting, vite, bundle]

requires:
  - phase: 126-node-inspector-and-settings-slim-down
    provides: Slimmed Advanced settings without duplicate workflow controls
provides:
  - React.lazy AdvancedHub entry from AppShell
  - Per-tab lazy loading in AdvancedHub
  - Bundle before/after documentation vs Phase 121 baseline
affects: [128-ui-simplification-uat]

tech-stack:
  added: []
  patterns:
    - "React.lazy + Suspense at route boundary (AppShell) and tab boundary (AdvancedHub)"
    - "Shared AdvancedLoadingFallback with aria-busy"

key-files:
  created:
    - ui/src/advanced/AdvancedLoadingFallback.tsx
  modified:
    - ui/src/app/AppShell.tsx
    - ui/src/advanced/AdvancedHub.tsx
    - tests/ui/shell-boundaries.test.ts

key-decisions:
  - "Two-level lazy split: AppShell defers entire AdvancedHub; AdvancedHub defers each tab view"
  - "No prefetch on hover — load on navigate only (v1.19 scope)"
  - "Per-tab Suspense fallbacks with contextual loading labels"

patterns-established:
  - "AdvancedLoadingFallback: minimal accessible loading state for Suspense boundaries"

requirements-completed: []

duration: 25min
completed: 2026-05-24
---

# Phase 127 Plan 01: Lazy Routes and Bundle Lightening Summary

**React.lazy splits Advanced hub from workflow main chunk — main JS drops 509.88 kB → 480.34 kB with Advanced tab modules deferred until navigation.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-24T00:00:00Z
- **Completed:** 2026-05-24T00:25:00Z
- **Tasks:** 3/3 completed
- **Files modified:** 4

## Accomplishments

- AppShell loads AdvancedHub via `React.lazy` wrapped in Suspense — workflow-first bundle excludes Advanced shell
- AdvancedHub lazy-loads ModelsView, PluginsView, SessionsView, MemoryView, SettingsView per active tab
- Main JS chunk reduced 29.54 kB vs immediate pre-127 build; 42.26 kB below Phase 121 audit baseline

## Task Commits

1. **Task 1–2: Lazy-load Advanced hub and tab views** — `2cd9529` (feat)
2. **Task 3: Bundle measurement and static tests** — `72c7982` (test)

**Plan metadata:** `6c57b4b` (docs: complete plan)

## Bundle Impact

| Metric | Phase 121 baseline | Pre-127 | Post-127 (workflow-first) |
|--------|---------------------|---------|---------------------------|
| Main JS | 522.60 kB | 509.88 kB | **480.34 kB** |
| CSS | 45.52 kB | 42.22 kB | 42.22 kB |

Deferred chunks: AdvancedHub 2.68 kB, ModelsView 3.93 kB, SessionsView 3.34 kB, PluginsView 5.64 kB, MemoryView 2.89 kB, SettingsView 14.33 kB.

## Files Created/Modified

- `ui/src/advanced/AdvancedLoadingFallback.tsx` — Shared Suspense fallback with `data-testid="advanced-loading"`
- `ui/src/app/AppShell.tsx` — `LazyAdvancedHub` via React.lazy + Suspense
- `ui/src/advanced/AdvancedHub.tsx` — Per-tab React.lazy imports
- `tests/ui/shell-boundaries.test.ts` — Lazy-route static assertions

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- ui/src/advanced/AdvancedLoadingFallback.tsx — FOUND
- ui/src/app/AppShell.tsx — FOUND
- ui/src/advanced/AdvancedHub.tsx — FOUND
- .planning/phases/127-lazy-routes-and-bundle-lightening/127-VERIFICATION.md — FOUND
