---
phase: 45-application-concern-grouping
plan: 01
subsystem: infra
tags: [taxonomy, application, strangler, facades, concern-grouping]

requires:
  - phase: 44-runtime-interop-split
    provides: runtime composition extracted; bootstrap thin facade
provides:
  - src/application/execution/ with agent, workflow, model, and execution control modules
  - src/application/graph/ with planner, executor, and workflow persistence modules
  - src/application/memory/ with memory manager, resolver, semantic index, session bridge
  - src/application/plugins/ with extension registry facade for Phase 46 manager
  - Root facade re-exports preserving backward-compatible import paths
affects: [46-plugin-taxonomy, 47-concern-map-tests]

tech-stack:
  added: []
  patterns:
    - "Strangler extraction: move implementations to concern folders, root re-export facades"
    - "Cross-concern imports use explicit ../execution|graph|memory paths"

key-files:
  created:
    - src/application/execution/ (10 modules)
    - src/application/graph/ (6 modules)
    - src/application/memory/ (4 modules)
    - src/application/plugins/index.ts
    - 20 root facade re-exports at application/
  modified:
    - Cross-concern relative imports in moved modules

key-decisions:
  - "Root facade re-exports at original flat paths for backward-compatible imports (CLI, tests, runtime unchanged)"
  - "plugins/ established with ExtensionRegistryEntry facade; full manager deferred to Phase 46"

patterns-established:
  - "Execution modules live under src/application/execution/"
  - "Graph modules live under src/application/graph/"
  - "Memory modules live under src/application/memory/"

requirements-completed: [TAXN-02]

duration: 20min
completed: 2026-05-22
---

# Phase 45: Application Concern Grouping Summary

**Flat application modules grouped into execution, graph, memory, and plugins concern folders with root facade re-exports**

## Performance

- **Duration:** ~20 min
- **Tasks:** 5/5
- **Files modified:** 41
- **Tests:** 360 passing

## Accomplishments

- Created concern folders: `execution/` (10 modules), `graph/` (6 modules), `memory/` (4 modules), `plugins/` (facade)
- `control-server/` unchanged; `config/` and `bootstrap/` remain cross-cutting entry points
- 20 root facade re-exports preserve all existing import paths for CLI, runtime, tests, and control-server
- Cross-concern imports updated to explicit paths between concern folders

## Files Moved

| Concern | Modules |
|---------|---------|
| execution/ | agent-runner, agent-registry, workflow-runner, run-recursive-prompt, execution-controller, ui-execution-runner, model-provider, model-library, resource-cleanup, runtime-events |
| graph/ | graph-planner, graph-executor, graph-workflow-store, graph-workflow-serializer, graph-workflow-runner, graph-workflow-types |
| memory/ | memory-manager, memory-resolver, semantic-memory-index, session-memory-bridge |

## Task Commits

1. **Application concern grouping** - `ff8482e` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed inline import paths in graph-workflow-runner**
- **Found during:** Task 5 (regression gate)
- **Issue:** Inline `import("../domain/types.js")` type references broke after folder move
- **Fix:** Updated to `../../domain/types.js`
- **Files modified:** src/application/graph/graph-workflow-runner.ts
- **Committed in:** ff8482e

**2. [Rule 3 - Blocking] Prettier formatting on moved files**
- **Found during:** Task 5 (regression gate)
- **Issue:** format:check failed on 4 moved files
- **Fix:** Ran prettier --write
- **Committed in:** ff8482e

## Issues Encountered

None beyond auto-fixed import/format issues during regression gate.

## Next Phase Readiness

- Phase 46 can expand `plugins/` with PluginLoader and plugin manager
- Phase 47 can mirror test structure and update AGENTS.md concern map

## Self-Check: PASSED

- Concern folders exist under src/application/
- Commit `ff8482e` found in git log
- 360/360 tests pass via `npm run check`

---
*Phase: 45-application-concern-grouping*
*Completed: 2026-05-22*
