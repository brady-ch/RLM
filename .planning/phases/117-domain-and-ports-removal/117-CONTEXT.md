# Phase 117: Domain and Ports Removal - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure — autonomous --auto)

<domain>
Delete `src/domain/` and `src/ports/`. Rust domain/ports in rlm-core are sole implementation.

</domain>

<decisions>
### Claude's Discretion
Follow 113-AUDIT.md. cargo test -p rlm-core must pass. Prune tests/domain/ and tests that import deleted modules.

</decisions>

<code_context>
Phase 116 removes application layer. domain/ports are next inner layer per teardown order.

</code_context>

<specifics>
ROADMAP: delete src/domain/, src/ports/; cargo test green; no orphaned imports.

</specifics>

<deferred>
None.
</deferred>
