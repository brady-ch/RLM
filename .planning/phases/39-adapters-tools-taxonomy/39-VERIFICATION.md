# Phase 39 Verification: Adapters & Tools Taxonomy

**status:** passed

**Date:** 2026-05-22

## Automated gate

- `npm run check` — exit 0 (typecheck, eslint, prettier check, dependency-cruiser with baseline, tests)

## Tests

- **Count:** 211 (`node --test dist/tests/*.test.js` after `npm run build`)

## Regression (Phase 39 scope)

**REG-01 / REG-02 for this phase slice:** Full suite green; refactor is directory + import surface only (barrel, bootstrap re-exports, extension paths). Milestone-wide REG sign-off in REQUIREMENTS remains open through Phase 42.

## ADPT coverage

- ADPT-01–03: Subdirectories `src/adapters/tools/`, `persistence/`, `models/`.
- ADPT-04: `search-query.ts` under `tools/` with `web-search-tool`.
- ADPT-05: `src/extensions/tools/*.extension.ts` imports from `../../adapters/tools/*.ts`.
- ADPT-06: Ports unchanged; bootstrap + `src/adapters/index.ts` reduce ad-hoc adapter deep links from application and tests.
