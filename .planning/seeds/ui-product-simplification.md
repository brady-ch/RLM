---
title: UI Product Simplification
planted_date: 2026-05-24
trigger_condition: "When v1.18 Node Runtime Retirement completes (Phase 120) AND UI runs on Rust-only stack"
status: active
---

## Intent

Prune the React UI to match locked product vision: canvas-first graph workflow, minimal workflow chrome, Advanced hub for power features, Figma/Miro visual polish. Delete or demote surfaces that don't serve graph authoring. Reduce code weight (AppShell, styles.css, bundle).

## Milestone

**v1.19 UI Product Simplification** — Phases 121–128

## Sequencing

1. **Audit block (121)** — score all surfaces; produce keep/demote/delete cut list
2. **Feature block (122–123)** — Advanced pruning, workflow simplification
3. **Code block (124–127)** — CSS split, AppShell decomposition, inspector slim-down, lazy routes
4. **Verification (128)** — UAT sign-off on Rust-only stack

See `.planning/notes/ui-product-simplification-decisions.md` for audit framework.

## Progress

| Phase | Focus | Status |
|-------|-------|--------|
| 121 | UI vision audit & cut list | Planned |
| 122 | Advanced hub pruning | Planned |
| 123 | Workflow view simplification | Planned |
| 124 | Styles & token consolidation | Planned |
| 125 | AppShell state decomposition | Planned |
| 126 | Node inspector & settings slim-down | Planned |
| 127 | Lazy routes & bundle lightening | Planned |
| 128 | UI simplification UAT & sign-off | Planned |

## Success criteria

- Workflow view: canvas + top bar + Run panel on select only
- No mount-time fetches for models/plugins/memory on workflow view
- AppShell owns graph/session/routing; Advanced owns domain state
- Bundle size reduced; `npm run build:ui` green
- Operator UAT signed on simplified UI

## References

- `.planning/notes/ui-product-simplification-decisions.md`
- `.planning/notes/ui-shell-architecture.md`
- `.planning/todos/pending/phase-{121..128}-*.md`
