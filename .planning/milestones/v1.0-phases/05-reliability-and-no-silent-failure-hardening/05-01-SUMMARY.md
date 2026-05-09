---
phase: "05-reliability-and-no-silent-failure-hardening"
plan: "05-01"
subsystem: domain
tags: [execution-status, failure-vocabulary, recursive-engine]

requires:
  - phase: "04-recursive-spawning-with-run-mode-controls"
    provides: execution control hooks and graph semantics
provides:
  - Shared failure vocabulary and `summarizeRunFromNodes` for run-level messaging
  - Session snapshot `runSummary` on terminal failed/cancelled runs
  - Recursive engine marks running ancestors failed on uncaught errors (no stuck “running”)
affects: [cli, ui, workflow]

tech-stack:
  added: []
  patterns: ["Terminal snapshot omits `runSummary` key unless set (exactOptionalPropertyTypes)"]

key-files:
  created: [src/domain/execution-failure.ts]
  modified: [src/application/execution-controller.ts, src/domain/recursive-language-model.ts]

key-decisions:
  - "Cancelled runs expose cancel reason in `runSummary.message` when terminal."

patterns-established:
  - "Use `summarizeRunFromNodes` for consistent primary failure line at session boundary."

requirements-completed: []

duration: "—"
completed: "2026-05-08"
---

# Phase 5 Plan 05-01: Domain and session failure truth Summary

**Single vocabulary for failures, correct terminal session/run summary, and recursive catch propagation so parents never stay “running” after a hard error.**

## Performance

- **Duration:** (executor session)
- **Tasks:** 3
- **Files modified:** 3 (+ execution-failure module)

## Deviations from Plan

None — snapshot `runSummary` satisfies D-07 parity for API consumers using `/api/session`.

## Self-Check: PASSED

- `src/domain/execution-failure.ts` exists
- `summarizeRunFromNodes` referenced from `execution-controller.ts`
