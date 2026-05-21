---
phase: 24
status: resolved
blocked_at: 2026-05-20
resolved_at: 2026-05-21
requirements:
  - PROD-01
  - PROD-02
  - PROD-03
---

# Phase 24 Blocker: Native Linux Tauri Dependencies

## Status

Resolved. The required Linux Tauri dependencies are now available in the environment, and `npm run tauri:build` produced a Linux `.deb`.

## Blocker

`npm run tauri:build` could not complete because required Linux system development packages were missing and non-interactive sudo was unavailable.

Observed failure:

```text
pkg-config --libs --cflags glib-2.0 'glib-2.0 >= 2.70'
Package 'glib-2.0', required by 'virtual:world', not found
The file `glib-2.0.pc` needs to be installed and the PKG_CONFIG_PATH environment variable must contain its parent directory.
```

Additional missing `pkg-config` packages observed:

- `glib-2.0`
- `gtk+-3.0`
- `webkit2gtk-4.1`

## Required Action

Install Linux Tauri build dependencies:

```bash
sudo apt-get update
sudo apt-get install -y libglib2.0-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

Then rerun:

```bash
npm run tauri:build
```

This now passes in the current environment.

## Work Completed Before Blocker

- Staged release now bundles the packaging host's Node runtime and package smoke executes it.
- Tauri setup resolves bundled release resources.
- Tauri setup runs the Ollama readiness helper before launching the UI server.
- Tauri setup starts packaged `rlm ui` as an app-managed child process.
- Tauri redirects the webview to the reported localhost control-server URL.
- Tauri closes the RLM-managed child process on native window close.
- `npm run package:smoke` passes.
- `npm test` passes with 149/149 tests.
