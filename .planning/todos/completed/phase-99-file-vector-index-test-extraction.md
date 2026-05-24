---
created: 2026-05-24T00:00:00.000Z
title: Phase 99 — file vector index test extraction
area: rust-architecture
resolves_phase: 99
priority: high
depends_on: phase-98-persistence-util-test-extraction
files:
  - crates/rlm-core/src/persistence/file_vector_index.rs
  - crates/rlm-core/tests/persistence/file_vector_index.rs
---

## Problem

`persistence/file_vector_index.rs` (134 lines) has inline tests.

## Solution

Extract tests to mirrored path. Test extraction only unless file exceeds ~300 lines after move.

## Acceptance checks

- No inline test bodies in source
- `cargo test -p rlm-core -- persistence/file_vector` passes
- No new boundary baseline entries
