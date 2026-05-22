---
phase: 48-dependency-cruiser-ratchet
plan: 01
subsystem: testing
tags: [dependency-cruiser, architecture, bootstrap, ci]

requires:
  - phase: 47-concern-map-tests-depcruise
    provides: concern map rules at warn severity and meta-tests
provides:
  - strict depcruise at error severity with empty baseline
  - RuntimeCliWiring injection at bootstrap for logger and shutdown
  - depcruise:strict in npm run check without --ignore-known
affects: [49-local-plugin-manager]

tech-stack:
  added: []
  patterns:
    - "CLI concerns injected via RuntimeCliWiring at application/bootstrap"
    - "depcruise fixture probes excluded from production scan"

key-files:
  created:
    - src/plugins/__depcruise-fixtures__/forbidden-application-import.ts
    - tests/depcruise/probe.dependency-cruiser.js
  modified:
    - src/runtime/composition/build-runtime-context.ts
    - src/application/bootstrap/build-runtime-context.ts
    - .dependency-cruiser.js
    - package.json
    - AGENTS.md
    - tests/depcruise/concern-map-rules.unit.test.ts

key-decisions:
  - "RuntimeCliWiring defaults to no-op logger/shutdown for composition-only tests"
  - "Violation probe fixture excluded from strict src scan but tested via probe config"
  - "application→adapters documented as optional follow-on with named bootstrap exceptions"

patterns-established:
  - "Bootstrap facade owns CLI→runtime wiring; composition accepts injectable cliWiring"

requirements-completed: [DEPS-01, DEPS-03, DEPS-04]

duration: 25min
completed: 2026-05-22
---

# Phase 48 Plan 01: Dependency-Cruiser Ratchet Summary

**Bootstrap-injected CLI wiring clears runtime→cli violations; all boundary rules ratcheted to error severity with strict CI and documented application→adapters exceptions**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Removed `src/cli/*` imports from runtime composition via `RuntimeCliWiring`; bootstrap injects logger and shutdown handlers
- Ratcheted all 13 depcruise forbidden arcs to `severity: "error"`; `npm run check` uses `depcruise:strict` without `--ignore-known`
- Baseline remains empty (`dependency-cruiser-baseline.json` is `[]`); v1.6 violations stay fixed
- Meta-tests verify error severity, zero runtime→cli violations, and named `no-plugins-to-application` failures
- AGENTS.md documents strict CI and optional `application→adapters` rule with bootstrap exceptions

## Task Commits

1. **Task 1: Bootstrap CLI injection** - `787443b` (feat)
2. **Task 2: Ratchet severity and strict CI** - `a50983d` (feat)

## Files Created/Modified

- `src/runtime/composition/build-runtime-context.ts` - RuntimeCliWiring options; no cli imports
- `src/application/bootstrap/build-runtime-context.ts` - Injects CLI logger and shutdown wiring
- `.dependency-cruiser.js` - Error severity; excludes depcruise fixture probes
- `package.json` - `depcruise:strict`; check uses strict script
- `AGENTS.md` - Error severity docs; application→adapters exceptions
- `tests/depcruise/concern-map-rules.unit.test.ts` - Updated meta-tests for ratchet
- `tests/depcruise/probe.dependency-cruiser.js` - Probe config for violation naming test
- `src/plugins/__depcruise-fixtures__/forbidden-application-import.ts` - Intentional violation probe

## Decisions Made

- Composition tests use default no-op `cliWiring`; production CLI path uses bootstrap wrapper
- Fixture probe excluded from production depcruise scan to keep CI green while enabling isolated violation tests

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Strict boundary enforcement active; ready for Phase 49 local plugin manager
- No blockers

## Self-Check: PASSED

- FOUND: src/runtime/composition/build-runtime-context.ts
- FOUND: .dependency-cruiser.js
- FOUND: tests/depcruise/concern-map-rules.unit.test.ts
- FOUND: 787443b
- FOUND: a50983d

---
*Phase: 48-dependency-cruiser-ratchet*
*Completed: 2026-05-22*
