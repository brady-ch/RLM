---
title: Rust Application Layer Architecture Pass
planted_date: 2026-05-23
trigger_condition: "When Phase 90 (domain layer test extraction + boundary ratchet) completes AND cargo test -p rlm-core domain/* is green with mirrored tests/domain/ layout"
status: archived
archived_date: 2026-05-24
shipped_in: "Phases 91–96 (v1.15–16)"
---

## Intent

Second incremental layer of the Rust architecture pass: extract inline tests from `application/` modules, split oversized orchestration files, and ratchet boundary baseline entries for application→persistence transitional imports.

## Progress

| Phase | Module | Status |
|-------|--------|--------|
| 91 | `application/graph/executor.rs` | ✅ Shipped v1.15 |
| 92 | `application/memory/ram_guard.rs` | 🚧 v1.16 — full split |
| 93 | `application/memory/session_memory_bridge.rs` | Planned |
| 94 | `application/memory/semantic_memory_index.rs` | Planned |
| 95 | `application/memory/memory_resolver.rs` | Planned |
| 96 | `application/config/loader.rs` | Planned — completes application pass |

## Sequencing

Memory block in **dependency order** (Phases 92–95), then config (Phase 96). Each phase uses paired pass: test extraction + split where natural.

See `.planning/notes/rust-memory-block-decomposition.md` for module split details.

## Out of scope (defer to layer 3)

- Persistence inline tests (`memory_store.rs`, `session_store.rs`, etc.)
- Adapter inline tests (`ollama_*.rs`)
- Plugin inline tests (`builtin/`, `manifest.rs`, `runtime.rs`)
- Reorganizing flat integration test files at `crates/rlm-core/tests/*.rs`

## Success criteria (full application pass — after Phase 96)

- Zero inline test bodies in `src/application/` (thin `#[path]` stubs only)
- Application boundary baseline count reduced or unchanged (no regressions)
- Oversized modules measurably shorter or split into focused submodules

## References

- `.planning/notes/rust-architecture-test-layout-strategy.md`
- `.planning/notes/rust-executor-decomposition.md`
- `.planning/notes/rust-memory-block-decomposition.md`
- `.planning/todos/pending/phase-{91,92,93,94,95,96}-*.md`
