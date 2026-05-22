# Phase 68: Application Layer + Handler Split — Context

**Gathered:** 2026-05-22  
**Status:** Ready for planning  
**Source:** Infrastructure/refactor phase — discuss skipped; derived from ROADMAP goal, ARCH-02/ARCH-03, and v1.6/v1.7 TypeScript concern grouping

<domain>
## Phase Boundary

Restructure `rlm-core` so the Rust module tree mirrors v1.6/v1.7 TypeScript concern grouping:

1. Introduce `application/` grouping for execution, graph, memory, config, and bootstrap facades (ARCH-02).
2. Split monolithic `control_server/routes.rs` (~1,580 lines) into concern-based `handlers/` modules; `routes.rs` becomes transport-only router wiring (ARCH-03).

Behavior-preserving refactor only — endpoint paths, JSON shapes, and error vocabulary unchanged. Large file decomposition (`recursive_language_model.rs`, `session_graph.rs`, `registry_service.rs`, full config loader split) is Phase 69.

Out of scope: `AGENTS.md` Rust concern map, `check-rust-boundaries`, workspace crate split (Phases 70–71); full `npm run check:rust` gate (deferred to milestone close — targeted route/compile tests in plans only, per autonomous run policy).

</domain>

<decisions>
## Implementation Decisions

### Application layer grouping (D-01)
- Add `crates/rlm-core/src/application/mod.rs` with submodules: `execution`, `graph`, `memory`, `config`, `bootstrap`.
- Move existing `execution/`, `graph/`, `memory/`, `bootstrap/` directories under `application/` (physical move, not copy).
- `application/config/` is a **facade** re-exporting `load_project_config`, `LoadedProjectConfig`, and related types from `persistence::config` — do not split config implementation (Phase 69).
- Keep `domain/`, `ports/`, `adapters/`, `persistence/`, `plugins/`, `interop/`, `model_library/`, `control_server/`, `server/` at crate root.
- Preserve crate-root re-exports in `lib.rs` (`rlm_core::execution::*`, etc.) so `rlm-cli` and integration tests need minimal import churn.

### Strangler pattern (D-02)
- Move implementations first, then fix imports (`crate::execution` → `crate::application::execution`).
- Match v1.7 Phase 45 TS pattern: concern folders + root facades for backward compatibility.

### Handler split layout (D-03)
- Add `control_server/handlers/` mirroring TS `src/application/control-server/handlers/`:
  - `graph.rs` — graph snapshot, layout, viewport
  - `nodes.rs` — all `/api/nodes/*` mutations
  - `workflows.rs` — graph-workflows list/export/import
  - `session.rs` — session, run-mode, saved-sessions
  - `memory.rs` — memory inspect and preferences
  - `chat.rs` — chat, clarifications, stop, pause-auto-approvals
  - `model_library.rs` — model-library routes
  - `plugins.rs` — plugin registry routes
  - `events.rs` — SSE events stream
  - `static_ui.rs` — UI fallback / placeholder
  - `common.rs` — shared helpers (`snapshot_with_extra`, `spawn_graph_execution`, `parse_replan`)
- `routes.rs` retains only `build_router` with `.route(...)` wiring and handler imports.
- No handler module exceeds ~400 lines (ROADMAP success criterion 3).

### Regression gate (D-04)
- Targeted verification only: `cargo test -p rlm-core` for route integration tests (`chat_routes`, `plugin_routes`, `model_library_routes`, `graph_executor_routes`, `persistence_control_server`) plus `cargo check -p rlm-core -p rlm-cli`.
- Full `npm run check:rust` deferred to milestone close (match Phases 66–67 REG-02 pattern).

### Claude's Discretion
- Exact handler file boundaries within the layout above (e.g. whether `spawn_graph_execution` lives in `common.rs` vs `workflows.rs`).
- Whether to add thin `mod.rs` re-exports at old paths (`execution/mod.rs` stub) vs updating all call sites — prefer updating call sites + `lib.rs` facades.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### TypeScript reference layout
- `src/application/execution/` — execution concern grouping (v1.7 Phase 45)
- `src/application/graph/` — graph concern grouping
- `src/application/memory/` — memory concern grouping
- `src/application/config/` — config facade (v1.6 Phase 37)
- `src/application/bootstrap/` — bootstrap facade (v1.7 Phase 44)
- `src/application/control-server/handlers/` — handler split (v1.6 Phase 41)
- `src/application/control-server/route-request.ts` — transport-only dispatch

### Rust current state
- `crates/rlm-core/src/lib.rs` — crate module tree and public re-exports
- `crates/rlm-core/src/control_server/routes.rs` — monolithic handlers (~1,580 lines)
- `crates/rlm-core/src/control_server/mod.rs` — `RouterState` and router builder
- `.planning/notes/rust-architecture-improvement-plan.md` — Wave 2 A2/A3 scope

### Prior phase patterns
- `.planning/milestones/v1.7-phases/45-application-concern-grouping/45-01-PLAN.md` — TS strangler grouping
- `.planning/milestones/v1.6-phases/41-control-server-boundary/41-CONTEXT.md` — handler split boundary

</canonical_refs>

<deferred>
## Deferred Ideas

- Full config loader/validation/resolver split (`persistence/config.rs` → `application/config/*`) — Phase 69
- Large module decomposition (`recursive_language_model.rs`, `session_graph.rs`, `registry_service.rs`) — Phase 69
- Rust boundary enforcement script and AGENTS.md concern map — Phase 70
- Workspace crate split (`rlm-ports`, `rlm-domain`) — Phase 71
- Full `npm run check:rust` / clippy workspace gate — milestone close

</deferred>

---

*Phase: 68-application-layer-handler-split*  
*Context gathered: 2026-05-22 — infrastructure phase, discuss skipped*
