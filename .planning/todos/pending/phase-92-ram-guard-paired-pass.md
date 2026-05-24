---
created: 2026-05-24T00:00:00.000Z
title: Phase 92 — ram_guard paired test extraction and module split
area: rust-architecture
resolves_phase: 92
priority: high
files:
  - crates/rlm-core/src/application/memory/ram_guard.rs
  - crates/rlm-core/src/application/memory/ram_probe.rs
  - crates/rlm-core/src/application/memory/ram_budget.rs
  - crates/rlm-core/src/application/memory/ram_eligibility.rs
  - crates/rlm-core/src/application/memory/ollama_ram.rs
  - crates/rlm-core/src/application/memory/mod.rs
  - crates/rlm-core/tests/application/memory/ram_budget.rs
  - crates/rlm-core/tests/application/memory/ram_eligibility.rs
---

## Problem

`ram_guard.rs` (426 lines) mixes host probing, budget math, eligibility policy, and Ollama HTTP with inline tests.

## Solution

Per `.planning/notes/rust-memory-block-decomposition.md` — four extracted modules + facade; tests to mirrored tree.

## Acceptance checks

- `ram_probe`, `ram_budget`, `ram_eligibility`, `ollama_ram` extracted; facade preserves public API
- No test logic in source files (thin `#[path]` stubs only)
- `cargo test -p rlm-core -- application/memory/ram` passes
- No new boundary baseline entries
