# Phase 67 — Plan 01: Deb Smoke Script Summary

---
phase: 67-pack-03-ci-smoke
plan: 01
subsystem: infra
tags: [deb, tauri, packaging, smoke-test, node]

requires:
  - phase: 60-tauri-in-process-packaging
    provides: Tauri deb bundle output path and rust-binary release layout
provides:
  - deb-smoke-lib.mjs shared helpers for deb discovery, skip detection, install/uninstall
  - smoke-deb.mjs CLI entry for install + binary smoke + cleanup
  - npm run package:smoke:deb wired in package.json
affects: [67-02, PACK-01, REG-02]

tech-stack:
  added: []
  patterns:
    - "spawnSync packaging smoke with explicit exit codes and stderr diagnostics"
    - "RLM_SKIP_DEB_SMOKE=1 and pkg-config glib-2.0 auto-skip exit 0"

key-files:
  created:
    - scripts/packaging/deb-smoke-lib.mjs
    - scripts/packaging/smoke-deb.mjs
    - scripts/packaging/deb-smoke-lib.test.mjs
  modified:
    - package.json

key-decisions:
  - "Skip paths exit 0 with actionable stderr; missing deb or install failures exit 1"
  - "Only install .deb from repo Tauri build output — never external downloads (T-67-01)"

patterns-established:
  - "Deb smoke: shouldSkipDebSmoke → findDebArtifact → installDeb try/finally uninstallDeb"

requirements-completed: [PACK-01]

duration: 15min
completed: 2026-05-22
---

# Phase 67 Plan 01: Deb Smoke Script Summary

**Linux .deb install smoke with prerequisite skip detection and npm run package:smoke:deb entry point**

## Performance

- **Duration:** 15 min
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Shared deb-smoke-lib exports findDebArtifact, shouldSkipDebSmoke, installDeb, findInstalledBinaries, uninstallDeb
- smoke-deb.mjs runs install → CLI --help → optional xvfb desktop check → uninstall in finally
- RLM_SKIP_DEB_SMOKE=1 and missing glib-2.0 pkg-config auto-skip with exit 0
- node:test coverage for skip detection without real dpkg calls

## Task Commits

1. **Task 1: Deb smoke helper module** - `f933b9a` (feat)
2. **Task 2: Deb smoke CLI entry script** - `33504cb` (feat)
3. **Task 3: Wire npm script and skip-path test** - `c1363ed` (test), `32eb640` (feat)

## Files Created/Modified

- `scripts/packaging/deb-smoke-lib.mjs` - Shared deb discovery, skip, install/uninstall helpers
- `scripts/packaging/smoke-deb.mjs` - Executable deb smoke entry
- `scripts/packaging/deb-smoke-lib.test.mjs` - Skip and artifact discovery unit tests
- `package.json` - package:smoke:deb and test:packaging scripts

## Decisions Made

None - followed plan as specified per CONTEXT D-02 through D-04.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Self-Check: PASSED

- FOUND: scripts/packaging/deb-smoke-lib.mjs
- FOUND: scripts/packaging/smoke-deb.mjs
- FOUND: f933b9a, 33504cb, c1363ed, 32eb640

---
*Phase: 67-pack-03-ci-smoke*
*Completed: 2026-05-22*
