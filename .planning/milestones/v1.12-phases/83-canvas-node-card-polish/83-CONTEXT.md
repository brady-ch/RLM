# Phase 83 Context: Canvas & Node Card Polish

**Phase:** 83 — Canvas & Node Card Polish  
**Milestone:** v1.12 UI Canvas Visual Polish  
**Requirements:** CANV-01, CANV-02, CANV-04

## Goal

Match 79-UI-SPEC Figma/Miro aesthetic: neutral dot-grid canvas, light node card headers with status chips, themed MiniMap/handles/controls in both themes.

## Decisions

| Area | Decision |
|------|----------|
| Canvas | Radial dot grid via CSS on `.react-flow`; `--color-canvas-dot` token |
| Node header | Light surface (`var(--color-card)`) — no dark `#1f2937` bar |
| Status chips | Per-status token pairs (`--chip-*-bg/text`) |
| MiniMap | `.graph-minimap` uses surface + border tokens |

## References

- `.planning/milestones/v1.11-phases/79-shell-boundaries-context-menu/79-UI-SPEC.md`
