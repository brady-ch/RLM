---
created: 2026-05-24T00:00:00.000Z
title: Phase 98 — persistence util test extraction
area: rust-architecture
resolves_phase: 98
priority: high
depends_on: phase-97-persistence-config-facade
files:
  - crates/rlm-core/src/persistence/util.rs
  - crates/rlm-core/tests/persistence/util.rs
---

## Problem

`persistence/util.rs` (95 lines) has inline tests.

## Solution

Extract tests to `tests/persistence/util.rs`; thin `#[path]` stub if private access needed.

## Acceptance checks

- No inline test bodies in source
- `cargo test -p rlm-core -- persistence/util` passes
- No new boundary baseline entries
