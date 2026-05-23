---
phase: 75-skill-interop-depth
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - crates/rlm-core/src/application/execution/runtime_events.rs
  - crates/rlm-core/src/interop/skill_runtime.rs
  - crates/rlm-core/src/ports/skill_loader.rs
  - crates/rlm-core/src/plugins/extension_host.rs
  - crates/rlm-core/src/plugins/registry/doctor.rs
  - crates/rlm-core/tests/skill_interop.rs
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 75: Code Review Report

**Reviewed:** 2026-05-22
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 75 delivers structured `SKILL_PARSE_ERROR` lifecycle events in `SkillRuntime.resolve_skill`, an async `ManifestSkillLoader.load()` with registration merge into `SkillInteropConfig.search_paths`, and doctor coverage for loader paths. Core behavior is correct and all nine `skill_interop` tests pass.

No blockers were found. Four warnings remain: loader registration does not emit lifecycle events on failure (D-02 gap), a no-op discovery call in `load()`, inconsistent poisoned-mutex handling in `search_paths()`, and a weakened path-containment check when `canonicalize()` fails. Two info items note deferred event-sink wiring and a doctor issue-code naming inconsistency.

## Warnings

### WR-01: Loader load failures omit structured lifecycle events

**File:** `crates/rlm-core/src/plugins/extension_host.rs:112-118`
**Issue:** D-02 requires manifest loader failures to propagate as structured lifecycle events. `register_manifest_skill_loaders_async` only pushes plain strings to the warnings vector; no `RuntimeEventSink` is available on this path. Parse failures during skill resolution emit events, but directory-missing / load errors at registration time do not.
**Fix:** Thread an optional `Arc<dyn RuntimeEventSink>` and `run_id` through `register_manifest_skill_loaders_async` and `load_skill_interop`, emitting a lifecycle event (e.g. `SKILL_LOADER_LOAD_FAILED`) with path and reason before pushing the warning string.

### WR-02: `ManifestSkillLoader.load()` calls discovery but discards results

**File:** `crates/rlm-core/src/ports/skill_loader.rs:58`
**Issue:** `discover_skill_candidates` is invoked and its return value is dropped. Discovery errors are not propagated, invalid skills are not surfaced, and the call has no effect on `loaded_paths` (which always stores only `root_path`). This reads as incomplete implementation relative to plan 75-02 Task 1.
**Fix:** Either remove the no-op call (root path alone is sufficient for merge + runtime discovery) or persist discovery outcomes and surface invalid candidates via events/doctor during load.

### WR-03: Poisoned mutex in `search_paths()` silently returns empty paths

**File:** `crates/rlm-core/src/ports/skill_loader.rs:43-47`
**Issue:** `search_paths()` uses `unwrap_or_default()` on lock failure, returning an empty vec. A registered loader would then contribute no paths to `merge_manifest_loader_search_paths`, causing manifest skills to be invisible without any error. `load()` correctly returns `Err` on poison.
**Fix:** Align with `load()` — propagate failure via `map_err` and `expect`, or change the trait to return `Result<Vec<PathBuf>, String>`.

### WR-04: Path containment check weakens when `canonicalize()` fails

**File:** `crates/rlm-core/src/plugins/extension_host.rs:84-86`
**Issue:** When `resolved.canonicalize()` fails (path does not yet exist), the check falls back to the non-canonical `resolved` path. `Path::starts_with` does not normalize `..` components, so containment verification is weaker for not-yet-created loader directories than for existing paths.
**Fix:** Reject loader paths that contain `ParentDir` components when canonicalization fails, or require the resolved path to exist before the containment check.

## Info

### IN-01: Production skill runtime uses `NoopRuntimeEventSink`

**File:** `crates/rlm-core/src/interop/skill_runtime.rs:461`
**Issue:** `load_skill_interop` constructs `SkillRuntime::new` with an empty `run_id` and `NoopRuntimeEventSink`, so `SKILL_PARSE_ERROR` events are not observable in the default `build_runtime_context` path. Plan 75-01 explicitly deferred wiring; acceptable for this phase but limits observability until execution-layer sink integration.
**Fix:** Pass run-scoped sink and `run_id` from session/bootstrap when available.

### IN-02: Doctor reuses `skill_loader_load_failed` for path rejection

**File:** `crates/rlm-core/src/plugins/registry/doctor.rs:228-229`
**Issue:** Path-escape rejection from `resolve_manifest_loader_path` uses code `skill_loader_load_failed` with message prefix "path rejected", conflating validation failure with load failure. `invalid_skill_loader_path` is used for missing directories.
**Fix:** Introduce a distinct code such as `skill_loader_path_rejected` for traversal/escape errors.

---

## Fixes Applied (post-review)

- **WR-02:** Removed no-op `discover_skill_candidates` call from `ManifestSkillLoader.load()` (`skill_loader.rs:58`).
- **WR-03:** Replaced `unwrap_or_default()` with panic-on-poison in `search_paths()` to match `load()` failure semantics (`skill_loader.rs:43-47`).

**Verification:** `cargo test -p rlm-core --test skill_interop` — 9 passed.

---

_Reviewed: 2026-05-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
