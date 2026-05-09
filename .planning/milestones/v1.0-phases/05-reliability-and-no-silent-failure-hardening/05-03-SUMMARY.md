---
phase: "05-reliability-and-no-silent-failure-hardening"
plan: "05-03"
subsystem: cli
tags: [render, exit-code, json]

requires:
  - phase: "05-02"
    provides: accurate `executionStatus` and errors in `RecursivePromptResult`
provides:
  - Default and compact CLI output surfaces failures explicitly
  - JSON output adds `failureCategory` / `failureLabel` when the run failed
  - `process.exitCode = 1` on failed runs after successful `main()` resolution
  - Help text documents exit-code contract
affects: [shell scripts]

tech-stack:
  added: []
  patterns: ["Infer failure category from tool calls vs workflow metadata for JSON helpers"]

key-files:
  created: []
  modified: [src/cli/render.ts, src/cli/args.ts, src/index.ts]

key-decisions:
  - "Control server unchanged: `/api/session` already forwards `snapshot()` including new fields."

requirements-completed: [ERRO-01]

duration: "—"
completed: "2026-05-08"
---

# Phase 5 Plan 05-03: CLI failure parity Summary

**Interactive and JSON CLI modes show explicit failure sections; JSON adds structured failure hints; failed runs set exit code 1 without throwing after output is written.**

## Deviations from Plan

- `runtime-logger.ts` unchanged: stderr logger already uses `console.error` for all stages (D-04 satisfied without new severity field).

## Self-Check: PASSED

- `setExitCodeIfRunFailed` present in `src/index.ts`
- `npm test` passes
