---
title: Node Runtime Retirement
planted_date: 2026-05-24
trigger_condition: "When v1.17 completes (Phases 97–112) AND Rust golden fixtures + UAT sign-off confirm TS server is redundant"
status: active
---

## Intent

Retire the entire Node runtime (`src/`, npm CLI entry) incrementally. Rust becomes the sole execution implementation; React UI remains as Vite static assets served by Rust/Tauri.

## Milestone

**v1.18 Node Runtime Retirement** — Phases 113–120

## Sequencing

1. **Audit block (113)** — cutover gates, TS-only inventory, flip default runtime to Rust
2. **Transport block (114–115)** — control server, CLI entry, runtime composition
3. **Logic block (116–118)** — application, domain/ports, adapters/plugins/tests
4. **Toolchain block (119)** — npm/CI Rust-only cleanup
5. **Hardening (120)** — constrained Ollama tool envelope (post-cutover)

See `.planning/notes/rust-only-runtime-migration-decisions.md` for per-phase scope.

## Progress

| Phase | Focus | Status |
|-------|-------|--------|
| 113 | Audit & cutover gates | Planned |
| 114 | Control server + UI bootstrap removal | Planned |
| 115 | CLI entry + runtime composition removal | Planned |
| 116 | Application layer removal | Planned |
| 117 | Domain & ports removal | Planned |
| 118 | Adapters, plugins, TS tests removal | Planned |
| 119 | npm toolchain + CI Rust-only | Planned |
| 120 | Constrained Ollama tool envelope | Planned |

## Success criteria

- No `src/` directory; no `dist/src/` CLI entry
- `npm rlm` invokes Rust binary by default
- UI builds via Vite; served by Rust control server or Tauri
- Desktop bundle contains no bundled Node runtime
- `cargo test -p rlm-core` + UI build green in CI

## References

- `.planning/notes/rust-only-runtime-migration-decisions.md`
- `.planning/seeds/constrained-ollama-tool-envelope.md`
- `.planning/todos/pending/phase-{113..120}-*.md`
