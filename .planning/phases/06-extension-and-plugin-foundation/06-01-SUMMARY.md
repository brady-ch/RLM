---
phase: 06-extension-and-plugin-foundation
plan: 06-01
subsystem: extension
tags: [extensions, plugins, config, ports]
requires:
  - phase: v1.0
    provides: CLI composition root, tool adapters, and configuration loading
provides:
  - Extension port contracts for manifests and registry entries
  - Skill loader port stub for Phase 7
  - ExtensionHost with tool, skill-loader, and model-host registries
  - Optional YAML extensions config block
affects: [phase-07-mcp-and-skills, phase-08-model-hosts]
tech-stack:
  added: []
  patterns: [allowlist-before-import, config-dir-relative extension resolution, duplicate registration rejection]
key-files:
  created:
    - src/ports/extension-port.ts
    - src/ports/skill-loader-port.ts
    - src/application/extension-host.ts
  modified:
    - src/application/project-config.ts
key-decisions:
  - "Extension allowlist keys are SHA-256 hashes of absolute resolved paths."
  - "Relative extension paths resolve from the config file directory."
  - "Registries throw on duplicate names instead of silently overwriting."
patterns-established:
  - "First-party modules can register through loadBuiltins without dynamic import."
  - "External modules are approved before import() is called."
requirements-completed: [PLUG-01]
duration: 20min
completed: 2026-05-10
---

# Phase 6 Plan 06-01 Summary

**Typed extension contracts, trust-gated extension loading, and backward-compatible YAML config parsing for plugins**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-10T00:15:00Z
- **Completed:** 2026-05-10T02:35:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added public extension contracts: `ExtensionRegistryEntry`, `ExtensionManifest`, and `SkillLoaderPort`.
- Implemented `ExtensionHost` with registries for tools, skill loaders, and model hosts.
- Added trust gating for external extensions: config-relative path resolution, SHA-256 allowlist checks, optional interactive approval, and import only after approval.
- Extended `ProjectConfig` and the zod schema with optional `extensions.allowlist` and `extensions.load[]`.

## Task Commits

1. **Task 1: Define extension port contracts** - `522379d` (`feat(06-01): define extension port contracts`)
2. **Task 2: Implement ExtensionHost** - `978d4f3` (`feat(06-01): implement extension host`)
3. **Task 3: Extend YAML config schema for extensions[]** - `057a483` (`feat(06-01): parse extension config`)

## Files Created/Modified

- `src/ports/extension-port.ts` - Extension manifest and YAML registry entry interfaces.
- `src/ports/skill-loader-port.ts` - Minimal skill loader shape for Phase 7.
- `src/application/extension-host.ts` - Registry and extension load lifecycle.
- `src/application/project-config.ts` - Optional `extensions` schema and TypeScript config field.

## Decisions Made

- Followed the plan's config-dir-relative resolution so extension config remains portable with non-root config paths.
- Stored allowlist JSON as a hash-to-path object, which is easy to merge and inspect.
- Kept first-party `loadBuiltins` separate from external dynamic import so built-in registration can be synchronous and trust-free at the composition root.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None.

## Issues Encountered

- `npm test` initially failed in the sandbox because the existing control-server test could not bind `127.0.0.1` (`EPERM`). Re-running with elevated permission passed.

## Verification

- `npm run build` - passed.
- `npm test` - passed with elevated permission for localhost binding.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 2 can now rewire the CLI composition root through `ExtensionHost`, create first-party tool registration shims, and add integration tests for third-party extension loading.

## Self-Check: PASSED

All tasks, acceptance criteria, and plan-level verification completed.
