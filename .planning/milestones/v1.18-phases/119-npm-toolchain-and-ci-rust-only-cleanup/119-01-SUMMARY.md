---
phase: 119-npm-toolchain-and-ci-rust-only-cleanup
plan: 01
subsystem: infra
tags: [npm, package-json, rust-only, vite]

requires:
  - phase: 118-adapters-plugins-and-ts-tests-removal
    provides: deleted src/ tree; no TS runtime importers
provides:
  - Lean package.json with UI-only Node deps
  - check script chaining lint/format/check:rust
affects: [119-02, 119-03, phase-120]

tech-stack:
  added: []
  patterns: ["npm run check = UI lint/format + Rust gates"]

key-files:
  created: []
  modified: [package.json, package-lock.json]

key-decisions:
  - "Retained UI deps (@radix-ui, @xyflow/react, react, lucide-react, vite stack)"
  - "bin.rlm stays scripts/rlm-runtime.mjs (Rust CLI dispatcher)"

patterns-established:
  - "package.json dependencies limited to UI runtime; Rust owns orchestration"

requirements-completed: [RETIRE-119-01, RETIRE-119-02, RETIRE-119-03]

duration: 5min
completed: 2026-05-24
---

# Phase 119 Plan 01: package.json Rust-Only Cleanup Summary

**Stripped LangChain/runtime deps and rewired npm check to UI lint/format plus Rust gates only**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-24T15:38:00Z
- **Completed:** 2026-05-24T15:43:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Removed LangChain, deepagents, zod, yaml, tar runtime dependencies
- Removed dependency-cruiser, build, typecheck, and depcruise scripts
- Set `npm run check` to `lint → format:check → check:rust`
- Regenerated package-lock.json (92 packages removed)

## Task Commits

1. **Task 1: Remove runtime deps and dead scripts** - `f066e60` (feat)
2. **Task 2: Rewrite check/lint/format scripts and refresh lockfile** - `e8066b6` (feat)

## Files Created/Modified

- `package.json` - UI-only deps; Rust-only check chain
- `package-lock.json` - Pruned lockfile without removed packages

## Decisions Made

- Kept all UI/Tauri/packaging scripts unchanged per plan discretion
- bin.rlm confirmed as `scripts/rlm-runtime.mjs` (not dist/src/index.js)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

119-02 can delete root tsconfig/depcruise and rewire eslint/test runner against the new package.json scripts.

---
*Phase: 119-npm-toolchain-and-ci-rust-only-cleanup*
*Completed: 2026-05-24*

## Self-Check: PASSED

- package.json: FOUND
- Commits f066e60, e8066b6: FOUND
