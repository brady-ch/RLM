# Phase 90 Plan 01 Summary

**Completed:** 2026-05-23  
**Plan:** 90-01 — Extract Domain Recursion Inline Tests

## Delivered

- Created `crates/rlm-core/tests/domain/recursion/` with five extracted test files
- Replaced inline `#[cfg(test)] mod tests` blocks with thin `#[path]` stubs in all five domain recursion modules
- All 18 domain recursion unit tests pass via `cargo test -p rlm-core --lib domain::recursion`
- Flat integration tests at `crates/rlm-core/tests/*.rs` unchanged

## Files changed

| Source (stub only) | Extracted test file |
|--------------------|---------------------|
| `budget_guard.rs` | `tests/domain/recursion/budget_guard.rs` |
| `prompt_utilities.rs` | `tests/domain/recursion/prompt_utilities.rs` |
| `execution_graph_sync.rs` | `tests/domain/recursion/execution_graph_sync.rs` |
| `tool_round_loop.rs` | `tests/domain/recursion/tool_round_loop.rs` |
| `quality_loop.rs` | `tests/domain/recursion/quality_loop.rs` |

## Line count impact

| Module | Before | After (source) |
|--------|--------|----------------|
| budget_guard.rs | 98 | 44 |
| prompt_utilities.rs | 190 | 91 |
| execution_graph_sync.rs | 69 | 35 |
| tool_round_loop.rs | 540 | 341 |
| quality_loop.rs | 1532 | 1467 |

## Deferred

- `quality_loop.rs` module split (still large; test extraction alone insufficient for ARCH-90-06)
- Application layer pass per seed
