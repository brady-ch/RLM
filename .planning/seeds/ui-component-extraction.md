---
title: UI Component Extraction
planted_date: 2026-05-22
trigger_condition: "When v1.8 milestone audit/archive completes, or when UI sidebar breakage blocks REG-01 / desktop UAT sign-off on the Rust runtime"
status: archived
archived_date: 2026-05-24
shipped_in: "Phase 61 (v1.8 UI Shell Rewrite); continued in v1.19 Phases 121–128"
---

## Intent

Restructure `ui/src/main.tsx` (~3,000-line monolith) into a node-centric shell: minimal workflow view (canvas + optional node dock) and full-screen Advanced hub for models, plugins, sessions, memory, and power-user settings.

## Why now

- v1.8 kept UI unchanged during Rust migration; sidebar stacks every subsystem and is reported broken
- Phase 11/30 UI contracts were never applied as component architecture
- Backend HTTP/SSE contract is frozen — frontend-only restructure with low integration risk

## Target outcome

| Before | After |
|--------|-------|
| Single scrollable 380px sidebar | Canvas + context menus + Run panel on select (Variant B) |
| Prompt edit in inspector | Prompt edit inline on node card |
| Plan/approve buttons everywhere | Plan/graph via context menu; approve/clarify in Run panel |
| All panels load on mount | Advanced hub: domain views fetch on mount |
| One file owns all UI | `app/`, `canvas/`, `nodes/`, `run-panel/`, `advanced/`, `shared/` |

## Success signals

- Workflow view shows no global panels (models/plugins/sessions/memory)
- Prompt editable on node card; plan actions via context menu
- Run panel visible on select only; shows approve/clarify — no edit fields
- Advanced hub full-screen with Back to workflow
- REG-01 workflows pass on Rust-served UI
- `main.tsx` under ~50 lines (entry only)

## Dependencies

- Phase 60 complete (Rust runtime + Tauri in-process)
- No new control-server endpoints required for shell split (existing `/api/*`)

## Risks

| Risk | Mitigation |
|------|------------|
| Sidebar fix attempts recreate same layout | Enforce boundary rules in plan-phase; sketch winner as reference |
| SSE/session state lost on view switch | Server-authoritative session; client routing only |
| Scope creep (redesign + new features) | YAGNI — extract and relocate existing panels first |

## Related

- Note: `.planning/notes/ui-shell-architecture.md`
- Phase 61: UI Shell Rewrite
- Sketch: `.planning/sketches/002-context-menu-node-editing/` (winner B)
