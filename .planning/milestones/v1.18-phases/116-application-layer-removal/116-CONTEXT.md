# Phase 116: Application Layer Removal - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — autonomous --auto)

<domain>
## Phase Boundary

Delete entire `src/application/` tree. Rust application layer in `crates/rlm-core/src/application/` is sole implementation. Do not delete domain/ports/adapters yet (Phase 117+).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Follow 113-AUDIT.md. After deletion, `cargo test -p rlm-core` must pass. Transitional broken imports in remaining TS (bootstrap references) expected until later phases — focus on removing application layer cleanly.

</decisions>

<code_context>
## Existing Code Insights

- `src/application/` contains execution, graph, memory, config, bootstrap, plugins facades
- Rust mirrors under `crates/rlm-core/src/application/`
- Phases 114-115 removed control server and cli/runtime

</code_context>

<specifics>
## Specific Ideas

ROADMAP success criteria:
1. `src/application/` deleted
2. `cargo test -p rlm-core` passes
3. No remaining TS imports of deleted application modules in kept files (or document exceptions)

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
