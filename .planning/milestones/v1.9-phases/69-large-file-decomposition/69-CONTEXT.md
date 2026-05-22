# Phase 69: Large File Decomposition — Context

**Gathered:** 2026-05-22  
**Status:** Ready for planning  
**Source:** Infrastructure/refactor phase — discuss skipped; derived from ROADMAP goal, ARCH-04, REG-02, and v1.6 Phases 37/40 TS analogues

<domain>
## Phase Boundary

Behavior-preserving decomposition of four oversized Rust modules into focused submodules:

1. `domain/recursive_language_model.rs` (~1,289 LOC) — peel remaining orchestrator surface not already in `domain/recursion/` (Phase 63).
2. `application/execution/session_graph.rs` (~945 LOC) — split graph mutation, layout, planning, and quality-loop session controls.
3. `plugins/registry_service.rs` (~699 LOC) — split types, catalog/allowlist I/O, install, and doctor flows.
4. `persistence/config.rs` (~465 LOC) — move implementation into `application/config/` mirroring TS loader/validation/defaults/yaml-merge separation (v1.6 Phase 37).

Out of scope: Rust boundary script and AGENTS.md concern map (Phase 70); workspace crate split (Phase 71); algorithm or API behavior changes; full `npm run check:rust` gate (deferred to milestone close).

**Prerequisite:** Phase 68 application layer + handler split must land first (`application/execution/`, `application/config/` facade exists).

</domain>

<decisions>
## Implementation Decisions

### Strangler refactor (D-01)
- Extract modules incrementally; run targeted integration tests after **each** extraction slice (ROADMAP success criterion 3).
- Preserve all public paths via `mod.rs` / crate-root re-exports — no import churn for `rlm-cli` or integration tests beyond path fixes from Phase 68.

### Config mirror (D-02)
- Split `persistence/config.rs` into `application/config/{defaults,yaml_merge,validation,loader,mod}.rs` matching TS module boundaries (`defaults`, `yaml-merge`, `validation`, `loader`).
- `persistence/config.rs` becomes thin re-export forwarding to `application::config` (ARCH-04 criterion 2).
- Rust has no runtime-resolution/model-override modules yet — do not invent resolver splits beyond what exists in the monolith.

### RLM orchestrator peel (D-03)
- `domain/recursion/*` (budget_guard, tool_round_loop, quality_loop, execution_graph_sync, prompt_utilities) stays untouched — only shrink `recursive_language_model.rs`.
- Convert `recursive_language_model.rs` to directory module `domain/recursive_language_model/` with: `execution_control`, `engine_state`, `engine_hosts`, `execution_bridge`, `orchestrator_phases`, `solve_tree`, and slim `mod.rs` retaining `run()` top-level flow.

### Session graph layout (D-04)
- Convert `session_graph.rs` to `session_graph/{mod,mutations,nodes,layout,planning}.rs` under `application/execution/`.
- Keep `impl InteractiveExecutionSession` blocks split by concern; shared private helpers stay in the submodule that owns them.

### Registry layout (D-05)
- Convert `registry_service.rs` to `plugins/registry/{mod,types,catalog,allowlist,install,doctor,service}.rs`.
- Public DTOs and `PluginRegistryService` API unchanged.

### Regression gate (D-06)
- Targeted tests only per extraction (match Phases 66–68 REG-02 pattern):
  - Config: `persistence_dual_read`, `persistence::config` unit tests
  - Registry: `plugin_registry`, `plugin_routes`
  - Session graph: `preview_mutation`, `recursive_engine_session`, `chat_routes`, `graph_executor_routes`
  - RLM: `recursive_engine_session`, `quality_loop_parity`
- Plus `cargo check -p rlm-core -p rlm-cli` after each plan.
- Full workspace clippy/test suite deferred to milestone close.

### Claude's Discretion
- Exact line boundaries within each submodule layout above.
- Whether to use `pub(crate)` vs private submodules for cross-slice helpers.

</decisions>

<canonical_refs>
## Canonical References

### TypeScript decomposition analogues
- `.planning/milestones/v1.6-phases/37-config-layer-split/` — loader/validation/defaults/yaml-merge split
- `.planning/milestones/v1.6-phases/40-domain-engine-decomposition/` — incremental RLM peel with host facades

### Rust current monoliths
- `crates/rlm-core/src/domain/recursive_language_model.rs`
- `crates/rlm-core/src/execution/session_graph.rs` → post-68: `application/execution/session_graph.rs`
- `crates/rlm-core/src/plugins/registry_service.rs`
- `crates/rlm-core/src/persistence/config.rs`

### Prior phase handoff
- `.planning/phases/68-application-layer-handler-split/68-CONTEXT.md` — config facade stub, deferred decomposition list

</canonical_refs>

<deferred>
## Deferred Ideas

- Full `npm run check:rust` / workspace clippy gate — milestone close
- `application/config` resolver modules (host-resolution, runtime-resolution) — no Rust implementation exists yet
- Rust boundary enforcement — Phase 70
- Workspace crate split — Phase 71
- Simultaneous RLM algorithm fixes — log as separate todos/commits

</deferred>

---

*Phase: 69-large-file-decomposition*  
*Context gathered: 2026-05-22 — infrastructure phase, discuss skipped*
