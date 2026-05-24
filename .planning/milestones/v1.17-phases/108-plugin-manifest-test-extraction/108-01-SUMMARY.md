---
phase: 108-plugin-manifest-test-extraction
plan: 01
subsystem: testing
tags: [rust, plugins, test-extraction, path-stub]

requires:
  - phase: 107-plugin-runtime-registry-boundary-cleanup
    provides: plugins #[path] stub pattern established in runtime.rs
provides:
  - Mirrored manifest tests at crates/rlm-core/tests/plugins/manifest.rs
  - Thin #[path] stub in manifest.rs with zero inline test bodies
affects:
  - phase-109-plugin-remote-fetch-test-extraction
  - phases-110-112-builtin-plugin-test-extraction

tech-stack:
  added: []
  patterns:
    - "plugins block #[path] stub: ../../tests/plugins/{module}.rs from src/plugins/"

key-files:
  created:
    - crates/rlm-core/tests/plugins/manifest.rs
  modified:
    - crates/rlm-core/src/plugins/manifest.rs

key-decisions:
  - "manifest.rs post-extraction: 126 lines — no split needed (threshold 300 per CONTEXT discretion)"
  - "manifest.rs #[path] stub uses ../../tests/plugins/manifest.rs (2 levels from src/plugins/)"

patterns-established:
  - "Plugin manifest tests follow Phase 107 runtime.rs mirror convention with use super::* child module"

requirements-completed: [PLUG-108-01, PLUG-108-02, PLUG-108-03, PLUG-108-04]

duration: 8min
completed: 2026-05-24
---

# Phase 108 Plan 01: Plugin Manifest Test Extraction Summary

**Plugin manifest inline tests extracted to mirrored `tests/plugins/manifest.rs` via #[path] stub matching Phase 107 runtime convention**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-24T07:20:00Z
- **Completed:** 2026-05-24T07:28:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `crates/rlm-core/tests/plugins/manifest.rs` with `validates_minimal_manifest` and `rejects_missing_id` test bodies
- Replaced inline `#[cfg(test)] mod tests` block in `manifest.rs` with thin `#[path]` stub
- `cargo test -p rlm-core manifest_tests` passes (2 tests)
- Rust boundary check passes with zero baseline entries (unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create mirrored tests/plugins/manifest.rs with extracted test bodies** - `d5c54b8` (test)
2. **Task 2: Replace inline tests with #[path] stub and verify** - `b451243` (refactor)

## Files Created/Modified

- `crates/rlm-core/tests/plugins/manifest.rs` - Extracted manifest validation unit tests
- `crates/rlm-core/src/plugins/manifest.rs` - Production manifest parsing with #[path] stub only

## Decisions Made

- Followed Phase 107 runtime.rs stub pattern exactly (`../../tests/plugins/manifest.rs`)
- No module split — manifest.rs is 126 lines post-extraction, well under 300-line threshold

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plugin manifest test mirror complete; ready for Phase 109 (plugin remote fetch test extraction)
- `tests/plugins/` mirror tree now has `runtime.rs` and `manifest.rs`

---
*Phase: 108-plugin-manifest-test-extraction*
*Completed: 2026-05-24*

## Self-Check: PASSED

- FOUND: crates/rlm-core/tests/plugins/manifest.rs
- FOUND: d5c54b8
- FOUND: b451243
