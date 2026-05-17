---
phase: 12-loop-runtime-contract
plan: 01
subsystem: runtime
tags: [typescript, zod, cli, config, quality-loop]

requires:
  - phase: 12-loop-runtime-contract
    provides: Phase 12 context, validation strategy, and loop contract decisions
provides:
  - Typed quality loop runtime contract in shared domain types
  - YAML runtime.qualityLoop validation with conservative disabled defaults
  - CLI quality loop opt-in flags and config overrides
affects: [phase-13, phase-14, phase-15, cli, runtime-config, execution-graph]

tech-stack:
  added: []
  patterns: [Zod runtime config defaults, explicit CLI configOverrides, canonical metadata on domain graph nodes]

key-files:
  created:
    - .planning/phases/12-loop-runtime-contract/12-01-SUMMARY.md
  modified:
    - src/domain/types.ts
    - src/application/project-config.ts
    - src/cli/args.ts
    - tests/recursive-language-model.test.ts
    - tests/project-config-scopes.test.ts

key-decisions:
  - "Quality loop state is canonical metadata on RecursivePromptMetadata and ExecutionGraphNode.loop, not trace-only state."
  - "runtime.qualityLoop defaults to disabled with maxIterations 3 and stop_before_partial_iteration budget behavior."
  - "CLI loop mode is explicit-only through --quality-loop or --quality-loop-max-iterations."

patterns-established:
  - "Loop runtime config is bounded and validated before execution starts."
  - "CLI flags write both config and configOverrides for downstream runtime resolution."

requirements-completed: [LOOP-01, LOOP-02, LOOP-03]

duration: 6min
completed: 2026-05-17
---

# Phase 12 Plan 01: Loop Runtime Contract Summary

**Typed quality-loop runtime contract with bounded YAML defaults and explicit CLI opt-in flags**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-17T17:24:13Z
- **Completed:** 2026-05-17T17:29:44Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added canonical quality loop types for config, status, stop reasons, usage, issues, candidates, phases, iterations, and metadata.
- Added `runtime.qualityLoop` Zod validation/defaults and default project runtime config.
- Added `--quality-loop` and `--quality-loop-max-iterations` CLI flags that explicitly opt runs into loop mode.

## Task Commits

1. **Task 1 RED:** `427a4f5` test(12-01): add failing quality loop contract test
2. **Task 1 GREEN:** `b6fb195` feat(12-01): add quality loop contract types
3. **Task 2 RED:** `bec399d` test(12-01): add failing quality loop config tests
4. **Task 2 GREEN:** `94b0d65` feat(12-01): validate quality loop runtime config
5. **Task 3 RED:** `0f06c23` test(12-01): add failing quality loop cli flag tests
6. **Task 3 GREEN:** `ab57235` feat(12-01): add quality loop cli flags

## Files Created/Modified

- `src/domain/types.ts` - Quality loop contract types and graph/result metadata hooks.
- `src/application/project-config.ts` - `runtime.qualityLoop` schema and default config.
- `src/cli/args.ts` - CLI opt-in flags and quality loop override parsing.
- `tests/recursive-language-model.test.ts` - Type contract and CLI parse coverage.
- `tests/project-config-scopes.test.ts` - YAML config default, explicit, and invalid-bound coverage.
- `.planning/phases/12-loop-runtime-contract/12-01-SUMMARY.md` - Execution summary.

## Decisions Made

- Kept Phase 12 to contract/config/CLI only; no rubric schema, model routing, or selection algorithm was added.
- Used one collapsed `"quality-loop"` graph node kind with nested `loop` metadata.
- Preserved non-loop default behavior by making quality loop mode disabled unless explicitly configured.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated runtime config assertion for new default**
- **Found during:** Task 3
- **Issue:** An existing explicit-path config test expected `resolveRuntimeConfig` to omit `qualityLoop`, but Task 2 made the disabled default part of the runtime contract.
- **Fix:** Updated the assertion to include the default disabled `qualityLoop` object.
- **Files modified:** `tests/recursive-language-model.test.ts`
- **Verification:** `npm run build && node --test --test-name-pattern='parse args .*quality loop' dist/tests/recursive-language-model.test.js`
- **Committed in:** `ab57235`

**2. [Rule 3 - Blocking] Adjusted Node test filter argument order**
- **Found during:** Task 3 verification
- **Issue:** The planned command form with `--test-name-pattern` after the test file was not honored by this Node test runner invocation, causing unrelated tests in the file to run.
- **Fix:** Ran the same targeted patterns with `--test-name-pattern` before the file path for final verification, keeping the run scoped to local-only tests.
- **Files modified:** None
- **Verification:** `node --test --test-name-pattern='parse args .*quality loop' dist/tests/recursive-language-model.test.js`
- **Committed in:** N/A

---

**Total deviations:** 2 auto-fixed (Rule 1: 1, Rule 3: 1)  
**Impact on plan:** No scope expansion. The changes preserved the plan intent and avoided broad test execution for final verification.

## Issues Encountered

- One intermediate verification command used the plan's option order and ran the whole `recursive-language-model.test.js` file. Final verification used the safe Node option order and did not repeat the broad run.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None - new CLI/YAML runtime config surface was already covered by the plan threat model.

## Verification

- `npm run build`
- `node --test --test-name-pattern='quality loop config' dist/tests/project-config-scopes.test.js`
- `node --test --test-name-pattern='parse args .*quality loop' dist/tests/recursive-language-model.test.js`

## Self-Check: PASSED

- Summary file exists.
- Task commits exist: `427a4f5`, `b6fb195`, `bec399d`, `94b0d65`, `0f06c23`, `ab57235`.
- Acceptance checks passed for all three tasks.

## Next Phase Readiness

Phase 13 can build runtime quality-loop behavior on top of the typed metadata and validated opt-in configuration.

---
*Phase: 12-loop-runtime-contract*
*Completed: 2026-05-17*
