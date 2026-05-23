---
phase: 75-skill-interop-depth
plan: 02
subsystem: plugins
tags: [rust, skill-loader, manifest, async]

requires:
  - phase: 75-01
    provides: RuntimeEvent infrastructure for parse/load failures
provides:
  - SkillLoader async load() trait method
  - Manifest path merge into SkillRuntime search paths
  - Doctor skill_loader_load_failed issues
affects: [plugin-doctor, skill-tool, runtime-init]

tech-stack:
  added: []
  patterns:
    - "block_on async loader registration in sync build_runtime_context path"
    - "Path traversal guard on manifest skill loader roots"

key-files:
  modified:
    - crates/rlm-core/src/ports/skill_loader.rs
    - crates/rlm-core/src/plugins/extension_host.rs
    - crates/rlm-core/src/plugins/builtin/mod.rs
    - crates/rlm-core/src/plugins/runtime.rs
    - crates/rlm-core/src/plugins/registry/doctor.rs
    - crates/rlm-core/src/interop/skill_runtime.rs
    - crates/rlm-core/tests/skill_interop.rs

key-decisions:
  - "Skip loader registration on load failure; surface warning string in interop_warnings"
  - "Merge loader search_paths into SkillInteropConfig at load_skill_interop time"

patterns-established:
  - "resolve_manifest_loader_path canonicalizes and rejects paths escaping plugin root"

requirements-completed: [PLUG-05]

duration: 25min
completed: 2026-05-22
---

# Phase 75 Plan 02: ManifestSkillLoader async load Summary

**ManifestSkillLoader.load() discovers declarative skill paths, merges them into runtime search paths, and doctor reports load failures**

## Performance

- **Duration:** 25 min
- **Tasks:** 2 (combined in single commit)
- **Files modified:** 7

## Accomplishments

- Extended `SkillLoader` trait with `async fn load()` and `search_paths()`
- `register_manifest_skill_loaders_async` awaits load before registration
- Merged loaded manifest paths into `SkillRuntime` config so skill tool resolves declarative skills
- Doctor emits `skill_loader_load_failed` with path and reason on load errors

## Task Commits

1. **SkillLoader.load + registration merge** - `d1da8e1` (feat)

## Files Created/Modified

- `crates/rlm-core/src/ports/skill_loader.rs` - Async load implementation
- `crates/rlm-core/src/plugins/extension_host.rs` - Async registration + path guard
- `crates/rlm-core/src/interop/skill_runtime.rs` - Search path merge
- `crates/rlm-core/tests/skill_interop.rs` - Loader load + end-to-end manifest skill tests

## Decisions Made

- Used `block_on` in sync `load_builtins` / `register_manifest_skill_loaders` wrapper
- Loader registration skipped on hard load failure (directory missing)

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

None

## Next Phase Readiness

- Phase 76 packaging/boundary hygiene can proceed independently

## Self-Check: PASSED

- FOUND: crates/rlm-core/src/ports/skill_loader.rs (async load)
- FOUND: d1da8e1

---
*Phase: 75-skill-interop-depth*
*Completed: 2026-05-22*
