---
phase: 36-dev-tooling-guardrails
plan: "02"
subsystem: testing
tags: [dependency-cruiser, ci, layering]

requires:
  - phase: 36-dev-tooling-guardrails
    provides: Plan 01 ESLint + Prettier + npm scripts

provides:
  - dependency-cruiser WARN rules for AGENTS-aligned `src/` layering
  - Committed baseline triaging three known arcs (ARCH tension)
  - `npm run check` chains typecheck, lint, format:check, depcruise:ci, test

affects:
  - All future phases relying on CI gate parity

tech-stack:
  added:
    - dependency-cruiser
  patterns:
    - "`npm run depcruise:ci` uses `--ignore-known dependency-cruiser-baseline.json`"
    - "Cruiser scope is `src/` only; UI package (`ui/src`) excluded to keep backend layer graph readable"

key-files:
  created:
    - .dependency-cruiser.js
    - dependency-cruiser-baseline.json
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Eight forbidden arcs at warn severity: domain/cli/ports/adapters layering per ARCHITECTURE.md."
  - "Baseline freezes three violations: agents.ts→project-config; extension-port→extension-host; web-fetch-tool→content-tree."
  - "Tests live under repo `tests/` and are exercised by ESLint + `npm test`, not dependency-cruise `src/` graph."

patterns-established:
  - "Expand check only via `npm run check`; standalone `npm test` unchanged semantics."

requirements-completed:
  [TOOL-03, TOOL-04, REG-01, REG-02]

duration: unknown
completed: 2026-05-22
---

# Phase 36 Plan 02: dependency-cruiser + check gate Summary

**WARN-severity layered boundary rules over `src/` with a checked-in baseline, plus aggregated `npm run check` proving 205 regression tests.**

## Performance

- **Tasks:** 3
- **`npm run check`:** Passed (includes typecheck, lint, Prettier `--check`, depcruise, build+test).

## Accomplishments

- `.dependency-cruiser.js`: forbidden arcs domain→application/adapters/cli, ports→application/adapters/cli, adapters→application/cli; `includeOnly: ^src/`.
- Generated `dependency-cruiser-baseline.json` capturing three intentional/latent layering exceptions for ratcheting later (ARCH-02).
- **`npm run check`:** `npm run typecheck && npm run lint && npm run format:check && npm run depcruise:ci && npm test`.
- **REG-01 smoke:** `npm run dev -- --help` exits 0 after changes.

## Task Commits

Bundled into `chore(36-tooling)` with Plan 01 package/config changes plus `style(36-tooling)` for formatter output.

## Deviations from Plan

### Plan wording

Plan listed `.dependency-cruiser.cjs`; repository uses **`type: module`**, so **`.dependency-cruiser.js` with `export default`** matches package ESM semantics (equivalent outcome).

None — plan executed fully.

## Self-Check: PASSED

- `.dependency-cruiser.js` and `dependency-cruiser-baseline.json` present on disk.
- `npm run check` exited 0; test harness reported 205 passes.
