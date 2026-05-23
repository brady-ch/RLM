---
title: UI Canvas Visual Polish Decision
date: "2026-05-23"
context: "/gsd-explore — Figma/Miro canvas polish + Radix context menu"
phase: 79-shell-boundaries-context-menu
plan: 79-02
---

# UI Canvas Visual Polish Decision

**Date:** 2026-05-23  
**Source:** `/gsd-explore` + Superpowers brainstorming  
**Preview:** `.planning/sketches/ui-polish-preview/` (http://127.0.0.1:8765/)

## Problem

Phase 61–79 delivered functional shell boundaries and a working context menu, but the canvas still reads as a **green composer prototype** rather than a **canvas-first product** (Figma/Miro reference). Visual gaps:

| Issue | Detail |
|-------|--------|
| Canvas | Green-tinted background (`#eef2ef`); no dot grid |
| Node cards | Dark header bar (`#1f2937`); status via heavy 2px borders |
| Context menu | Hand-rolled positioning; basic grouped sections; limited keyboard/a11y |
| Spec drift | Phase 61 UI-SPEC says "inherit Phase 11/30 tokens — no new palette"; visual direction was never updated for product polish |

Functional requirements (SHEL-02–04) are complete. This decision covers **visual polish only** — no HTTP/SSE or shell layout changes.

## Decision (locked)

| Area | Direction |
|------|-----------|
| **Canvas styling** | **Option A** — tokens + CSS only; no shadcn, no full component library |
| **Context menu** | **Radix** — `@radix-ui/react-context-menu` for a11y, keyboard nav, focus trap |
| **Visual reference** | Figma/Miro — neutral dot grid, white floating cards, soft shadows, status chips |
| **Scope (v1)** | Canvas + node cards + context menu only; Advanced hub chrome deferred |
| **Roadmap** | **79-02** addendum to Phase 79 (functional 79-01 already shipped) |

Rejected for v1:

- Full shadcn adoption (Option B) — too much scope; two visual systems risk
- Green composer palette retention — conflicts with Figma/Miro canvas-first goal
- Radix Dialog for `GraphActionModal` — defer; modals work today

## Rationale

**Why A for canvas:** Miro/Figma polish is achieved with tokens, shadows, and layout CSS on existing React Flow nodes. No new dependencies; aligns with Phase 61 hand-rolled path.

**Why Radix for menu only:** Context menu is the highest-interaction surface after the card itself. Radix gives arrow-key navigation, typeahead, and focus management without adopting a full design system. Phase 79 already wired all menu actions — swap presentation layer only.

**Why fold into 79:** Context menu and canvas cards are one visual unit; shipping Radix menu without canvas polish would feel inconsistent. 79-02 keeps SHEL-02 traceability.

## Token shifts (summary)

| Token | Current | Target |
|-------|---------|--------|
| `--color-bg` | `#eef2ef` | `#f5f5f5` |
| `--color-card` | `#fbfcfd` | `#ffffff` |
| `--color-accent` | `#2d6cdf` | `#4262ff` (or keep `#2d6cdf` — pick one in 79-UI-SPEC) |
| Node header | Dark bar | Light header + status chip |
| Node status | Border color | Chip + subtle left accent for running |
| Canvas | Solid fill | Dot grid via CSS `background-image` |

## Success criteria

1. Canvas uses neutral dot-grid background; cards appear to float above it
2. Node cards use light headers with status chips; no `#1f2937` header bar
3. Context menu uses Radix; all Phase 79 menu actions still work; keyboard accessible
4. `npm run build:ui` and existing shell-boundaries tests pass
5. Preview sketch at `ui-polish-preview` matches implemented look within reasonable tolerance

## References

- `.planning/sketches/ui-polish-preview/` — interactive comparison (winner: Miro canvas + Radix menu tab)
- `.planning/milestones/v1.8-phases/61-ui-shell-rewrite/61-UI-SPEC.md` — shell layout (unchanged)
- `.planning/phases/79-shell-boundaries-context-menu/79-UI-SPEC.md` — visual contract for 79-02
- `ui/src/nodes/NodeContextMenu.tsx` — Radix migration target
