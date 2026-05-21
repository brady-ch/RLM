---
phase: 23
title: Tauri Shell and Cross-Platform Installers
status: completed
gathered: 2026-05-20
source: autonomous
---

# Phase 23: Desktop Shell and Cross-Platform Installers - Context

<decisions>
## Implementation Decisions

- Use the existing Node/Vite release staging path as the v1.3 installer input.
- Stage launch shims and static UI assets together so users can launch `rlm ui` without manually starting the control server.
- Add an Ollama readiness helper that detects an existing endpoint and can optionally start `ollama serve` when explicitly enabled.
- Treat native signing/notarization/store distribution as out of scope for v1.3.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` - Phase 23 scope.
- `.planning/REQUIREMENTS.md` - PROD-01, PROD-02, PROD-03.
- `scripts/packaging/build-release.mjs` - release staging.
- `src/cli/ui-dist-dir.ts` - packaged UI asset resolution.
- `docs/DESKTOP.md` - desktop package usage.

</canonical_refs>
