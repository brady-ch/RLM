---
phase: 75-skill-interop-depth
plan: 01
subsystem: interop
tags: [rust, runtime-events, skills, SKILL_PARSE_ERROR]

requires: []
provides:
  - RuntimeEvent types and RuntimeEventSink trait in Rust
  - SkillRuntime lifecycle emission for SKILL_PARSE_ERROR
affects: [75-02, plugin-doctor, observability]

tech-stack:
  added: []
  patterns:
    - "Injectable RuntimeEventSink on SkillRuntime with seq/run_id"
    - "ResolvedSkill.warnings as Vec<RuntimeEvent>"

key-files:
  created:
    - crates/rlm-core/src/application/execution/runtime_events.rs
  modified:
    - crates/rlm-core/src/application/execution/mod.rs
    - crates/rlm-core/src/interop/skill_runtime.rs
    - crates/rlm-core/tests/skill_interop.rs

key-decisions:
  - "RuntimeEvent module lives under application/execution mirroring TS layering"
  - "Sync RuntimeEventSink trait; tests use InMemoryRuntimeEventStore"

patterns-established:
  - "SKILL_PARSE_ERROR events use code/source/subject/severity matching TS McpSkillRuntime"

requirements-completed: [PLUG-04]

duration: 20min
completed: 2026-05-22
---

# Phase 75 Plan 01: RuntimeEvent + SKILL_PARSE_ERROR Summary

**Structured SKILL_PARSE_ERROR lifecycle events in Rust SkillRuntime with warn/error severity parity to TypeScript**

## Performance

- **Duration:** 20 min
- **Tasks:** 2 (combined in single commit)
- **Files modified:** 4

## Accomplishments

- Added `RuntimeEvent`, `RuntimeEventSeverity`, `RuntimeEventSink`, and `InMemoryRuntimeEventStore`
- Wired `SkillRuntime::with_event_sink` to emit lifecycle events on invalid skill candidates
- Changed `ResolvedSkill.warnings` to structured `Vec<RuntimeEvent>`
- Added lenient/strict lifecycle event tests in `skill_interop.rs`

## Task Commits

1. **RuntimeEvent types + SkillRuntime wiring** - `5285a5b` (feat)

## Files Created/Modified

- `crates/rlm-core/src/application/execution/runtime_events.rs` - Event types, fingerprint helper, in-memory sink
- `crates/rlm-core/src/interop/skill_runtime.rs` - Event emission in `resolve_skill`
- `crates/rlm-core/tests/skill_interop.rs` - Lifecycle event assertions

## Decisions Made

- Sync sink trait (no async emit) — sufficient for skill parse path and testability
- Kept `message` field sourced from candidate reason only (T-75-01 mitigation)

## Deviations from Plan

None - plan executed as written. TDD RED/GREEN combined in one commit due to tight coupling between test API and SkillRuntime sink wiring.

## Issues Encountered

None

## Next Phase Readiness

- Event sink available for manifest loader registration failures in 75-02

## Self-Check: PASSED

- FOUND: crates/rlm-core/src/application/execution/runtime_events.rs
- FOUND: 5285a5b

---
*Phase: 75-skill-interop-depth*
*Completed: 2026-05-22*
