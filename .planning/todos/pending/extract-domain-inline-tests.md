---
created: 2026-05-23T00:00:00.000Z
title: Extract domain inline tests to mirrored tests/ tree
area: rust-architecture
resolves_phase: 90
priority: high
files:
  - crates/rlm-core/src/domain/recursion/prompt_utilities.rs
  - crates/rlm-core/src/domain/recursion/budget_guard.rs
  - crates/rlm-core/src/domain/recursion/execution_graph_sync.rs
  - crates/rlm-core/src/domain/recursion/tool_round_loop.rs
  - crates/rlm-core/src/domain/recursion/quality_loop.rs
---

## Problem

Five `domain/recursion/` modules contain inline `#[cfg(test)]` blocks that clutter production source and diverge from the TypeScript test layout (`tests/domain/recursion/`).

## Solution

1. Create `crates/rlm-core/tests/domain/recursion/` mirroring `src/domain/recursion/`.
2. Move test bodies out of each source file into the mirrored path.
3. Use `#[cfg(test)] #[path = "..."] mod …;` stubs at the bottom of source files where tests need private access; use integration-style tests only where public API suffices.
4. Add shared fixtures under `crates/rlm-core/tests/helpers/` as needed (mirror `tests/helpers/` in TS).
5. Do **not** reorganize existing flat integration tests (`graph_executor_routes.rs`, etc.) in this todo.

## Acceptance checks

- No test logic remains inside `src/domain/**/*.rs` (only optional thin `#[path]` module declarations).
- `node scripts/cargo-with-ram-gate.mjs -- cargo test -p rlm-core -- domain` passes.
- `npm run check:rust:boundaries` — no new baseline entries; domain still has zero persistence/adapters imports.
- `quality_loop.rs` source line count reduced (split module body if extraction alone is insufficient).

## Order of extraction (smallest first)

1. `budget_guard.rs`
2. `prompt_utilities.rs`
3. `execution_graph_sync.rs`
4. `tool_round_loop.rs`
5. `quality_loop.rs` (largest; may pair with module split)
