---
phase: 114-control-server-and-ui-bootstrap-removal
plan: 03
subsystem: infra
tags: [vite, proxy, verification, golden-fixtures]

requires:
  - phase: 114-control-server-and-ui-bootstrap-removal
    provides: Deleted TS server (plans 01-02) and Rust-only check:parity
provides:
  - Vite dev proxy /api → Rust control server
  - dev:ui:full two-terminal workflow documentation
  - All Phase 114 verification gates green
affects: [tauri-dev, local-ui-development]

tech-stack:
  added: []
  patterns: [Vite proxy to localhost Rust API; RAM-stable golden fixture normalization]

key-files:
  created: []
  modified: [ui/vite.config.ts, package.json, crates/rlm-core/tests/control_server_fixtures.rs]

key-decisions:
  - "RLM_CONTROL_PORT env with default 8787 for Vite proxy target"
  - "Strip runBlocked/runBlockedReason from golden fixture compare (host RAM varies)"

patterns-established:
  - "Local UI dev: Rust server + Vite proxy; production uses RLM_UI_DIST bundled serve"

requirements-completed: [RETIRE-114-02, RETIRE-114-03]

duration: 15min
completed: 2026-05-24
---

# Phase 114 Plan 03: Vite Dev Proxy and Gates Summary

**Wired Vite `/api` proxy to Rust control server and passed all Phase 114 verification gates including golden fixtures.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added Vite `server.proxy` for `/api` → `http://127.0.0.1:${RLM_CONTROL_PORT||8787}`
- Added `dev:ui:full` script documenting two-terminal dev workflow
- All 113-GATES Phase 114 commands pass
- `npm run test:agent:verify:light` passes (3/3 steps)
- `reg01_uat_smoke` supplementary test passes

## Task Commits

1. **Task 1: Add Vite dev proxy** - `8dc762c` (feat)
2. **Task 2: Verification gates + RAM-stable fixtures** - `305097a` (fix)

## Verification Results

| Gate | Status |
|------|--------|
| `control_server_matches_golden_fixtures` | PASS |
| `RLM_UI_DIST=ui/dist cargo run -p rlm-cli -- ui --port 0` | PASS (prints "RLM UI listening at ...") |
| Deletion gates (control-server, fixture test) | PASS |
| `npm run check:parity` | PASS |
| `npm run test:agent:verify:light` | PASS |
| `reg01_uat_smoke` (optional) | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Golden fixture failed on low-RAM host**
- **Found during:** Task 2 verification
- **Issue:** `runBlocked` differed between live snapshot (true) and fixture (false) due to available RAM
- **Fix:** Extended `normalize_session_snapshot` to strip `runBlocked`/`runBlockedReason`; normalize both sides before compare
- **Files modified:** `crates/rlm-core/tests/control_server_fixtures.rs`
- **Commit:** `305097a`

## Self-Check: PASSED

- `ui/vite.config.ts` contains proxy and /api
- Golden fixture test passes
- Commits `8dc762c`, `305097a` found in git log
