---
title: Rust Crate Split
planted_date: 2026-05-22
trigger_condition: "When Wave 2 structural work (A1–A4) stabilizes module boundaries AND cargo test/check iteration routinely exceeds team tolerance — e.g. full rlm-core test suite >2–3 min on dev machines, or frequent merge conflicts on unrelated modules due to single-crate rebuild fan-out"
status: archived
archived_date: 2026-05-24
shipped_in: "Phase 71 (v1.9 Optional Crate Split); re-eval triggers remain in seed body"
---

## Intent

Split the monolithic `rlm-core` crate (~16k LOC) into smaller workspace members so domain logic compiles and tests without pulling Axum, Tokio full stack, and persistence adapters — improving iteration speed and enforcing dependency direction at the Cargo level.

## Current baseline

| Crate | Role |
|-------|------|
| `rlm-core` | Everything: domain, ports, adapters, persistence, control server, plugins, interop |
| `rlm-cli` | Thin CLI over `rlm-core` |
| `src-tauri` | Embeds server via `rlm-core` |

Boundary violations today are caught only by convention (no Rust depcruise until A5).

## Proposed split (when triggered)

```text
rlm-ports      — traits only (LanguageModel, Tool, Trace, store ports)
rlm-domain     — recursive engine, types, recursion helpers; depends on rlm-ports
rlm-core       — application, adapters, persistence, control_server, plugins, interop
rlm-cli        — unchanged dependency on rlm-core
```

Optional later: `rlm-persistence` if adapter test isolation still hurts compile times.

## Prerequisites

- A1 complete: store ports defined, domain free of concrete persistence
- A2 complete: application layer clear; `lib.rs` re-exports stable
- A5 complete: boundary script validates before crate boundaries harden

## Success criteria

- `cargo test -p rlm-domain` runs domain/recursion tests without linking Axum
- `rlm-cli` and Tauri public API unchanged (same `rlm_core::` re-exports or thin facade)
- Workspace `cargo test` total time reduced vs pre-split baseline (measure on CI)

## Out of scope

- Splitting before functional debt (Wave 1) closes — behavior parity first
- Publishing crates to crates.io

## References

- `.planning/notes/rust-architecture-improvement-plan.md`
- `.planning/todos/pending/rust-structural-architecture-wave2.md`
