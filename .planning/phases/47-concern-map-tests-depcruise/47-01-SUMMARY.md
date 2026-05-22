---
phase: 47-concern-map-tests-depcruise
plan: 01
subsystem: testing
tags: [dependency-cruiser, concern-map, tests, architecture]

requires:
  - phase: 46-plugin-taxonomy-builtin-migration
    provides: Stabilized plugins/runtime layout and PluginLoader tests
provides:
  - Canonical AGENTS.md concern map with tests/ui/scripts relationships
  - tests/ layout mirroring src/ concerns
  - depcruise rules for plugins/ and runtime/ paths at warn severity
affects: [48-dependency-cruiser-ratchet, 49-plugin-manager]

tech-stack:
  added: []
  patterns:
    - "tests/ mirrors src/ concern folders with tests/helpers/ shared"
    - "depcruise rule comments reference AGENTS.md concern map"
    - "tests/depcruise/ meta-tests verify boundary rule registration"

key-files:
  created:
    - tests/depcruise/concern-map-rules.unit.test.ts
    - .planning/phases/47-concern-map-tests-depcruise/47-01-PLAN.md
  modified:
    - AGENTS.md
    - .dependency-cruiser.js
    - tests/** (17 files moved to mirrored paths)

key-decisions:
  - "Keep runtime→cli imports in build-runtime-context as warn-only debt for Phase 48 injection refactor"
  - "Place depcruise meta-tests under tests/depcruise/ (tooling concern, not src mirror)"
  - "All forbidden rule comments include AGENTS.md concern map reference for contributor-facing violations"

patterns-established:
  - "Concern map table in AGENTS.md is source of truth for depcruise rule names and rationale"
  - "Integration tests live under tests/integration/; adapter persistence tests under tests/adapters/persistence/"

requirements-completed: [TAXN-01, TAXN-05, TAXN-06, DEPS-02]

duration: 3min
completed: 2026-05-22
---

# Phase 47 Plan 01: Concern Map, Tests Mirror & Depcruise Rules Summary

**Canonical concern map in AGENTS.md, tests/ mirrored to src/ layout, and five new depcruise rules for plugins/runtime with concern-map-referencing violation messages**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-22T16:38:02Z
- **Completed:** 2026-05-22T16:41:00Z
- **Tasks:** 3
- **Files modified:** 21

## Accomplishments

- Published canonical concern map in AGENTS.md covering all src/ layers plus tests/, ui/, scripts/ and depcruise rule table
- Moved 17 root-level test files into mirrored paths (application/, runtime/, adapters/, plugins/, domain/, integration/)
- Added five depcruise forbidden arcs for plugins/ and runtime/ at warn severity; all rule comments reference AGENTS.md concern map
- Added depcruise meta-tests verifying rule registration and named violations via JSON report

## Task Commits

1. **Task 1: Canonical concern map in AGENTS.md** - `62e4e5f` (docs)
2. **Task 2: Mirror tests/ to src/ concerns** - `aee012f` (refactor)
3. **Task 3: Depcruise rules for plugins/ and runtime/** - `c01e918` (feat)

**Plan metadata:** `e7cc591` (docs: complete plan)

## Files Created/Modified

- `AGENTS.md` - Concern map diagram, tests mirror table, depcruise rules table
- `.dependency-cruiser.js` - Five new plugin/runtime rules; all comments reference concern map
- `tests/depcruise/concern-map-rules.unit.test.ts` - Rule registration and violation naming tests
- `tests/application/**`, `tests/runtime/**`, `tests/adapters/**`, `tests/plugins/**`, `tests/domain/**`, `tests/integration/**` - Mirrored test layout

## Decisions Made

- Documented known `runtime→cli` violation in `build-runtime-context.ts` as Phase 48 fix (inject CLI helpers at bootstrap)
- Meta boundary tests under `tests/depcruise/` rather than forcing a src/ mirror path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- depcruise default text output omits rule comments; meta-test uses `--output-type json` and `summary.ruleSetUsed` to verify concern map references

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 48 can ratchet severity to error and fix `runtime→cli` imports in `build-runtime-context.ts` (2 current warnings)
- Baseline remains empty; `npm run depcruise:ci` passes at warn severity

## Self-Check: PASSED

- FOUND: AGENTS.md
- FOUND: .dependency-cruiser.js
- FOUND: tests/depcruise/concern-map-rules.unit.test.ts
- FOUND: 62e4e5f
- FOUND: aee012f
- FOUND: c01e918
- npm run check: 450 tests pass

---
*Phase: 47-concern-map-tests-depcruise*
*Completed: 2026-05-22*
