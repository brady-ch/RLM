---
phase: 23
plan: 01
title: Desktop Release Staging
status: completed
completed: 2026-05-20
requirements:
  - PROD-01
  - PROD-02
  - PROD-03
---

# Phase 23-01 Summary

Implemented desktop release staging for v1.3.

## Delivered

- Staged CLI build output, UI static assets, Unix/Windows shims, desktop manifest, and Ollama readiness helper under `dist/release/<platform>-<arch>/`.
- Added `scripts/desktop/ensure-ollama.mjs` to detect an existing Ollama endpoint or start `ollama serve` when `RLM_MANAGE_OLLAMA=1`.
- Added `scripts/packaging/smoke-release.mjs` and wired `npm run package:smoke`.
- Added Tauri v2 shell configuration under `src-tauri/` with `npm run tauri:dev` and `npm run tauri:build` entry points.
- Documented package contents, native shell commands, and Ollama behavior in `docs/DESKTOP.md`.

## Tests

- `npm run package:smoke`
- `npm test`

Native Tauri build was not executed in this environment; release-folder smoke coverage verifies the staged desktop bundle.
