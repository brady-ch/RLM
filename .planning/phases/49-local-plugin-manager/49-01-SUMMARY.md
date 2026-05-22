---
phase: 49-local-plugin-manager
plan: 01
subsystem: plugins
tags: [plugin-manager, cli, control-server, catalog, registry-service]

requires:
  - phase: 48-dependency-cruiser-ratchet
    provides: strict depcruise boundaries and bootstrap CLI injection
provides:
  - PluginRegistryService shared by CLI and control-server
  - rlm plugin list/install/enable/disable/uninstall/doctor/inspect/validate
  - User catalog at ~/.rlm/plugins with project catalog fallback
  - Control-server /api/plugins routes
affects: [50-remote-fetch, 51-plugin-manager-ui]

tech-stack:
  added: []
  patterns:
    - "PluginRegistryService owns catalog I/O; PluginLoader consumes catalogs at runtime"
    - "Mutation responses always include requiresRestart: true"

key-files:
  created:
    - src/application/plugins/plugin-registry-service.ts
    - src/cli/run-modes/plugin-commands.ts
    - src/application/control-server/handlers/plugins.ts
    - src/plugins/paths.ts
    - tests/application/plugins/plugin-registry-service.test.ts
  modified:
    - src/cli/args.ts
    - src/index.ts
    - src/plugins/plugin-loader.ts
    - src/runtime/composition/build-runtime-context.ts
    - src/application/control-server/route-request.ts
    - src/cli/run-modes/ui.ts

key-decisions:
  - "User install root defaults to ~/.rlm/plugins/<id> with catalog at ~/.rlm/plugins/catalog.json"
  - "Runtime loads user + project catalogs; registry dedupes by plugin id"
  - "Install pre-approves allowlist entry before catalog write (trust gate without code load on validate/inspect)"

requirements-completed: [MGR-01, MGR-02, MGR-03, MGR-04, MGR-05, MGR-06, MGR-07]

duration: 25min
completed: 2026-05-22
---

# Phase 49 Plan 01: Local Plugin Manager Summary

**Shared PluginRegistryService with CLI `rlm plugin` commands and control-server `/api/plugins` routes, user catalog at `~/.rlm/plugins`, and `requiresRestart: true` on mutations**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-22T16:46:20Z
- **Completed:** 2026-05-22T17:11:00Z
- **Tasks:** 4
- **Files modified:** 16

## Accomplishments

- `PluginRegistryService` lists builtins + installed + configured plugins with tool names
- `rlm plugin install <local-path>` copies to user catalog, validates manifest, pre-approves allowlist
- `rlm plugin doctor` exits non-zero on broken manifests/paths/duplicate ids/stale config refs
- Control-server exposes list/install/enable/disable/uninstall/doctor/inspect/validate via same service

## Task Commits

1. **Task 1: PluginRegistryService and catalog paths** - `ad4aa55` (feat)
2. **Task 2: CLI plugin commands** - `15e23cf` (feat)
3. **Task 3: Control-server plugin routes** - `fb8949c` (feat)
4. **Task 4: Tests** - `f7a1a21` (test)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `src/application/plugins/plugin-registry-service.ts` - Catalog CRUD, doctor, inspect, validate
- `src/cli/run-modes/plugin-commands.ts` - CLI dispatch for plugin subcommands
- `src/application/control-server/handlers/plugins.ts` - HTTP API surface
- `src/plugins/paths.ts` - User/project catalog path helpers
- `tests/application/plugins/plugin-registry-service.test.ts` - Registry behavior tests

## Decisions Made

- User-level catalog is canonical install location per ROADMAP; project `.rlm/plugins/catalog.json` remains supported
- `inspect`/`validate` are manifest-only; install applies trust gate via allowlist pre-approval without executing plugin code during validate
- YAML `extensions.load` stale refs reported by doctor; uninstall clears catalog + install dir (no YAML writer yet)

## Deviations from Plan

None - plan authored during execution from ROADMAP requirements; implemented as specified.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 50 remote fetch can extend `installLocal` with archive/git fetch-to-local semantics
- Phase 51 UI can consume existing `/api/plugins` routes

## Self-Check: PASSED

- FOUND: src/application/plugins/plugin-registry-service.ts
- FOUND: tests/application/plugins/plugin-registry-service.test.ts
- FOUND: ad4aa55, 15e23cf, fb8949c, f7a1a21

---
*Phase: 49-local-plugin-manager*
*Completed: 2026-05-22*
