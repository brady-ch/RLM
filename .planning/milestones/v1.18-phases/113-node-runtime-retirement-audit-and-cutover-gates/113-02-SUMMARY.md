---
phase: 113-node-runtime-retirement-audit-and-cutover-gates
plan: 02
subsystem: infra
tags: [rust, dispatcher, cutover, npm]

requires: []
provides:
  - Rust-default runtime dispatcher
  - npm bin routed through dispatcher
  - Automated test:rlm-runtime verification
affects: [115-cli-entry-removal, 119-npm-toolchain-cleanup]

tech-stack:
  added: []
  patterns: [RLM_RUNTIME=node escape hatch preserved until Phase 115]

key-files:
  created:
    - scripts/rlm-runtime.test.mjs
  modified:
    - scripts/rlm-runtime.mjs
    - package.json

key-decisions:
  - "Default RLM_RUNTIME changed from node to rust"
  - "bin.rlm routes through scripts/rlm-runtime.mjs not dist/src/index.js"

patterns-established:
  - "grep-based source test for default constant plus spawn tests for dispatch paths"

requirements-completed: [AUDIT-113-02]

duration: 20min
completed: 2026-05-24
---

# Phase 113 Plan 02: Rust Default Runtime Summary

**Default npm rlm dispatches to Rust binary with RLM_RUNTIME=node escape hatch and automated dispatcher tests**

## Performance

- **Duration:** 20 min
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Flipped `RLM_RUNTIME` default from `node` to `rust` in dispatcher
- Routed `package.json` bin through dispatcher script
- Added `test:rlm-runtime` with TDD RED/GREEN gate commits

## Task Commits

1. **Task 1: Add failing test** - `432cf4f` (test)
2. **Task 2: Flip default to rust** - `1f41418` (feat)
3. **Task 3: Align package.json bin** - `9532b87` (feat)

## Files Created/Modified

- `scripts/rlm-runtime.mjs` - Default runtime rust; updated header comments
- `scripts/rlm-runtime.test.mjs` - Three tests for default constant and dispatch paths
- `package.json` - bin.rlm → dispatcher; test:rlm-runtime script

## Decisions Made

- Preserved `runNode()` branch as escape hatch per migration decisions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

Developers running `npm run rlm` now get Rust CLI by default. Phase 115 can remove Node escape hatch.

---
*Phase: 113-node-runtime-retirement-audit-and-cutover-gates*
*Completed: 2026-05-24*

## Self-Check: PASSED

- FOUND: scripts/rlm-runtime.test.mjs
- FOUND: scripts/rlm-runtime.mjs
- FOUND: 432cf4f, 1f41418, 9532b87
