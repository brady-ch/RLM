---
phase: 116-application-layer-removal
plan: 03
subsystem: testing
tags: [orphan-pruning, import-gate, cargo-test, rlm-cli]

requires:
  - phase: 116-application-layer-removal
    provides: Deleted src/application/ and tests/application/ (Plans 01-02)
provides:
  - Zero TS imports from deleted application modules
  - All Phase 116 verification gates green
affects: [117-domain-and-ports-removal, 118-adapters-plugins-removal]

tech-stack:
  added: []
  patterns: [inline test helpers replace deleted application imports]

key-files:
  created: []
  modified:
    - tests/adapters/persistence/run-state-store.test.ts
    - tests/depcruise/concern-map-rules.unit.test.ts
    - crates/rlm-core/tests/model_library_routes.rs

key-decisions:
  - "Deleted recursive-language-model.test.ts; Rust coverage in recursive_engine_session.rs"
  - "Stabilized model_library_routes fixture with explicit memory cap for low-RAM hosts"

patterns-established:
  - "Application-coupled TS integration tests removed rather than migrated"

requirements-completed: [RETIRE-116-03, RETIRE-116-04]

duration: 8min
completed: 2026-05-24
---

# Phase 116 Plan 03: Orphan Pruning and Verification Summary

**Pruned application-coupled TS tests and fixtures; all Phase 116 gates pass including full `cargo test -p rlm-core` and `test:agent:verify:light`**

## Performance

- **Duration:** ~8 min
- **Tasks:** 3
- **Files modified:** 7 (4 deleted, 3 edited)

## Accomplishments
- Deleted application-coupled test files (recursive-language-model, integration-v15, mock-plan-model, depcruise fixture)
- Inlined `createMutationAuditEvent` helper in run-state-store test
- Removed depcruise meta-test for deleted forbidden-application-import fixture
- All 113-GATES Phase 116 commands pass

## Task Commits

1. **Task 1: Delete application-coupled test files** - `75bcc62` (feat)
2. **Task 2: Fix remaining application imports and depcruise test** - `2c2fb3c` (fix)
3. **Task 3: Verification gates** - `71b139e` (fix — model_library RAM fixture)

## Gate Results

| Gate | Result |
|------|--------|
| `cargo test -p rlm-core` | PASS |
| `test ! -d src/application` | PASS |
| `test ! -d tests/application` | PASS |
| Import grep gate | PASS |
| `npm run rlm -- ask --help` | PASS |
| `npm run rlm -- ui --help` | PASS |
| `npm run rlm -- workflow-export --help` | PASS |
| `npm run rlm -- workflow-import --help` | PASS |
| `npm run test:agent:verify:light` | PASS (3/3) |

## Files Created/Modified
- `tests/domain/recursion/recursive-language-model.test.ts` - Deleted
- `tests/integration/integration-v15.test.ts` - Deleted
- `tests/helpers/mock-plan-model.ts` - Deleted
- `src/plugins/__depcruise-fixtures__/forbidden-application-import.ts` - Deleted
- `tests/adapters/persistence/run-state-store.test.ts` - Inline audit helper
- `tests/depcruise/concern-map-rules.unit.test.ts` - Removed probe meta-test
- `crates/rlm-core/tests/model_library_routes.rs` - Memory cap in fixture

## Decisions Made
- Coverage gap from deleted recursive-language-model.test.ts transferred to Rust `recursive_engine_session.rs` and domain unit tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stabilized model_library_routes tier-select tests on low-RAM hosts**
- **Found during:** Task 3 (cargo test gate)
- **Issue:** Pre-existing 2 failures — select-tier returned 400 when host free RAM < model estimate (no memory block in project_config fixture)
- **Fix:** Added explicit `memory.maxRamMb: 16384` to `project_config()` fixture
- **Files modified:** `crates/rlm-core/tests/model_library_routes.rs`
- **Verification:** `cargo test -p rlm-core --test model_library_routes` — 5/5 pass; full suite pass
- **Committed in:** `71b139e`

## Transitional Notes
- `npm run build` / `npm run typecheck` may still fail until Phase 117–119 (expected, not Phase 116 gates)

## Issues Encountered
- Pre-existing model_library_routes failures (documented in 115-03) — resolved via fixture memory cap

## User Setup Required
None

## Next Phase Readiness
- Phase 117 can delete `src/domain/` and `src/ports/`
- No remaining TS imports from deleted application modules

## Self-Check: PASSED
- FOUND: 116-01-SUMMARY.md, 116-02-SUMMARY.md, 116-03-SUMMARY.md
- FOUND: 75bcc62, 2c2fb3c, 71b139e

---
*Phase: 116-application-layer-removal*
*Completed: 2026-05-24*
