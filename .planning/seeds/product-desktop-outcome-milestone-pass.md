---
title: Product Desktop & Run Outcome Milestone
planted_date: 2026-05-24
trigger_condition: "When v1.19 completes (Phase 128 UI simplification UAT signed) AND Rust-only runtime is default"
status: active
---

## Intent

Ship RLM as a **product**: Tauri desktop app, folder-scoped runs with picker/switcher, installable executable with plugins, and a **Run Outcome** experience — live node outputs, streamed final synthesis, artifacts with diff preview.

## Milestone

**v1.20 Product Desktop & Run Outcome** — Phases 129–135

## Phase map

| Phase | Focus |
|-------|-------|
| 129 | Node output capture (Rust data model) |
| 130 | Live node output (UI run panel) |
| 131 | End-of-run synthesis + SSE (Rust) |
| 132 | Outcome panel + streaming final answer (UI) |
| 133 | Artifact tracking + diff/snippet |
| 134 | Folder launcher + project switcher (Tauri) |
| 135 | Desktop packaging + bundled plugins |

## Depends on

- v1.18 — Rust-only runtime (Phases 113–120)
- v1.19 — UI simplification (Phases 121–128)

## Success criteria (milestone)

- User installs desktop app without Node/npm
- User picks folder at launch; can switch folder in-app
- Run completes → Outcome panel shows streamed final answer
- Partial failures → best-effort answer with gap callouts
- File-writing tools → artifacts listed with diff/snippet
- Per-node output visible on graph selection during and after run

## References

- `.planning/notes/product-run-outcome-spec.md`
- `.planning/notes/product-desktop-productization-decisions.md`
- `.planning/todos/pending/phase-{129..135}-*.md`
