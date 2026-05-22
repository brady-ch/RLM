# Phase 61 — Context

**Source:** `/gsd-explore` + Superpowers brainstorming (2026-05-22)  
**Updated:** 2026-05-22 — Sketch 002 Variant **B** locked

## Problem

Monolithic `ui/src/main.tsx` (~3,000 lines) with scrollable sidebar stacking all subsystems. Broken UX on Rust runtime; diverges from Phase 11/30 node-centric contracts.

## Approved direction (locked)

| Surface | Behavior |
|---------|----------|
| **Workflow** | Full canvas + thin top bar; prompt editing on node cards |
| **Context menu** | Right-click node → Plan / Run / Graph actions |
| **Run panel** | Slim right panel on node select only — Approve, Skip, clarification |
| **Advanced hub** | Full-screen: Models · Plugins · Sessions · Memory · Settings |
| **Contract** | Same HTTP/SSE API; frontend restructure only |

## Sketch decisions

| Sketch | Winner |
|--------|--------|
| 001 workflow-advanced-shell | A — canvas + selective panel + Advanced takeover |
| 002 context-menu-node-editing | **B** — edit on card + context menu + slim Run panel |

## Artifacts

| Artifact | Path |
|----------|------|
| Architecture note | `.planning/notes/ui-shell-architecture.md` |
| UI design contract | `61-UI-SPEC.md` |
| Seed | `.planning/seeds/ui-component-extraction.md` |
| Sketches | `.planning/sketches/001-*`, `002-*` |

## Next step

`/gsd-plan-phase 61`
