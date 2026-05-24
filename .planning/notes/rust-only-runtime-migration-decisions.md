---
title: Rust-Only Runtime Migration Decisions
date: 2026-05-24
context: /gsd-explore — retire Node runtime after Rust parity
---

## Decision summary

| Area | Direction |
|------|-----------|
| **Node runtime** | Delete entire `src/` tree and npm CLI entry — Rust (`rlm-cli` / `rlm-core`) is the sole implementation |
| **UI** | Keep React — Vite builds static assets; Rust control server and Tauri serve them (no Node at runtime) |
| **Cutover strategy** | Incremental — remove TS modules concern-by-concern as Rust tests and golden fixtures cover each surface |
| **Tool calling (now)** | Existing Rust two-phase Ollama path is sufficient for cutover |
| **Tool calling (later)** | Constrained JSON-envelope decoding (Phase 120) — post-cutover hardening, not a blocker |

## Prerequisites (already shipped)

- Axum control server with golden-fixture parity (`control_server_matches_golden_fixtures`)
- Tauri in-process Rust server (no Node child)
- Parallel engine: `tool_round_loop`, builtin tools, plugin registry, graph executor
- `RLM_RUNTIME=rust` dispatch via `scripts/rlm-runtime.mjs`

## Incremental teardown order

Outer transport and composition first, inner policy last:

1. **Audit & gates (113)** — inventory TS-only paths; define verification per layer (inventory: `.planning/phases/113-node-runtime-retirement-audit-and-cutover-gates/113-AUDIT.md`)
2. **Control server (114)** — `src/application/control-server/`, TS UI bootstrap, parity scripts that boot TS server
3. **CLI & composition (115)** — `src/index.ts`, `src/cli/`, `src/runtime/`, default `npm rlm` → Rust binary
4. **Application (116)** — `src/application/` (execution, graph, memory, config, bootstrap)
5. **Domain & ports (117)** — `src/domain/`, `src/ports/`
6. **Adapters & plugins (118)** — `src/adapters/`, `src/plugins/`, mirrored `tests/` for TS runtime
7. **npm toolchain (119)** — strip TS build deps; keep Vite/UI toolchain; Rust-only CI gates
8. **Constrained envelope (120)** — Option A from `TOOL-CALLING-CONSTRAINED-DECODING.md` in Rust only

## Explicitly kept

- `ui/` — React source + Vite config
- `scripts/` — packaging, RAM gates, Rust boundary checks (prune Node-specific scripts per phase)
- `crates/` — sole runtime
- `package.json` — UI build + Tauri scripts only after Phase 119

## Verification gates (per phase)

- `cargo test -p rlm-core` green after each deletion step
- Golden fixtures remain Rust-only (no TS server boot in CI)
- `RLM_UI_DIST=ui/dist cargo run -p rlm-cli -- ui` serves UI against Rust APIs
- Tauri dev/build smoke after control-server and CLI phases

## Out of scope for v1.18

- React UI rewrite
- Deleting Vite/npm entirely (UI still builds with Node dev tooling)
- Python Outlines sidecar or vLLM adapters
- Fine-tuning / HF training paths

## References

- `.planning/notes/rust-runtime-migration-direction.md` — earlier architecture direction (2026-05-22)
- `.planning/research/TOOL-CALLING-CONSTRAINED-DECODING.md` — Phase 120 envelope spec
- `.planning/seeds/node-runtime-retirement.md` — milestone seed
- Milestone **v1.18 Node Runtime Retirement** — Phases 113–120
