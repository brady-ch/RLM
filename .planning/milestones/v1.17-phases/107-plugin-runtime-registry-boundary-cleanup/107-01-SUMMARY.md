---
phase: 107-plugin-runtime-registry-boundary-cleanup
plan: 01
subsystem: infra
tags: [rust, ports, plugins, boundary-ratchet, test-extraction]

requires:
  - phase: 106-tool-result-type-ports-consolidation
    provides: "Ports consolidation precedent for cross-layer DTO moves"
provides:
  - "AgentProfile and filter_agent_tools in ports/agent.rs"
  - "Plugin runtime tests extracted to tests/plugins/runtime.rs"
  - "no-plugins-to-application baseline entry removed"
affects: [108-plugin-manifest-test-extraction, plugin-runtime, graph-executor]

tech-stack:
  added: []
  patterns: ["ports-owned agent tool filter DTO", "#[path] test extraction stub"]

key-files:
  created: [crates/rlm-core/src/ports/agent.rs, crates/rlm-core/tests/plugins/runtime.rs]
  modified: [crates/rlm-core/src/plugins/runtime.rs, crates/rlm-core/src/application/execution/agent_registry.rs, scripts/rust-boundary-baseline.json, AGENTS.md]

key-decisions:
  - "AgentProfile and filter_agent_tools live in ports/agent.rs with application re-export shim"
  - "Runtime unit tests use #[path] stub pointing to tests/plugins/runtime.rs"

patterns-established:
  - "Agent tool filtering API exposed through ports for plugins layer consumption"

requirements-completed: [PLUG-107-01, PLUG-107-03]

duration: 12min
completed: 2026-05-24
---

# Phase 107 Plan 01: Plugin Runtime Boundary Summary

**AgentProfile and filter_agent_tools moved to ports/agent.rs; plugin runtime tests extracted; no-plugins-to-application baseline removed**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-24T07:04:00Z
- **Completed:** 2026-05-24T07:16:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Created `ports/agent.rs` with `AgentProfile` DTO and `filter_agent_tools` helper
- Repointed `plugins/runtime.rs` and `graph/executor.rs` to ports imports (zero application imports in plugins runtime)
- Extracted two runtime unit tests to `tests/plugins/runtime.rs` with `#[path]` stub
- Ratcheted boundary baseline from 2 entries to 1 (removed `no-plugins-to-application`)

## Task Commits

1. **Task 1: Move AgentProfile and filter_agent_tools to ports** - `b4db530` (feat)
2. **Task 2: Extract runtime tests and ratchet application baseline entry** - `0eef133` (feat)

## Files Created/Modified

- `crates/rlm-core/src/ports/agent.rs` - AgentProfile DTO and filter_agent_tools
- `crates/rlm-core/tests/plugins/runtime.rs` - Extracted runtime unit tests
- `crates/rlm-core/src/plugins/runtime.rs` - Ports import + #[path] test stub
- `crates/rlm-core/src/application/execution/agent_registry.rs` - Re-export shim, resolve_agent unchanged
- `scripts/rust-boundary-baseline.json` - Removed runtime.rs deferral entry
- `AGENTS.md` - Removed runtime.rs row from transitional baseline table

## Decisions Made

- Used single `pub use crate::ports::{filter_agent_tools, AgentProfile}` at top of agent_registry.rs (separate use + re-export caused E0252)
- Kept application/execution re-export shim for backward compat per Phase 105 precedent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate AgentProfile import in agent_registry.rs**
- **Found during:** Task 1
- **Issue:** Separate `use` and `pub use` for AgentProfile caused E0252 and E0603
- **Fix:** Consolidated to single `pub use crate::ports::{filter_agent_tools, AgentProfile}` at module top
- **Files modified:** crates/rlm-core/src/application/execution/agent_registry.rs
- **Commit:** b4db530

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

- Plan 02 can proceed: registry service persistence decoupling is the remaining baseline entry
- Runtime tests pass via `cargo test -p rlm-core runtime_tests`

---
*Phase: 107-plugin-runtime-registry-boundary-cleanup*
*Completed: 2026-05-24*

## Self-Check: PASSED

- FOUND: crates/rlm-core/src/ports/agent.rs
- FOUND: crates/rlm-core/tests/plugins/runtime.rs
- FOUND: b4db530
- FOUND: 0eef133
