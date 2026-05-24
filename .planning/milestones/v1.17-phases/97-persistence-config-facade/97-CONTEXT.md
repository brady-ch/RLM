# Phase 97: Persistence Config Facade - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Move config loaders behind persistence facade/port; drop `no-persistence-to-application` baseline entry. `persistence/config.rs` currently re-exports `application::config` — config resolution should be owned by persistence layer.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Prefer moving config loader modules into `persistence/` (or persistence-owned facade) over adding another indirection layer. Preserve public API via `persistence::load_project_config` and `LoadedProjectConfig` re-exports. Match v1.14–v1.16 patterns: minimal diff, boundary ratchet, no behavior change.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `crates/rlm-core/src/application/config/` — loader, yaml_merge, validation, defaults (5 modules)
- `crates/rlm-core/src/persistence/config.rs` — thin re-export (1 line, baseline violation)
- Callers use `crate::persistence::{load_project_config, LoadedProjectConfig}` (bootstrap, control_server, tests)

### Established Patterns
- v1.16 memory block: extract/split with facade re-exports
- Boundary baseline in `scripts/rust-boundary-baseline.json` — remove entry when arc eliminated
- `#[path]` test stubs for private access (deferred to Phase 98+ for config tests)

### Integration Points
- `application/bootstrap/cli_runtime.rs` — loads config via persistence
- `control_server/mod.rs` — loads config via persistence
- `plugins/registry/service.rs` — uses `LoadedProjectConfig` via persistence
- `rlm-core` lib re-exports config types from persistence

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Success = zero `no-persistence-to-application` baseline entry, behavior unchanged, tests pass.

</specifics>

<deferred>
## Deferred Ideas

- Config loader test extraction — Phase 96 handled application config tests; persistence config tests deferred if any remain inline after move
- Crate split (`rlm-domain` / `rlm-ports`) — post-v1.17

</deferred>
