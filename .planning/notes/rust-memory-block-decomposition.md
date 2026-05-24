---
title: Rust Application Memory Block Decomposition
date: 2026-05-24
context: "/gsd-explore — Phases 92–96; memory block + config loader after Phase 91 executor"
---

# Rust Application Memory Block Decomposition

**Date:** 2026-05-24  
**Context:** `/gsd-explore` — application layer readability; memory as one block then config

## Sequencing decision

Memory modules run as **Phases 92–95** in dependency order, then **Phase 96** for config loader:

| Phase | Module | Lines | Depends on |
|-------|--------|-------|------------|
| 92 | `ram_guard.rs` | 426 | — (standalone) |
| 93 | `session_memory_bridge.rs` | 258 | persistence stores |
| 94 | `semantic_memory_index.rs` | 328 | persistence, adapters |
| 95 | `memory_resolver.rs` | 347 | `SemanticMemoryIndex` |
| 96 | `config/loader.rs` | 225 | — |

Each phase uses the **paired pass** pattern from Phase 91: extract tests + split modules where natural seams exist.

## Phase 92 — `ram_guard.rs` (full split)

Split by concern, not lifecycle:

| Module | Contents |
|--------|----------|
| `ram_probe.rs` | `is_wsl`, `current_free_ram_mb` |
| `ram_budget.rs` | config parsing, `available_model_ram_mb`, `validate_memory_budget`, `peak_runtime_model_ram_mb`, `configured_model_names`, `estimate_model_ram_mb` |
| `ram_eligibility.rs` | `RamSnapshot`, `ModelRamEligibility`, `ram_snapshot`, `model_ram_eligibility`, sync `assert_*`, `resource_guard_json` |
| `ollama_ram.rs` | `ollama_loaded_ram_mb`, `unload_ollama_models`, async `assert_*` |
| `ram_guard.rs` | Re-export facade (or re-export from `memory/mod.rs`) |

Tests (no TS mirror — Rust-only concern):

| Target | Coverage |
|--------|----------|
| `tests/application/memory/ram_budget.rs` | `validate_memory_budget` |
| `tests/application/memory/ram_eligibility.rs` | fixed-cap blocking, ollama-loaded budget reduction |

Preserve public API via `application/memory/mod.rs` re-exports.

## Phases 93–95 — lighter paired passes

Split only if file remains hard to scan after test extraction:

| Phase | Optional split | Test target |
|-------|----------------|-------------|
| 93 `session_memory_bridge` | `payload_helpers` vs `vector_index_section` | `tests/application/memory/session_memory_bridge.rs` |
| 94 `semantic_memory_index` | `index_status` types vs core index | `tests/application/memory/semantic_memory_index.rs` |
| 95 `memory_resolver` | test extraction only (likely) | `tests/application/memory/memory_resolver.rs` |

TS analogues: `tests/application/memory/session-memory-bridge.test.ts` (no dedicated ram_guard or resolver tests in TS).

## Phase 96 — `config/loader.rs`

Quick paired pass after memory block:

- Extract inline tests → `tests/application/config/loader.rs`
- Split only if loader exceeds ~300 lines after extraction (defer `yaml_merge.rs` / `validation.rs` — no inline tests today)

## Shared constraints

- Use `#[path]` stubs for tests needing private access
- Do **not** reorganize flat integration tests at `crates/rlm-core/tests/*.rs`
- `npm run check:rust:boundaries` — no new baseline entries per phase
- Verify: `node scripts/cargo-with-ram-gate.mjs -- cargo test -p rlm-core -- application/{memory,config}`

## References

- `.planning/notes/rust-architecture-test-layout-strategy.md`
- `.planning/notes/rust-executor-decomposition.md`
- `.planning/seeds/rust-application-layer-architecture-pass.md`
