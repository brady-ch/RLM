---
created: 2026-05-24T00:00:00.000Z
title: Phase 112 — builtin web tools test extraction
area: rust-architecture
resolves_phase: 112
priority: medium
depends_on: phase-111-builtin-shell-test-extraction
files:
  - crates/rlm-core/src/plugins/builtin/web_fetch.rs
  - crates/rlm-core/src/plugins/builtin/web_search.rs
  - crates/rlm-core/tests/plugins/builtin/web_fetch.rs
  - crates/rlm-core/tests/plugins/builtin/web_search.rs
---

## Problem

`web_fetch.rs` (200 lines) and `web_search.rs` (232 lines) have inline tests — final v1.17 phases.

## Solution

Extract tests to mirrored paths for both web builtins in one phase (shared web category).

## Acceptance checks

- No inline test bodies in either source file
- `cargo test -p rlm-core -- plugins/builtin/web` passes
- Zero inline test bodies across `src/persistence/`, `src/adapters/`, `src/plugins/`
- `scripts/rust-boundary-baseline.json` empty
- v1.17 milestone complete
