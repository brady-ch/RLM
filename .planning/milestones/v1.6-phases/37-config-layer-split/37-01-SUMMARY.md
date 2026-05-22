---
phase: 37-config-layer-split
plan: "01"
subsystem: application-config
tags: [typescript, zod, yaml, esm]

requires: []
provides:
  - Config types and Zod schema in src/application/config/
  - DEFAULT_PROJECT_* and YAML merge helpers
affects: [37-02, 37-03]

tech-stack:
  added: []
  patterns: [application/config subfolder, façade re-export from project-config.ts]

key-files:
  created:
    - src/application/config/types.ts
    - src/application/config/schema.ts
    - src/application/config/defaults.ts
    - src/application/config/yaml-merge.ts
  modified:
    - src/application/project-config.ts

key-decisions:
  - "Exported configSchema from schema.ts for loader use only; façade does not re-export it."
  - "Re-export RecursiveModelConfig is not part of façade (unchanged from monolith)."

patterns-established:
  - "Relative imports under config use ../../domain and ../../ports; façade uses ./config/*.js."

requirements-completed: [CONF-01, CONF-02, REG-01, REG-02]

duration: ""
completed: "2026-05-22"
---

# Phase 37 Plan 01: Config static split Summary

**Zod schema, typed ProjectConfig surface, baked defaults, and YAML layer merge helpers live under `src/application/config/` while `project-config.ts` keeps the same public exports.**

## Performance

- **Tasks:** 3 (single integration commit `93e32ca`)
- **Files modified:** 5

## Task Commits

1. **Plans 01–03 (combined)** - `93e32ca` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Lint] Unused isRamQueueWorkflowConfig import**

- **Found during:** Task 3 (facade rewiring)
- **Issue:** Re-exports used `export { … } from "./config/types.js"`; local import triggered eslint unused-vars.
- **Fix:** Dropped redundant local import of `isRamQueueWorkflowConfig`.
- **Files modified:** src/application/project-config.ts

Removed mistaken extra exports (`RecursiveModelConfig`, `ExtensionRegistryEntry`) and duplicate `DEFAULT_PROJECT_CONFIG` declaration before commit.

None otherwise — plan executed as written.

## Self-Check: PASSED

- `npm run check` green after Wave 1 (`93e32ca`)
- Subsequent waves kept façade imports stable (`2dd2dea`, `5e4d554`).
