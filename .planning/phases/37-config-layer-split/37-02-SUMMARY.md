---
phase: 37-config-layer-split
plan: "02"
subsystem: application-config
tags: [filesystem, yaml, validation]

requires:
  - phase: 37-01
    provides: schema, defaults, merge layers
provides:
  - loadProjectConfig path-tagged errors
  - Internal validateConfigReferences
affects: [37-03]

tech-stack:
  added: []
  patterns: [loader module imports validation after parse]

key-files:
  created:
    - src/application/config/loader.ts
    - src/application/config/validation.ts
  modified:
    - src/application/project-config.ts

key-decisions:
  - "Exported safeStat/parseYamlTagged/findDefaultConfigPath from loader per plan artifacts; not re-exported via façade."

patterns-established: []

requirements-completed: [CONF-01, CONF-02, CONF-03, REG-01, REG-02]

duration: ""
completed: "2026-05-22"
---

# Phase 37 Plan 02: Loader & validation split Summary

**YAML discovery, scoped fragment merge, Zod parse ordering, and internal reference validation are isolated under `application/config/` without changing public façade symbols beyond `loadProjectConfig` forwarding.**

## Performance

- **Commit:** `2dd2dea`

## Deviations from Plan

Merged duplicate `access` imports in `loader.ts` after TypeScript duplicate identifier error (Rule 3 blocking fix).

## Self-Check: PASSED

- `npm run check` green (205 tests)
- `validateConfigReferences` not present on façade (grep)
