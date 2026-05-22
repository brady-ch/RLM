---
phase: 67-pack-03-ci-smoke
plan: 02
subsystem: infra
tags: [github-actions, deb, tauri, ci, xvfb]

requires:
  - phase: 67-pack-03-ci-smoke
    provides: package:smoke:deb script and deb-smoke-lib helpers from plan 01
provides:
  - .github/workflows/deb-smoke.yml headless Linux CI job
  - Updated docs/DESKTOP.md with skip contract and rust-binary layout
  - Cross-link from package-smoke.yml to deb-smoke.yml
affects: [PACK-01, REG-02]

tech-stack:
  added: []
  patterns:
    - "Dedicated deb-smoke.yml job separate from cross-platform package-smoke matrix"

key-files:
  created:
    - .github/workflows/deb-smoke.yml
    - .planning/phases/67-pack-03-ci-smoke/67-VERIFICATION.md
  modified:
    - docs/DESKTOP.md
    - .github/workflows/package-smoke.yml
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Keep package-smoke.yml matrix; deb install validation isolated in deb-smoke.yml per D-01"

patterns-established:
  - "CI deb smoke never sets RLM_SKIP_DEB_SMOKE; missing apt deps fail the job"

requirements-completed: [PACK-01, REG-02]

duration: 10min
completed: 2026-05-22
---

# Phase 67 Plan 02: Headless Linux CI Workflow Summary

**GitHub Actions deb-smoke job builds Tauri .deb on ubuntu-latest and runs package:smoke:deb with xvfb**

## Performance

- **Duration:** 10 min
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- deb-smoke.yml installs apt deps, runs tauri:build, package:smoke:deb, uploads .deb artifact
- DESKTOP.md documents rust-binary layout, skip env, auto-skip on missing GTK deps, CI path
- package-smoke.yml cross-links to deb-smoke.yml; PACK-01 marked complete

## Task Commits

1. **Task 1: Linux deb-smoke GitHub Actions workflow** - `914e438` (feat)
2. **Task 2: Update DESKTOP.md** - `7cba84e` (docs)
3. **Task 3: Cross-link workflows and verification** - `4a2a445` (feat)

## Files Created/Modified

- `.github/workflows/deb-smoke.yml` - Headless Linux deb build + smoke CI
- `docs/DESKTOP.md` - Rust-only packaging docs and skip contract
- `.github/workflows/package-smoke.yml` - Cross-link comment to deb-smoke.yml
- `.planning/REQUIREMENTS.md` - PACK-01 complete
- `.planning/phases/67-pack-03-ci-smoke/67-VERIFICATION.md` - Phase verification report

## Decisions Made

None - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Self-Check: PASSED

- FOUND: .github/workflows/deb-smoke.yml
- FOUND: docs/DESKTOP.md
- FOUND: 914e438

---
*Phase: 67-pack-03-ci-smoke*
*Completed: 2026-05-22*
