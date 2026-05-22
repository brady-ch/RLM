---
phase: 60-tauri-in-process-packaging
plan: 01
subsystem: packaging
tags: [tauri, desktop, rust-only, packaging]

requirements-completed: [PACK-01, PACK-02]
requirements-partial: [PACK-03, REG-01]

duration: 90min
completed: 2026-05-22
---

# Phase 60 Plan 01: Tauri In-Process + Packaging Summary

**Tauri embeds Rust control server in-process; release scripts stage Rust-only bundle.**

## Accomplishments

- `src-tauri/src/main.rs` — in-process `start_server`, window close shutdown, Ollama check
- `build-release.mjs` / `smoke-release.mjs` — Rust binary + ui-dist layout
- Standalone Tauri workspace (excluded from root `check:rust`)

## Limitations

- Full desktop `.deb` smoke requires Linux GUI build deps — human verification pending
- REG-01 end-to-end UI workflows not automated in CI

## Self-Check: PARTIAL

- `npm run check:rust` green (rlm-core + rlm-cli)
- Tauri build not run in WSL (missing glib/dbus pkg-config)
