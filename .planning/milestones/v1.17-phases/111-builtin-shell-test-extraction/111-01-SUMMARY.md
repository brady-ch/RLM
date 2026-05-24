---
phase: 111-builtin-shell-test-extraction
plan: 01
subsystem: testing
tags: [rust, plugins, builtin, shell, test-extraction, path-stub]

requires:
  - phase: 110-builtin-write-file-test-extraction
    provides: "builtin #[path] stub pattern with 3-level path from src/plugins/builtin/"
provides:
  - Mirrored shell unit tests under crates/rlm-core/tests/plugins/builtin/
  - Thin #[path] stub in shell.rs with zero inline test bodies
affects:
  - 112-builtin-web-tools-test-extraction

tech-stack:
  added: []
  patterns:
    - "#[path] stub at ../../../tests/plugins/builtin/shell.rs from src/plugins/builtin/ (3 levels)"

key-files:
  created:
    - crates/rlm-core/tests/plugins/builtin/shell.rs
  modified:
    - crates/rlm-core/src/plugins/builtin/shell.rs

key-decisions:
  - "shell.rs #[path] stub uses ../../../tests/plugins/builtin/shell.rs (3 levels from src/plugins/builtin/)"
  - "shell.rs post-extraction: 181 lines — no split needed (threshold 300)"

patterns-established:
  - "plugins test mirror extended: shell.rs alongside write_file.rs under tests/plugins/builtin/"

requirements-completed: [PLUG-111-01, PLUG-111-02, PLUG-111-03, PLUG-111-04]

duration: 10min
completed: 2026-05-24
---

# Phase 111 Plan 01: Builtin Shell Test Extraction Summary

**Inline shell tests extracted to tests/plugins/builtin/shell.rs via 3-level #[path] stub; blocked-operator rejection and allowlist acceptance tests pass unchanged**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-24T13:00:00Z
- **Completed:** 2026-05-24T13:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `crates/rlm-core/tests/plugins/builtin/shell.rs` with `rejects_blocked_operators` and `allows_allowlisted_command` moved verbatim
- Replaced inline `#[cfg(test)] mod tests` in `shell.rs` with thin `#[path]` stub using 3-level relative path
- 2 shell_tests pass; rust boundary baseline remains at 0 entries

## Task Commits

Each task was committed atomically:

1. **Task 1: Create mirrored tests/plugins/builtin/shell.rs** - `2549b32` (test)
2. **Task 2: Replace inline tests with #[path] stub** - `b274ca4` (feat)

## Files Created/Modified

- `crates/rlm-core/tests/plugins/builtin/shell.rs` - Extracted sync unit tests for command validation
- `crates/rlm-core/src/plugins/builtin/shell.rs` - Production-only module with #[path] stub to mirrored tests

## Decisions Made

- shell.rs #[path] stub uses `../../../tests/plugins/builtin/shell.rs` (3 levels from src/plugins/builtin/)
- shell.rs post-extraction: 181 lines — no split needed (threshold 300)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Verification

- `cargo test -p rlm-core shell_tests -- --test-threads=1` — 2 passed
- `bash scripts/check-rust-boundaries.sh` — passed, baseline 0 entries
- `npm run test:agent:verify:light` — all 3 steps passed

## Next Phase Readiness

- Phase 112 (builtin web tools test extraction) can follow same pattern with 3-level path from src/plugins/builtin/
- plugins test mirror tree now includes shell.rs alongside write_file.rs

## Self-Check: PASSED

- FOUND: crates/rlm-core/tests/plugins/builtin/shell.rs
- FOUND: 2549b32
- FOUND: b274ca4

---
*Phase: 111-builtin-shell-test-extraction*
*Completed: 2026-05-24*
