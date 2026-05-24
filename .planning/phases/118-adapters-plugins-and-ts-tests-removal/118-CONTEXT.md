# Phase 118: Adapters, Plugins, and TS Tests Removal - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure — autonomous --auto)

<domain>
Delete `src/adapters/`, `src/plugins/`, and mirrored TS runtime tests. Rust adapters/plugins in rlm-core remain.

</domain>

<decisions>
### Claude's Discretion
Follow 113-AUDIT.md. This removes remaining src/ runtime code except any stragglers. Prune tests/adapters/, tests/plugins/, tests/integration TS runtime tests.

</decisions>

<code_context>
After phase 117, only adapters/plugins remain in src/ tree.

</code_context>

<specifics>
ROADMAP: delete adapters, plugins, TS tests; cargo test green; src/ tree empty or minimal.

</specifics>

<deferred>
None.
</deferred>
