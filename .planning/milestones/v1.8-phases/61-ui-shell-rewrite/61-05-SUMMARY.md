---
phase: 61-ui-shell-rewrite
plan: 05
subsystem: ui
tags: [advanced-hub, lazy-fetch]
requires:
  - phase: 61-02
    provides: advanced view routing
provides:
  - AdvancedHub and five domain views
affects: [61-ui-shell-rewrite]
key-files:
  created:
    - ui/src/advanced/AdvancedHub.tsx
    - ui/src/advanced/ModelsView.tsx
    - ui/src/advanced/PluginsView.tsx
    - ui/src/advanced/SessionsView.tsx
    - ui/src/advanced/MemoryView.tsx
    - ui/src/advanced/SettingsView.tsx
    - ui/src/legacy/panels.tsx
  modified:
    - ui/src/app/AppShell.tsx
requirements-completed: [UI-SC-01, UI-SC-04]
duration: 20min
completed: 2026-05-22
---

# Phase 61 Plan 05: Advanced hub Summary

**Full-screen Advanced hub with Models/Plugins/Sessions/Memory/Settings; domain APIs fetch on sub-tab mount only.**

## Task Commits

1. **Advanced hub + panel relocation** - `4cb6bee` (feat)

## Self-Check: PASSED

- ui/src/advanced/AdvancedHub.tsx: FOUND
