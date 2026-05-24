---
created: 2026-05-24T00:00:00.000Z
title: Phase 91 — graph executor paired test extraction and module split
area: rust-architecture
resolves_phase: 91
priority: high
files:
  - crates/rlm-core/src/application/graph/executor.rs
  - crates/rlm-core/src/application/graph/execution_order.rs
  - crates/rlm-core/src/application/graph/run_state_sync.rs
  - crates/rlm-core/src/application/graph/mod.rs
  - crates/rlm-core/tests/application/graph/execution_order.rs
  - crates/rlm-core/tests/application/graph/executor.rs
  - crates/rlm-core/tests/application/graph/executor_resume.rs
---

## Problem

`application/graph/executor.rs` (~583 lines) mixes graph ordering, run-state persistence, and orchestration in one file with inline tests at the bottom — hurting readability and diverging from the TypeScript test layout.

## Solution

Paired pass per `.planning/notes/rust-executor-decomposition.md`:

1. Extract `execution_order.rs` and `run_state_sync.rs` from `executor.rs`.
2. Slim `executor.rs` to orchestration + prompt/ancestor helpers.
3. Move inline tests to `tests/application/graph/` (mirrored tree).
4. Add `executor_resume.rs` tests for resume/skip-completed behavior.
5. Preserve public re-exports from `application/graph/mod.rs`.

## Acceptance checks

- No test logic in `src/application/graph/executor.rs` (thin `#[path]` stubs only).
- `executor.rs` ≤ ~300 lines; new modules each focused on one concern.
- `node scripts/cargo-with-ram-gate.mjs -- cargo test -p rlm-core -- application/graph` passes.
- `npm run check:rust:boundaries` — no new baseline entries.
- Flat integration test `crates/rlm-core/tests/graph_executor_routes.rs` untouched.

## Out of scope

- Memory and config application modules (follow in Phase 92+ or subsequent paired passes).
- Node dispatch (`single-pass` vs `rlm`) extraction unless executor still >350 lines after first split.
- Reorganizing flat integration tests at `crates/rlm-core/tests/*.rs`.
