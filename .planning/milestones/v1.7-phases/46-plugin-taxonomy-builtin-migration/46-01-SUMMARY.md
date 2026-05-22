---
phase: 46-plugin-taxonomy-builtin-migration
plan: 01
subsystem: plugins
tags: [plugins, zod, manifest, taxonomy, extension-host, builtin-migration]

requires:
  - phase: 45-application-concern-grouping
    provides: plugins/ application concern facade for manager expansion
provides:
  - Zod-validated rlm.plugin.json manifest schema
  - PluginLoader unified discovery (builtins, configured, catalog)
  - Built-in tools under src/plugins/builtin/ with register(host)
  - Legacy extensions.load YAML compat shim
  - AGENTS.md plugin taxonomy documentation
affects: [47-concern-map-tests, 49-plugin-manager-cli]

tech-stack:
  added: []
  patterns:
    - "Manifest validated before dynamic import()"
    - "Plugin categories shell/files/web/interop"
    - "Strangler re-export from adapters barrel for transitional imports"

key-files:
  created:
    - src/plugins/manifest-schema.ts
    - src/plugins/plugin-loader.ts
    - src/plugins/builtin/index.ts
    - tests/plugins/plugin-loader.test.ts
  modified:
    - src/runtime/composition/build-runtime-context.ts
    - src/adapters/index.ts
    - AGENTS.md

key-decisions:
  - "Tool implementations live under plugins/builtin/; adapters barrel re-exports for test compatibility during strangler migration"
  - "Legacy extensions.load entries synthesize interop-category manifests when no rlm.plugin.json exists on disk"
  - "PluginLoader requires ExtensionHost instance for external allowlist-gated import()"

patterns-established:
  - "New tools ship as plugin packages with rlm.plugin.json + register(host), not adapters/tools/"
  - "Discovery order: builtins → configured (legacy YAML) → .rlm/plugins/catalog.json"

requirements-completed: [PLUG-01, PLUG-02, PLUG-03, PLUG-04, PLUG-05, PLUG-06, TAXN-04]

duration: 45min
completed: 2026-05-22
---

# Phase 46 Plan 01: Plugin Taxonomy & Builtin Migration Summary

**Unified plugin manifest validation and PluginLoader discovery with built-in shell/files/web tools migrated to src/plugins/builtin/**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-22T00:00:00Z
- **Completed:** 2026-05-22T00:45:00Z
- **Tasks:** 3
- **Files modified:** 29

## Accomplishments

- Added Zod-validated `rlm.plugin.json` schema with shell/files/web/interop category taxonomy
- Implemented `PluginLoader` replacing hardcoded `loadBuiltins([...])` with builtins → configured → catalog discovery
- Migrated built-in tools to `src/plugins/builtin/{shell,files,web}/` with manifest + `register(host)`
- Preserved legacy `extensions.load` YAML via compat shim that synthesizes manifest shape when no on-disk manifest exists
- Updated AGENTS.md with canonical plugin taxonomy and extension guidance

## Task Commits

1. **Task 1: Manifest schema and PluginLoader** - `93e8c3d` (feat)
2. **Task 2: Builtin migration and bootstrap wiring** - `fae5732` (feat)
3. **Task 3: Tests and contributor docs** - `79b0526` (test)

## Files Created/Modified

- `src/plugins/manifest-schema.ts` - Zod schema and pre-import validation helpers
- `src/plugins/plugin-loader.ts` - Unified discovery and list/doctor-ready descriptors
- `src/plugins/builtin/` - First-party shell, files, web plugins with manifests
- `src/runtime/composition/build-runtime-context.ts` - Wires PluginLoader instead of inline builtins
- `tests/plugins/plugin-loader.test.ts` - Manifest, builtin, and legacy compat coverage
- `AGENTS.md` - Plugin taxonomy and contributor placement rules

## Decisions Made

- Adapters barrel re-exports builtin tool classes from `plugins/builtin/` so existing tests keep stable import paths during strangler migration
- Legacy YAML entries without on-disk manifests receive synthesized interop-category descriptors validated before import

## Deviations from Plan

None - executed from ROADMAP success criteria (no pre-existing PLAN.md on disk).

## Issues Encountered

- Plugin manifest validation test needed `mkdir` before writing nested plugin directory

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 47 can publish concern map, mirror tests layout, and add depcruise rules for plugins/runtime paths
- Phase 49+ can build `rlm plugin list/doctor` CLI on top of `PluginLoader.listPlugins()` and `formatListOutput()`

## Self-Check: PASSED

- FOUND: src/plugins/plugin-loader.ts
- FOUND: src/plugins/builtin/shell/rlm.plugin.json
- FOUND: tests/plugins/plugin-loader.test.ts
- FOUND: 93e8c3d
- FOUND: fae5732
- FOUND: 79b0526
- npm run check: 365 tests pass

---
*Phase: 46-plugin-taxonomy-builtin-migration*
*Completed: 2026-05-22*
