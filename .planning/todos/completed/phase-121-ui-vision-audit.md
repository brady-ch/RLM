---
created: 2026-05-24T00:00:00.000Z
title: Phase 121 — UI vision audit and cut list
area: ui
resolves_phase: 121
priority: high
files:
  - ui/src/
  - .planning/notes/ui-product-simplification-decisions.md
---

## Problem

UI has functional shell boundaries (Phases 61–85) but still carries weight: god-component AppShell, monolithic CSS, power-user surfaces (chat refine, quality loop, deep inspector) that may not match graph-first product vision.

## Solution

Audit every UI surface against product-shell-entry-model, ui-shell-architecture, and ui-canvas-visual-polish decisions. Produce a scored cut list: keep / demote / delete per component.

## Acceptance checks

- Cut list document committed under phase directory or notes
- Every file under `ui/src/` mapped to a verdict
- Chat refine, quality loop, NodeInspector, WorkflowOverview explicitly scored
- Phase 122–127 tasks derive from cut list (no ad-hoc deletes)
