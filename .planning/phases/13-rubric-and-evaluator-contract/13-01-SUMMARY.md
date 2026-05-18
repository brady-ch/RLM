---
phase: 13-rubric-and-evaluator-contract
plan: 01
subsystem: quality-loop-runtime
tags: [typescript, quality-loop, rubric, tests]

requires:
  - phase: 12-loop-runtime-contract
    provides: Typed quality loop runtime and metadata contract
provides:
  - Typed quality-loop rubric ids, criteria, and selection metadata
  - Deterministic rubric selection before loop iterations start
  - Fake-model coverage for all five default rubric categories
affects: [phase-13, phase-14, phase-16, runtime, cli]

key-files:
  created:
    - .planning/phases/13-rubric-and-evaluator-contract/13-01-SUMMARY.md
  modified:
    - src/domain/types.ts
    - src/domain/recursive-language-model.ts
    - tests/recursive-language-model.test.ts

key-decisions:
  - "Rubric selection is deterministic and local; it does not spend a model call."
  - "Rubric metadata is canonical on QualityLoopMetadata and mirrors to the graph node loop metadata."

requirements-completed: [RUBR-01]

completed: 2026-05-18
---

# Phase 13 Plan 01 Summary

## Accomplishments

- Added `QualityLoopRubricId`, `QualityLoopRubricCriterion`, and `QualityLoopRubricSelection`.
- Added optional `QualityLoopMetadata.rubric`.
- Added deterministic selection for the five accepted rubric ids.
- Added tests for all five rubric categories and graph-node metadata mirroring.

## Commits

| Commit | Description |
|--------|-------------|
| `cad6134` | `feat(13-01): add quality loop rubric contract` |

## Verification

- `npm run build`
- `npm run build && node --test --test-name-pattern='quality loop selects .*rubric|quality loop mirrors selected rubric' dist/tests/recursive-language-model.test.js`

## Deviations

- The three planned tasks were committed together because the type, runtime, and tests were tightly coupled and verified as one coherent contract.

## Self-Check: PASSED

- Rubric ids are typed.
- Metadata is mirrored to the execution graph node.
- Targeted rubric tests pass.
