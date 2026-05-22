---
phase: 60-tauri-in-process-packaging
plan: 01
subsystem: packaging
tags: [tauri, rust-binary, desktop, ollama]

requires:
  - phase: 59-rust-cli-parity-ci
    provides: Rust rlm binary and release staging patterns
provides:
  - Tauri embeds Rust control server in-process (no Node child)
  - Rust-only release bundle layout (bin/rlm + ui-dist)
  - Ollama readiness check in Rust desktop setup
affects: [milestone-lifecycle]

tech-stack:
  added: [rlm-core in src-tauri, reqwest blocking ollama probe]
  patterns: [EmbeddedRuntime with tokio block_on shutdown]

key-files:
  created: []
  modified:
    - src-tauri/src/main.rs
    - src-tauri/Cargo.toml
    - scripts/packaging/build-release.mjs
    - scripts/packaging/smoke-release.mjs

key-decisions:
  - "Release binary lives at bin/rlm; launcher shim at rlm avoids self-exec recursion"
  - "Full tauri build and .deb install smoke deferred — requires system GTK/dbus deps on Linux CI"

patterns-established:
  - "Desktop shell starts rlm_core::start_server in-process and redirects webview to loopback URL"

requirements-completed: [PACK-01, PACK-02]

duration: 35min
completed: 2026-05-22
---

# Phase 60 Plan 01: Tauri In-Process + Packaging Summary

**Tauri embeds the Rust control server in-process; release staging ships bin/rlm + ui-dist with no bundled Node.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 (PACK-03 partial)
- **Files modified:** 5

## Accomplishments

- Replaced Node child spawn in `src-tauri` with in-process `start_server` + graceful shutdown
- Rust Ollama `/api/version` probe replaces Node `ensure-ollama.mjs` in desktop path
- Updated packaging to rust-binary layout; smoke validates manifest and binary execution

## Task Commits

1. **Tauri in-process + packaging** - `a5efcf5` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Release launcher overwrote Rust binary**
- **Found during:** Task 2
- **Issue:** Shell shim written to same path as copied binary caused infinite exec loop
- **Fix:** Stage binary at `bin/rlm`, launcher shim at `rlm`
- **Commit:** `a5efcf5`

## Known Stubs / Deferred

- MCP/external plugin limitations unchanged from Phase 58
- Human UAT (PACK-03, REG-01) signed off in `60-UAT.md` (2026-05-22)

## Self-Check: PASSED

- FOUND: src-tauri/src/main.rs
- FOUND: scripts/packaging/build-release.mjs
- FOUND: a5efcf5
- `npm run package:smoke` — PASS
