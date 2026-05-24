---
title: Rust Graph Executor Decomposition
date: 2026-05-24
context: "/gsd-explore — Phase 91 paired pass; readability-first application layer architecture"
---

# Rust Graph Executor Decomposition

**Date:** 2026-05-24  
**Context:** `/gsd-explore` — application layer paired pass starting with `application/graph/executor.rs`

## Decision

Split `executor.rs` **by concern**, not by execution lifecycle. At ~583 lines the file is a split candidate but not a monolith; lifecycle modules (plan/run/resume/cancel) would be thin and awkwardly coupled.

## Target module layout

| Module | Contents | ~Lines after extraction |
|--------|----------|-------------------------|
| `execution_order.rs` | `topological_execution_order`, empty-graph/cycle errors | ~75 |
| `run_state_sync.rs` | `persist_run_state_status`, `persist_resume_cursor`, `prepare_run_state`, `apply_resume_to_session`, `execution_status_label` | ~60 |
| `executor.rs` (slimmed) | `GraphExecutorInput`, error types, `execute_graph` loop, `build_execution_prompt`, `collect_ancestors`, `has_failed_ancestor`, `should_skip_status` | ~250–300 |

Re-export public items from `application/graph/mod.rs` to preserve existing import paths (`execute_graph`, `topological_execution_order`, etc.).

## Test layout (mirror TypeScript)

| Target path | Source |
|-------------|--------|
| `tests/application/graph/execution_order.rs` | Inline topo-order test from `executor.rs` |
| `tests/application/graph/executor.rs` | Inline `execute_graph_completes_single_pass_nodes` |
| `tests/application/graph/executor_resume.rs` | **New** — resume/skip-completed behavior (TS: `graph-executor-resume.test.ts`; Rust lacks coverage today) |

Use `#[path]` stubs in source where tests need private access. Do **not** reorganize flat `crates/rlm-core/tests/graph_executor_routes.rs` in this pass.

## Deferred

- `run_single_pass_node` / `run_rlm_node` extraction from the main loop — only if slimmed `executor.rs` remains >350 lines
- Prompt/ancestor helpers as separate module — keep in `executor.rs` unless a second pass is needed
- Deduplicating topo/cycle tests between mirrored tree and `graph_executor_routes.rs`

## References

- `.planning/notes/rust-architecture-test-layout-strategy.md`
- `.planning/seeds/rust-application-layer-architecture-pass.md`
- `.planning/todos/pending/phase-91-graph-executor-paired-pass.md`
- TS analogues: `src/application/graph/graph-executor.ts`, `tests/application/graph/graph-executor*.test.ts`
