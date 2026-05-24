---
phase: 107-plugin-runtime-registry-boundary-cleanup
plan: 02
subsystem: infra
tags: [rust, ports, plugins, boundary-ratchet, registry]

requires:
  - phase: 107-plugin-runtime-registry-boundary-cleanup
    provides: "Plan 01 ports consolidation and first baseline ratchet"
provides:
  - "PluginRegistryConfig port DTO for registry service injection"
  - "Empty rust-boundary-baseline.json (zero deferrals)"
  - "Strict boundary mode passes"
affects: [108-plugin-manifest-test-extraction, plugin-registry, rlm-cli]

tech-stack:
  added: []
  patterns: ["composition-boundary config injection via port DTO"]

key-files:
  created: [crates/rlm-core/src/ports/plugin_registry_config.rs]
  modified: [crates/rlm-core/src/plugins/registry/service.rs, crates/rlm-core/src/control_server/mod.rs, crates/rlm-cli/src/commands/plugin.rs, scripts/rust-boundary-baseline.json, AGENTS.md]

key-decisions:
  - "PluginRegistryConfig built at composition boundary, not From<LoadedProjectConfig>"
  - "rlm-cli plugin command updated to construct port DTO at CLI composition edge"

patterns-established:
  - "Registry service depends on ports only; persistence types stay at bootstrap"

requirements-completed: [PLUG-107-02, PLUG-107-04, PLUG-107-05]

duration: 10min
completed: 2026-05-24
---

# Phase 107 Plan 02: Registry Boundary Summary

**PluginRegistryConfig port DTO injected at composition boundary; transitional baseline cleared to zero deferrals**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-24T07:12:00Z
- **Completed:** 2026-05-24T07:16:20Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Created `ports/plugin_registry_config.rs` with `PluginRegistryConfig` DTO
- Repointed `PluginRegistryService::new` to accept port config (zero persistence imports under plugins/)
- Updated control_server bootstrap, integration tests, and rlm-cli plugin command call sites
- Cleared `rust-boundary-baseline.json` to empty array; strict boundary check passes
- `npm run test:agent:verify:light` passes

## Task Commits

1. **Task 1: Add PluginRegistryConfig port and repoint registry service** - `7048065` (feat)
2. **Task 2: Clear baseline and verify zero deferrals** - `900a88b` (feat)

## Files Created/Modified

- `crates/rlm-core/src/ports/plugin_registry_config.rs` - Registry config port DTO
- `crates/rlm-core/src/plugins/registry/service.rs` - Accepts PluginRegistryConfig, no persistence import
- `crates/rlm-core/src/control_server/mod.rs` - Builds PluginRegistryConfig at bootstrap
- `crates/rlm-cli/src/commands/plugin.rs` - CLI composition boundary config extraction
- `crates/rlm-core/tests/plugin_registry.rs` - Test call site updated
- `crates/rlm-core/tests/skill_interop.rs` - Doctor test call site updated
- `scripts/rust-boundary-baseline.json` - Empty array
- `AGENTS.md` - Baseline table replaced with Phase 107 completion note

## Decisions Made

- No `From<&LoadedProjectConfig>` on port type to avoid reintroducing persistence coupling
- rlm-cli plugin command included in Task 2 (missed in plan file list but required for cargo check)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated rlm-cli plugin command call site**
- **Found during:** Task 2 verification (`npm run test:agent:verify:light`)
- **Issue:** `crates/rlm-cli/src/commands/plugin.rs` still passed `&LoadedProjectConfig` to `PluginRegistryService::new`
- **Fix:** Build `PluginRegistryConfig` from loaded config at CLI composition boundary
- **Files modified:** crates/rlm-cli/src/commands/plugin.rs
- **Commit:** 900a88b

## Issues Encountered

- `control_server_matches_golden_fixtures` fails when available RAM is below model requirement (`runBlocked: true` vs golden `false`) — pre-existing RAM-dependent flake documented in Phase 106; not caused by boundary changes. All other rlm-core tests pass (60 unit + integration suites except this fixture).

## User Setup Required

None

## Next Phase Readiness

- v1.17 plugins boundary debt fully cleared; strict mode passes
- Phase 108 plugin manifest test extraction can proceed

---
*Phase: 107-plugin-runtime-registry-boundary-cleanup*
*Completed: 2026-05-24*

## Self-Check: PASSED

- FOUND: crates/rlm-core/src/ports/plugin_registry_config.rs
- FOUND: 7048065
- FOUND: 900a88b
- FOUND: scripts/rust-boundary-baseline.json (empty)
