---
phase: 73-ui-resume-control
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - crates/rlm-cli/src/commands/ui.rs
  - crates/rlm-core/src/control_server/handlers/common.rs
  - crates/rlm-core/src/control_server/handlers/events.rs
  - crates/rlm-core/src/control_server/handlers/session.rs
  - crates/rlm-core/src/control_server/handlers/chat.rs
  - crates/rlm-core/src/server.rs
  - crates/rlm-core/tests/chat_routes.rs
  - crates/rlm-core/tests/control_server_fixtures.rs
  - crates/rlm-core/tests/graph_executor_routes.rs
  - crates/rlm-core/tests/model_library_routes.rs
  - crates/rlm-core/tests/persistence_control_server.rs
  - crates/rlm-core/tests/plugin_routes.rs
  - src-tauri/src/main.rs
  - tests/fixtures/control-server/session-idle.json
  - ui/src/app/TopBar.tsx
  - ui/src/shared/types.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
fix_applied: true
fix_commits: 4d8378a
---

# Phase 73: Code Review Report

**Reviewed:** 2026-05-22
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found (3 warnings auto-fixed)

## Summary

Phase 73 correctly exposes `runState.resumable` on REST/SSE session snapshots, adds HTTP integration tests for the resume confirm gate, and wires a TopBar resume button with `GraphActionModal` confirmation. The core UI/server wiring is sound and tests pass.

Three warnings were found: two in the resume acceptance path (predicate mismatch and silent no-op when graph readiness blocks execution) and one side effect in the resumability probe. All three were auto-fixed in `chat.rs` and `common.rs`. No blockers remain.

## Critical Issues

None.

## Warnings

### WR-01: Resume API returned success without starting execution

**File:** `crates/rlm-core/src/control_server/handlers/chat.rs:161-168`
**Issue:** `chat_resume_run` returned HTTP 200 with `"resumed": true` even when `confirm_graph_and_run()` reported `draft` readiness (e.g. pending mutation), so the TopBar `runAction` path showed no error while nothing executed.
**Fix:** Return `409 CONFLICT` when execution is already running or readiness is not `ready_to_run`; only call `spawn_graph_execution` after those guards pass.

### WR-02: Resume acceptance predicate did not require `resumeCursor`

**File:** `crates/rlm-core/src/control_server/handlers/chat.rs:150-159`
**Issue:** `load_resume_state()` returns `Some(...)` for any persisted snapshot, including snapshots without `resumeCursor`. Phase 73 D-04 requires mirroring the cursor-based predicate used by `run_state_resumable_json`, so direct API calls could resume without a valid cursor while the UI correctly hid the button.
**Fix:** Check `persistence.get_snapshot()` and reject with `404` when `resume_cursor` is absent, matching `run_state_resumable_json`.

### WR-03: Session poll created run-state directory as a side effect

**File:** `crates/rlm-core/src/control_server/handlers/common.rs:31-34`
**Issue:** `run_state_resumable_json` called `fs::create_dir_all` while computing read-only resumability, creating `.planning/runs` on idle session polls when the directory was missing.
**Fix:** Treat a missing directory as not resumable without creating it.

## Info

### IN-01: Unscoped src-tauri changes in 73-03 commit

**File:** `src-tauri/src/main.rs`
**Issue:** Commit `da1cf64` includes Ollama lifecycle and shutdown threading changes beyond TopBar resume wiring documented in `73-03-SUMMARY.md`. Code quality looks acceptable (idempotent `stop()`, non-blocking window close), but the scope drift increases review surface for a UI-only plan.
**Fix:** Split unrelated desktop-runtime fixes into a separate commit/phase in future work; no code change required for phase 73 correctness.

---

_Reviewed: 2026-05-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
