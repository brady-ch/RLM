---
created: 2026-05-24T00:00:00.000Z
title: Phase 96 — config loader paired test extraction
area: rust-architecture
resolves_phase: 96
priority: medium
depends_on: phase-95-memory-resolver-paired-pass
files:
  - crates/rlm-core/src/application/config/loader.rs
  - crates/rlm-core/tests/application/config/loader.rs
---

## Problem

`config/loader.rs` (225 lines) has inline tests; completes application-layer test extraction scope from seed.

## Solution

Extract tests to `tests/application/config/loader.rs` (mirror TS `tests/application/config/`). No split unless loader exceeds ~300 lines after extraction.

## Acceptance checks

- No inline test bodies in `src/application/config/loader.rs`
- `cargo test -p rlm-core -- application/config` passes
- Zero inline test bodies across all `src/application/` (full application pass complete)
- No new boundary baseline entries
