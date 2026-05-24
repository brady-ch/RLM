# Phase 90: Rust Domain Layer Architecture & Test Extraction - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning
**Mode:** Auto-generated (`/gsd-autonomous --auto`)

<domain>
## Phase Boundary

Extract inline `domain/recursion/` tests to mirrored `crates/rlm-core/tests/domain/` tree; improve source readability without boundary regressions. Leave flat integration tests unchanged.

</domain>

<decisions>
## Implementation Decisions

### Test placement
Per-crate mirrored tree: `crates/rlm-core/tests/domain/recursion/{module}.rs` aligned with TypeScript `tests/domain/recursion/`.

### Private access strategy
Use `#[cfg(test)] #[path = "../../../tests/domain/recursion/{module}.rs"] mod {module}_tests;` stubs in source — no `pub(crate)` widening.

### Scope limits
- Extract all five domain/recursion inline test modules only
- Do not reorganize existing flat integration tests at `crates/rlm-core/tests/*.rs`
- No application/persistence layer work in this phase

### Module split
Extract tests from `quality_loop.rs` first; module split only if file remains unwieldy after extraction (~1531 lines — extraction removes ~70 lines; split deferred unless needed).

### Verification
`cargo test -p rlm-core` + `npm run check:rust:boundaries` — no new baseline entries.

</decisions>

<code_context>
## Existing Code Insights

Five inline `#[cfg(test)]` modules in `crates/rlm-core/src/domain/recursion/`:
- `budget_guard.rs` (~57 lines tests)
- `prompt_utilities.rs` (~102 lines tests)
- `execution_graph_sync.rs` (~37 lines tests)
- `tool_round_loop.rs` (~202 lines tests, async + mocks)
- `quality_loop.rs` (~68 lines tests)

Strategy doc: `.planning/notes/rust-architecture-test-layout-strategy.md`

</code_context>

<specifics>
## Specific Ideas

Extraction order: smallest first (budget_guard → prompt_utilities → execution_graph_sync → tool_round_loop → quality_loop).

</specifics>

<deferred>
## Deferred Ideas

- Application layer pass (seed: rust-application-layer-architecture-pass)
- Reorganize flat integration tests into mirrored tree
- quality_loop.rs module split into submodules

</deferred>
