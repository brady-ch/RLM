---
phase: 24
plan: 01
title: Native Desktop Runtime Lifecycle Closure
status: completed
completed: 2026-05-21
requirements:
  - PROD-01
  - PROD-02
  - PROD-03
---

# Phase 24-01 Summary

Implemented the native desktop runtime lifecycle closure for v1.3.

## Delivered

- Added bundled Node runtime release staging so packaged launchers do not depend on user-installed Node/npm for the built platform.
- Added release smoke checks for bundled runtime metadata, executable Node runtime, and Ollama helper runtime path.
- Added Tauri runtime lifecycle code that resolves bundled release resources, runs the Ollama readiness helper, starts packaged `rlm ui`, redirects the webview to the reported localhost URL, and stops the managed RLM child on window close.
- Added a generated Tauri app icon required by `tauri::generate_context!`.
- Updated Tauri bundling to include `dist/release/` resources and run `npm run package:build` before native packaging.
- Documented Linux Tauri build prerequisites and the managed runtime behavior.

## Tests

- `npm run package:smoke`
- `npm run tauri:build`
- `timeout 5 dist/release/linux-x64/rlm ui --ui-port 45678`
- `dist/release/linux-x64/bin/node dist/release/linux-x64/ensure-ollama.mjs`
- `npm test`

## Residual Notes

- Linux native build produced a `.deb`; Windows/macOS installers were not built in this Linux workspace.
- Full GUI runtime smoke was not executed because this environment has no headless display runner and no local Ollama endpoint. The packaged UI server and explicit Ollama failure path were smoke-tested instead.

