---
created: 2026-05-24T00:00:00.000Z
title: Phase 93 — session_memory_bridge paired test extraction
area: rust-architecture
resolves_phase: 93
priority: high
depends_on: phase-92-ram-guard-paired-pass
files:
  - crates/rlm-core/src/application/memory/session_memory_bridge.rs
  - crates/rlm-core/tests/application/memory/session_memory_bridge.rs
---

## Problem

`session_memory_bridge.rs` (258 lines) has inline tests and persistence-facing serialization helpers.

## Solution

Extract tests to `tests/application/memory/session_memory_bridge.rs`. Optional split into payload vs vector-index section modules if still cluttered.

## Acceptance checks

- No inline test bodies in source
- `cargo test -p rlm-core -- application/memory/session` passes
- No new boundary baseline entries
