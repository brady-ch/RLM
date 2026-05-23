---
created: 2026-05-23T00:00:00.000Z
title: Phase 79-02 — Canvas visual polish (A + Radix menu)
priority: high
phase: 79-shell-boundaries-context-menu
plan: 79-02
resolves_phase: 83
requirements: []
files:
  - ui/src/shared/tokens.css
  - ui/src/styles.css
  - ui/src/canvas/GraphCanvas.tsx
  - ui/src/nodes/ExecutionNodeCard.tsx
  - ui/src/nodes/NodeContextMenu.tsx
  - package.json
---

## Problem

Canvas and node cards still use the green composer prototype aesthetic. Context menu is hand-rolled with basic a11y. Operator wants Figma/Miro polish without adopting full shadcn.

## Solution

Implement `.planning/phases/79-shell-boundaries-context-menu/79-UI-SPEC.md`:

- **Option A** — token + CSS canvas/card polish
- **Radix** — `@radix-ui/react-context-menu` for node actions menu

## Checklist

### Setup

- [ ] Add `@radix-ui/react-context-menu` to root `package.json`
- [ ] Read `79-UI-SPEC.md` and preview sketch at `.planning/sketches/ui-polish-preview/`

### Tokens

- [ ] Update `ui/src/shared/tokens.css` — neutral canvas palette, `--radius-lg`, shadow tokens
- [ ] Verify focus-visible styles still meet a11y on inputs/buttons

### Canvas

- [ ] Apply dot-grid background to canvas region in `styles.css` / `GraphCanvas.tsx`
- [ ] Tune React Flow `Background` to avoid double-grid clash
- [ ] Update edge default stroke to `#cbd5e1`

### Node cards

- [ ] Remove dark `#1f2937` header — light header + status chips per spec
- [ ] Replace border-color status with chips + left accent for running
- [ ] Apply card shadow, hover lift, selected ring per spec
- [ ] Restyle prompt textarea (light bg, focus ring)
- [ ] Keep replan gate, quality-loop, ports functional — restyle only

### Context menu (Radix)

- [ ] Rewrite `NodeContextMenu.tsx` with Radix ContextMenu primitives
- [ ] Preserve all Plan/Run/Graph/Advanced items and disabled rules
- [ ] Add lucide icons per menu item
- [ ] Wire ⋮ button and keyboard triggers through Radix trigger
- [ ] Keep `GraphActionModal` unchanged for graph actions
- [ ] Remove obsolete `.node-context-menu` CSS after Radix styles applied

### Verify

- [ ] `npm run build:ui`
- [ ] `npm test` — shell-boundaries subset passes
- [ ] `npm run lint -- ui/src/nodes ui/src/canvas`
- [ ] Manual: right-click, ⋮, keyboard menu on node; all actions work
- [ ] Compare live UI to preview sketch

### Docs

- [ ] Write `79-02-PLAN.md` + `79-02-VERIFICATION.md` when executing via `/gsd-plan-phase` or `/gsd-execute-phase`
- [ ] Update `79-VERIFICATION.md` or add 79-02 verification row if ratcheting

## Out of scope

- Advanced hub visual refresh
- Run panel / top bar restyle
- Radix Dialog for GraphActionModal
- shadcn full adoption
- Backend/API changes

## References

- `.planning/notes/ui-canvas-visual-polish-decision.md`
- `.planning/phases/79-shell-boundaries-context-menu/79-UI-SPEC.md`
- `.planning/sketches/ui-polish-preview/`
