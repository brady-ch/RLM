# Phase 82 Context: Theme System & Edge Contrast

**Phase:** 82 — Theme System & Edge Contrast  
**Milestone:** v1.12 UI Canvas Visual Polish  
**Requirements:** THEME-01, THEME-02, THEME-03, EDGE-01, EDGE-02, EDGE-03

## Goal

Add light/dark/system theme support with persisted preference and high-contrast React Flow edges in both modes. User pain point: graph connection lines were nearly invisible against the canvas.

## Decisions

| Area | Decision |
|------|----------|
| Theme storage | `localStorage` key `rlm-ui-theme`; values `light` / `dark` / `system` |
| FOUC prevention | Inline script in `ui/index.html` sets `data-theme` before paint |
| Toggle UX | TopBar button cycles system → light → dark → system |
| Tokens | Semantic CSS variables in `tokens.css` for light and `[data-theme="dark"]` |
| Edge contrast | `--edge-default` slate in light, light slate in dark; state colors for running/completed/failed |
| Edge animation | Animate only when target node status is `running` |

## Out of scope

- Full Advanced hub visual redesign (inherits surface tokens only)
- shadcn adoption

## References

- `.planning/research/SUMMARY.md`
- `.planning/todos/pending/79-02-canvas-visual-polish.md`
