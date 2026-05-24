---
title: Rust Infrastructure Layer Architecture Pass
planted_date: 2026-05-24
trigger_condition: "When v1.16 completes (Phases 92–96) AND zero inline test bodies remain in src/application/"
status: active
---

## Intent

Third incremental layer of the Rust architecture pass: extract inline tests from `persistence/`, `adapters/`, and `plugins/`; split oversized infrastructure modules; ratchet `scripts/rust-boundary-baseline.json` to zero.

## Milestone

**v1.17 Rust Infrastructure Layer** — Phases 97–112

## Sequencing

1. **Persistence block (97–103)** — config boundary first, then dependency-ordered test extraction
2. **Adapters block (104–105)** — quick wins before plugin boundary work
3. **Plugins block (106–112)** — tool result consolidation first, then runtime/registry boundaries, then test extraction

See `.planning/notes/rust-infrastructure-layer-decomposition.md` for per-phase details.

## Progress

| Phase | Focus | Status |
|-------|-------|--------|
| 97 | `persistence/config.rs` boundary | Planned |
| 98–102 | persistence test extraction chain | Planned |
| 103 | `memory_store.rs` full split | Planned |
| 104–105 | adapters test extraction | Planned |
| 106 | tool result → ports | Planned |
| 107 | runtime + registry boundaries | Planned |
| 108–112 | remaining plugin test extraction | Planned |

## Boundary baseline targets

| Rule | Module | Phase |
|------|--------|-------|
| `no-persistence-to-application` | `persistence/config.rs` | 97 |
| `no-plugins-to-domain` (×4) | builtin tools | 106 |
| `no-plugins-to-application` | `plugins/runtime.rs` | 107 |
| `no-plugins-to-persistence` | `plugins/registry/service.rs` | 107 |

## Out of scope

- Flat integration test reorganization (`crates/rlm-core/tests/*.rs`)
- Optional crate split (A6)
- `control_server/routes.rs` split

## Success criteria

- Zero inline test bodies in infrastructure layers
- Empty boundary baseline (strict mode passes)
- `cargo test -p rlm-core` green

## References

- `.planning/notes/rust-infrastructure-layer-decomposition.md`
- `.planning/todos/pending/phase-{97..112}-*.md`
- `.planning/seeds/rust-application-layer-architecture-pass.md` (predecessor)
