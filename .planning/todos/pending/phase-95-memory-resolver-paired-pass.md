---
created: 2026-05-24T00:00:00.000Z
title: Phase 95 — memory_resolver paired test extraction
area: rust-architecture
resolves_phase: 95
priority: high
depends_on: phase-94-semantic-memory-index-paired-pass
files:
  - crates/rlm-core/src/application/memory/memory_resolver.rs
  - crates/rlm-core/tests/application/memory/memory_resolver.rs
---

## Problem

`memory_resolver.rs` (347 lines) implements `MemoryContextPort` with inline tests; depends on `SemanticMemoryIndex`.

## Solution

Extract tests to mirrored path. Module split likely unnecessary — focus on test extraction unless file exceeds ~350 lines after move.

## Acceptance checks

- No inline test bodies in source
- `cargo test -p rlm-core -- application/memory/memory_resolver` passes
- No new boundary baseline entries
