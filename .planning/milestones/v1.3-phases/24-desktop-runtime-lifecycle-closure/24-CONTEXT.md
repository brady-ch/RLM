---
phase: 24
title: Desktop Runtime Lifecycle Closure
status: context
created: 2026-05-20
requirements:
  - PROD-01
  - PROD-02
  - PROD-03
source: .planning/v1.3-MILESTONE-AUDIT.md
---

# Phase 24 Context: Desktop Runtime Lifecycle Closure

## Why This Phase Exists

The v1.3 milestone audit found that Phase 23 delivered useful release staging and Tauri scaffolding, but did not satisfy the full desktop product definition of done.

The remaining gap is not UI polish. It is runtime ownership:

- The native app launch path must not require the user to install Node/npm or manually start `rlm ui`.
- The desktop shell must own the RLM control-server child process lifecycle.
- Ollama readiness must be part of first launch from the native app path.
- Native packaging and clean-machine smoke need explicit evidence or exact blockers.

## Existing Assets

- `src-tauri/` contains a minimal Tauri v2 shell config.
- `scripts/packaging/build-release.mjs` stages compiled CLI output, UI assets, launch shims, `desktop-manifest.json`, and `ensure-ollama.mjs`.
- `scripts/desktop/ensure-ollama.mjs` checks an Ollama endpoint and can start `ollama serve` when `RLM_MANAGE_OLLAMA=1`.
- `src/index.ts` starts the control server for `rlm ui` and serves the UI bundle from `resolveUiDistDir`.
- `docs/DESKTOP.md` documents release staging and Tauri commands.

## Audit Gaps To Close

| Requirement | Gap |
|-------------|-----|
| PROD-01 | Release staging still depends on a Node runtime unless a sidecar/binary packaging strategy is added and verified. |
| PROD-02 | Tauri shell does not yet launch, monitor, or stop the RLM control server as a child process. |
| PROD-03 | Ollama readiness helper is staged but not integrated into native first-launch lifecycle. |

## Constraints

- Preserve the existing CLI and `rlm ui` path.
- Do not kill separately managed user Ollama processes.
- Prefer explicit degraded states over silent fallback.
- Avoid claiming Windows/macOS installer success from a Linux-only environment.

