---
phase: 97-persistence-config-facade
plan: 01
subsystem: infra
tags: [rust, persistence, config, yaml, boundary]

requires: []
provides:
  - persistence/config submodule tree with loader, validation, defaults, yaml_merge, budget
  - validate_memory_budget single source in persistence/config/budget.rs
affects: [98-persistence-util-test-extraction, phase-106-tool-result-ports]

tech-stack:
  added: []
  patterns:
    - "Config I/O owned by persistence layer, not application orchestration"
    - "application/memory/ram_budget re-exports validate_memory_budget from persistence"

key-files:
  created:
    - crates/rlm-core/src/persistence/config/mod.rs
    - crates/rlm-core/src/persistence/config/defaults.rs
    - crates/rlm-core/src/persistence/config/yaml_merge.rs
    - crates/rlm-core/src/persistence/config/budget.rs
    - crates/rlm-core/src/persistence/config/validation.rs
    - crates/rlm-core/src/persistence/config/loader.rs
  modified:
    - crates/rlm-core/src/application/memory/ram_budget.rs

key-decisions:
  - "Moved validate_memory_budget to persistence/config/budget.rs; ram_budget re-exports for backward compatibility"
  - "Kept #[path] test stub pointing at tests/application/config/loader.rs per deferred scope"

patterns-established:
  - "Persistence config facade exports load_project_config, LoadedProjectConfig, merge_yaml_layers, validate_memory_budget"

requirements-completed: [PERS-97-01, PERS-97-04]

duration: 25min
completed: 2026-05-24
---

# Phase 97 Plan 01: Move Config Modules Summary

**Config loader implementation moved to persistence/config/ with budget validation co-located; zero persistence→application imports in config tree**

## Performance

- **Duration:** 25 min
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Replaced single-file `persistence/config.rs` re-export with full `persistence/config/` submodule tree
- Moved defaults, yaml_merge, validation, loader from application/config verbatim
- Extracted validate_memory_budget to persistence/config/budget.rs; ram_budget re-exports preserve caller paths
- persistence_dual_read and loader_tests pass

## Task Commits

1. **Task 1: Scaffold persistence/config/ and move defaults + yaml_merge** - `e4d1e06` (feat)
2. **Task 2: Move budget validation, validation, loader; wire public exports** - `0b06c4c` (feat)

## Files Created/Modified

- `crates/rlm-core/src/persistence/config/` - Full config loader implementation
- `crates/rlm-core/src/application/memory/ram_budget.rs` - Re-exports validate_memory_budget from persistence

## Decisions Made

- Internal helpers (default_project_plain, is_plain_record) remain pub(crate) — not re-exported from mod.rs
- application/config stubbed to re-export persistence until Plan 02 deletion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Self-Check: PASSED

- FOUND: crates/rlm-core/src/persistence/config/mod.rs
- FOUND: crates/rlm-core/src/persistence/config/loader.rs
- FOUND: e4d1e06
- FOUND: 0b06c4c

---
*Phase: 97-persistence-config-facade*
*Completed: 2026-05-24*
