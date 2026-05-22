---
phase: 60-tauri-in-process-packaging
plan: 01
status: human_needed
score: 3/4
verified: 2026-05-22
---

# Phase 60 Verification

## Must-Haves

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Tauri embeds Rust server in-process, no Node child | ✓ |
| 2 | Release bundle scripts stage Rust binary + ui-dist only | ✓ |
| 3 | Linux `.deb` smoke passes | ⏭ human_needed |
| 4 | End-to-end desktop workflows on Rust runtime | ⏭ human_needed |

## Human Verification

- Build Tauri desktop on Linux host with `libwebkit2gtk`, `libdbus`, `glib` dev packages
- Run `npm run package:linux` (or project equivalent) and install `.deb`
- Confirm graph authoring, execution, session, model library, plugin panel against Rust server

## Notes

- Tauri crate uses standalone workspace (not in root workspace) to keep `check:rust` lean
- Ollama readiness check surfaces explicit error when host unavailable
