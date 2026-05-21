---
phase: 12-loop-runtime-contract
plan: 02
subsystem: runtime
tags: [typescript, quality-loop, execution-graph, cli, tests]

requires:
  - phase: 12-loop-runtime-contract
    provides: Typed quality loop config, metadata, graph node, and CLI opt-in contract
provides:
  - Opt-in bounded quality loop runtime path before dynamic depth selection
  - Collapsed quality-loop execution graph node with nested phase, candidate, usage, degraded, and failed metadata
  - Compact and JSON renderer exposure for canonical qualityLoop metadata
affects: [phase-13, phase-14, phase-15, phase-16, phase-17, runtime, cli]

tech-stack:
  added: []
  patterns: [single-node loop metadata, five-call iteration preflight, terminal stop helper, renderer metadata projection]

key-files:
  created:
    - .planning/phases/12-loop-runtime-contract/12-02-SUMMARY.md
  modified:
    - src/domain/recursive-language-model.ts
    - src/cli/render.ts
    - tests/recursive-language-model.test.ts

key-decisions:
  - "Quality loop execution branches before dynamic depth selection so loop runs create no depth selector or ordinary root task node."
  - "Phase 12 stores full candidate text only in runtime-local state and persists capped candidate summaries in graph metadata."
  - "Plan-level broad recursive test command was replaced with targeted local-only commands to avoid prohibited localhost control-server tests."

patterns-established:
  - "Loop phases call the language model directly when response model/usage metadata is needed."
  - "Loop terminal states go through one helper requiring a stop reason and synchronized node/result metadata."

requirements-completed: [LOOP-01, LOOP-02, LOOP-03]

duration: 6min
completed: 2026-05-17
---

# Phase 12 Plan 02: Loop Runtime Contract Summary

**Bounded opt-in quality loop runtime with collapsed graph metadata and CLI render exposure**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-17T17:32:56Z
- **Completed:** 2026-05-17T17:38:36Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added fake-model coverage for collapsed loop node shape, phase model metadata, budget exhaustion, terminal usage, degraded output, failed output, and disabled non-loop regression.
- Implemented an opt-in quality-loop runtime branch that skips dynamic depth selection, preflights five calls per iteration, writes canonical loop metadata, and returns full selected candidate text.
- Exposed canonical `qualityLoop` metadata in JSON output and compact status/usage lines.

## Task Commits

1. **Task 1: Add quality loop runtime tests** - `9d999fa` (test)
2. **Task 2: Implement bounded quality loop runtime path** - `14efbfa` (feat)
3. **Task 3: Expose loop metadata in compact and JSON render output** - `43a7380` (feat)

## Files Created/Modified

- `src/domain/recursive-language-model.ts` - Adds `runQualityLoop`, `completeQualityLoopPhase`, five-call budget preflight, phase records, candidate summaries, terminal metadata, and lifecycle events.
- `src/cli/render.ts` - Adds compact quality-loop status/usage lines and JSON `qualityLoop` metadata.
- `tests/recursive-language-model.test.ts` - Adds quality-loop runtime and render coverage using `QueueModel`.
- `.planning/phases/12-loop-runtime-contract/12-02-SUMMARY.md` - Execution summary.

## Decisions Made

- Kept Phase 12 loop behavior intentionally placeholder-level for gate/degraded detection: `DEGRADED` in gate output produces structured unresolved issues without adding Phase 13 rubric parsing.
- Stored full candidate text outside graph metadata so result answers can be complete while graph candidate summaries remain capped.
- Preserved non-loop execution by branching only when `config.qualityLoop?.enabled === true`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced broad plan-level verification with targeted local-only checks**
- **Found during:** Plan-level verification
- **Issue:** The plan listed `node --test dist/tests/recursive-language-model.test.js dist/tests/project-config-scopes.test.js`, but the user explicitly prohibited localhost control-server tests and the recursive test file contains control-server coverage.
- **Fix:** Ran the required quality-loop and render test patterns with `--test-name-pattern` before the file path, plus targeted quality-loop config tests in `project-config-scopes`.
- **Files modified:** None
- **Verification:** Targeted commands passed without starting MCP, dev servers, browser automation, or localhost control-server tests.
- **Committed in:** N/A

---

**Total deviations:** 1 auto-fixed (Rule 3: 1)  
**Impact on plan:** Verification stayed within the requested local-only scope while still covering the Phase 12 loop runtime contract.

## Issues Encountered

- None in implementation. One verification command from the plan was intentionally not run because it conflicted with the user's test constraints.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The `DEGRADED` gate marker is an intentional Phase 12 placeholder mechanism required by the plan and deferred to Phase 13 rubric parsing.

## Threat Flags

None - the new runtime/metadata/renderer surfaces are covered by the plan threat model.

## Verification

- `npm run build`
- `npm run build && node --test --test-name-pattern='quality loop' dist/tests/recursive-language-model.test.js`
- `npm run build && node --test --test-name-pattern='renders .*quality loop metadata' dist/tests/recursive-language-model.test.js`
- `npm run build && node --test --test-name-pattern='quality loop config' dist/tests/project-config-scopes.test.js`

## Self-Check: PASSED

- Summary file exists at `.planning/phases/12-loop-runtime-contract/12-02-SUMMARY.md`.
- Task commits exist: `9d999fa`, `14efbfa`, `43a7380`.
- Acceptance checks passed for all three tasks.

## Next Phase Readiness

Phase 13 can replace the placeholder gate marker with rubric selection and structured evaluator parsing while reusing the canonical loop metadata and terminal stop helpers from this plan.

---
*Phase: 12-loop-runtime-contract*
*Completed: 2026-05-17*
