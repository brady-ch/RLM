# Phase 119: npm Toolchain and CI Rust-Only Cleanup - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure — autonomous --auto)

<domain>
Strip TS build deps from package.json; keep Vite/UI toolchain. Rust-only CI gates. Remove depcruise TS rules if src/ gone.

</domain>

<decisions>
### Claude's Discretion
Keep ui/ build scripts. Remove tsc, ts-node, dependency-cruiser for src/ if applicable. Update CI workflows.

</decisions>

<code_context>
package.json still has TS runtime build after phase 118. AGENTS.md needs rust-only update.

</code_context>

<specifics>
ROADMAP: npm toolchain rust-only; CI green; UI still builds with Vite.

</specifics>

<deferred>
None.
</deferred>
