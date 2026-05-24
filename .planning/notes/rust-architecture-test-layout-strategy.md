---
title: Rust Architecture & Test Layout Strategy
date: 2026-05-23
context: "/gsd-explore — readability-driven test extraction and incremental layer architecture pass"
---

# Rust Architecture & Test Layout Strategy

**Date:** 2026-05-23  
**Context:** `/gsd-explore` — post-v1.13; v1.13 shipped. Builds on `.planning/notes/rust-architecture-improvement-plan.md` (Wave 2 structural work) with concrete test-layout and sequencing decisions.

## Problem

Production Rust source files in `crates/rlm-core/src/` carry inline `#[cfg(test)]` modules (~29 files today). This hurts **readability** — scrolling past test setup and assertions to reach implementation logic.

## Target layout

Mirror the TypeScript concern map, **per crate**:

```text
crates/rlm-core/tests/domain/recursion/prompt_utilities.rs
crates/rlm-core/tests/application/graph/executor.rs
crates/rlm-core/tests/helpers/…
```

Align naming with TS where modules overlap (e.g. `prompt_utilities.unit.rs` ↔ `tests/domain/recursion/prompt-utilities.unit.test.ts`).

**Not in scope for first slice:** reorganizing existing flat integration files (`crates/rlm-core/tests/graph_executor_routes.rs`, `recursive_engine_session.rs`, etc.). Those stay flat until a later pass.

## Architecture scope (holistic, incremental execution)

| Concern | In scope |
|---------|----------|
| Test extraction | Move inline tests to mirrored `tests/` tree |
| Module splits | Oversized files (`quality_loop.rs`, `executor.rs`, etc.) |
| Boundary cleanup | Ratchet `scripts/rust-boundary-baseline.json` per layer |
| Refactors for testability | Smaller modules, clearer ports at layer edges |

## Sequencing — incremental by layer

1. **Domain** (first) — `domain/recursion/` inline tests (~5 modules); strictest boundaries; pure policy
2. **Application** — `application/graph/`, `memory/`, `config/` inline tests
3. **Persistence / adapters / plugins** — remaining inline tests

Each layer completes test extraction + targeted splits + boundary ratchet before the next layer starts.

## Rust-specific: private item access

Extracted tests that need **private** functions cannot live as standard integration tests (they only see the public crate API). Options per module:

| Approach | When |
|----------|------|
| `#[path = "../../../tests/domain/..."]` include from `#[cfg(test)] mod` | Default for unit tests needing private access; keeps tests in mirrored tree |
| Integration test against public API only | Behavior-level tests; no private hooks |
| `pub(crate)` test-only exports | Last resort; document and gate behind `cfg(test)` feature if needed |

Prefer `#[path]` includes over widening visibility.

## Domain-first inventory (inline tests today)

| Source module | Target test path |
|---------------|------------------|
| `domain/recursion/prompt_utilities.rs` | `tests/domain/recursion/prompt_utilities.rs` |
| `domain/recursion/budget_guard.rs` | `tests/domain/recursion/budget_guard.rs` |
| `domain/recursion/execution_graph_sync.rs` | `tests/domain/recursion/execution_graph_sync.rs` |
| `domain/recursion/tool_round_loop.rs` | `tests/domain/recursion/tool_round_loop.rs` |
| `domain/recursion/quality_loop.rs` | `tests/domain/recursion/quality_loop.rs` (+ consider module split) |

## Success criteria (domain slice)

- Zero inline test bodies in `src/domain/` (only thin `#[path]` stubs if needed)
- Mirrored `tests/domain/` tree exists and passes `cargo test -p rlm-core`
- No new boundary baseline entries; domain remains free of persistence/adapters imports
- Source files measurably shorter (especially `quality_loop.rs`)

## References

- `.planning/notes/rust-architecture-improvement-plan.md` — Wave 2 structural phases A1–A6
- `.planning/notes/architecture-boundary-cleanup-direction.md`
- `AGENTS.md` — Rust concern map and boundary rules
- TypeScript mirror: `tests/domain/`, `tests/application/`, `tests/helpers/`
