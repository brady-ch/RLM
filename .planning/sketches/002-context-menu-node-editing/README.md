---
sketch: 002
name: context-menu-node-editing
question: "Card editing + context menus — with or without a right panel on select?"
winner: B
tags: [context-menu, node-card, node-dock, interaction]
---

# Sketch 002: Context Menu + Node Editing

## Design Question

Given context menus for actions and prompt editing on cards, should clicking a node open a right panel?

## How to View

```bash
# Server at .planning/sketches (port 8765)
open http://127.0.0.1:8765/002-context-menu-node-editing/index.html
```

**Try:** Right-click any node · Click nodes to select · Switch A/B/C tabs

## Variants

- **A: Card + context menu only** — Full canvas; edit on card; no panel on click
- **B: Card + slim Run panel ★ Selected** — Edit on card; panel opens for approve/clarify only
- **C: Card summary + full edit panel** — Card is read-only summary; panel has all fields

## What to Look For

- Does right-click feel natural for Plan/Approve/Delete?
- Is Variant B's Run panel useful without feeling like the old sidebar?
- Does Variant C duplicate too much between card and panel?
