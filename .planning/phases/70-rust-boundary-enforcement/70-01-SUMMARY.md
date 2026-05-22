---
phase: 70-rust-boundary-enforcement
plan: 01
subsystem: infra
tags: [rust, boundaries, agents-md, toml]

requires: []
provides:
  - Rust concern map in AGENTS.md with May import columns
  - Machine-readable rust-boundary-rules.toml for CI scanner
affects: [70-02, ARCH-05]

tech-stack:
  added: []
  patterns:
    - "Rust boundary rules mirror TS dependency-cruiser naming"

key-files:
  created:
    - scripts/rust-boundary-rules.toml
  modified:
    - AGENTS.md

key-decisions:
  - "Rule names in TOML identical to AGENTS.md table for drift prevention"
  - "cli layer excluded from inner forbidden arcs; uses rlm_core public API only"

patterns-established:
  - "Layer detection: first path segment under rlm-core/src/{layer}/"

requirements-completed: [ARCH-05]

duration: 8min
completed: 2026-05-22
---

# Phase 70 Plan 01: Rust Concern Map Summary

**Published Rust workspace layering contract in AGENTS.md and TOML manifest for boundary enforcement.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-22T22:37:31Z
- **Completed:** 2026-05-22T22:45:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added Rust workspace section to AGENTS.md with concern map, diagram, and boundary rules table
- Created `scripts/rust-boundary-rules.toml` with 16 error-severity forbidden arcs

## Task Commits

1. **Task 1: Add Rust concern map to AGENTS.md** - `51db4a0` (feat)
2. **Task 2: Create rust-boundary-rules.toml manifest** - `3677fdc` (feat)

## Files Created/Modified

- `AGENTS.md` - Rust concern map, boundary rules, verification commands
- `scripts/rust-boundary-rules.toml` - Scan roots and forbidden layer arcs

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: AGENTS.md
- FOUND: scripts/rust-boundary-rules.toml
- FOUND: 51db4a0
- FOUND: 3677fdc
