# Sketch Manifest

## Design Direction

Minimal node-centric workflow: canvas is the product; a slim top bar for run control; node dock only when selected; all infrastructure (models, plugins, sessions, memory, power settings) on a separate full-screen Advanced hub. Light composer palette from Phase 11/30 (`#eef2ef` canvas, `#1f3d32` primary).

## Reference Points

- Phase 11 UI-SPEC — node composer anatomy, focused inspector
- Phase 30 UI-SPEC — plan-from-node primary, chat demoted
- Current pain: monolithic `ui/src/main.tsx` scrollable sidebar

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|-----------------|--------|------|
| 001 | workflow-advanced-shell | Does full canvas + node dock + Advanced takeover feel minimal enough? | A (recommended) | layout, shell, workflow, advanced |
| 002 | context-menu-node-editing | Card editing + context menus — panel on select or not? | **B** (card edit + ctx menu + slim Run panel) | context-menu, node-card, interaction |
