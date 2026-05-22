---
phase: 60-tauri-in-process-packaging
plan: 01
status: partial
score: 2/4
verified: 2026-05-22
---

# Phase 60 Verification

## Must-Haves

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Tauri embeds Rust server in-process; no Node child (PACK-01) | ✓ |
| 2 | Release bundle has no bundled Node; Rust binary + ui-dist (PACK-02) | ✓ |
| 3 | Linux `.deb` install smoke (PACK-03) | human_needed |
| 4 | Full UI workflow regression on Rust runtime (REG-01) | human_needed |

## Test Results

- `npm run check:rust` — PASS
- `cargo test -p rlm-core` — PASS
- `npm run package:smoke` — PASS
- `cargo build` in `src-tauri/` — BLOCKED on this runner (missing `libdbus-1-dev` for Tauri GTK stack)

## Human Needed

1. **PACK-03:** On a Linux desktop runner with Tauri deps installed, run `npm run tauri:build` and verify `.deb` installs and launches with in-process server
2. **REG-01:** Manual UAT — graph authoring, execution, session save/reopen, model library, plugin panel against Rust-served UI

## Limitations Documented

- Rust-mode `ask`/workflow/session CLI still requires `RLM_RUNTIME=node`
- Session readiness JSON shape differs from TS on draft graphs (see Phase 59 VERIFICATION)
- MCP interop remains stub; external ESM plugins deferred (INFR-02)
- Ollama must be reachable at `OLLAMA_HOST` (default `http://127.0.0.1:11434`) or set `RLM_MANAGE_OLLAMA=1`
