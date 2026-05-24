---
created: 2026-05-24T00:00:00.000Z
title: Phase 94 — semantic_memory_index paired test extraction
area: rust-architecture
resolves_phase: 94
priority: high
depends_on: phase-93-session-memory-bridge-paired-pass
files:
  - crates/rlm-core/src/application/memory/semantic_memory_index.rs
  - crates/rlm-core/tests/application/memory/semantic_memory_index.rs
---

## Problem

`semantic_memory_index.rs` (328 lines) embeds tests and couples embedding + ANN retrieval.

## Solution

Extract tests to mirrored path. Optional split: `index_status` types vs core `SemanticMemoryIndex` if file remains >300 lines.

## Acceptance checks

- No inline test bodies in source
- `cargo test -p rlm-core -- application/memory/semantic` passes
- No new boundary baseline entries
