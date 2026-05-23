---
sketch: ui-polish-preview
name: canvas-visual-polish-comparison
question: "How should canvas + node cards look for Figma/Miro polish — and CSS-only vs Radix menu?"
winner: miro-canvas-radix-menu
tags: [canvas, node-card, context-menu, visual-polish, figma-miro]
phase: 79-02
created: "2026-05-23"
---

# Sketch: Canvas Visual Polish Comparison

## Design Question

Given the locked Phase 61 shell, what visual treatment makes the canvas feel product-grade (Figma/Miro reference), and should the context menu use hand-rolled CSS or Radix?

## Decision (2026-05-23)

**Winner:** Miro-style canvas (Option A — CSS/tokens) + Radix context menu (Hybrid tab)

- Neutral dot-grid canvas, white floating cards, status chips, soft shadows
- Radix for context menu a11y; no full shadcn

See `.planning/notes/ui-canvas-visual-polish-decision.md` and `79-UI-SPEC.md`.

## How to View

```bash
python3 -m http.server 8765 --directory .planning/sketches/ui-polish-preview
# open http://127.0.0.1:8765/
```

**Try:**

1. **A vs Miro polish** — side-by-side current vs target canvas
2. **C — Hybrid + Radix menu** — selected direction (A canvas + Radix menu styling)
3. Hover node cards on the Miro panel for lift/shadow

## Variants

| Tab | Meaning |
|-----|---------|
| A vs Miro polish | Left: current green composer · Right: CSS-only Figma/Miro target |
| C — Hybrid + Radix menu | Miro canvas + Radix-style menu (icons, sections, keyboard hints) |
| Live app note | Commands for Rust-served UI and Vite dev |

## What to Look For

- Does the neutral dot grid feel like a planning board?
- Do white cards with chips read clearer than border-colored status?
- Is the Radix menu tab worth the dependency vs plain CSS menu?

## Implementation

Spec: `.planning/phases/79-shell-boundaries-context-menu/79-UI-SPEC.md`  
Todo: `.planning/todos/pending/79-02-canvas-visual-polish.md`
