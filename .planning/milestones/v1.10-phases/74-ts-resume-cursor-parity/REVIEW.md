---
phase: 74-ts-resume-cursor-parity
reviewed: 2026-05-22T12:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/application/graph/graph-executor.ts
  - src/domain/run-state-persistence.ts
  - tests/application/graph/graph-executor-resume.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 74: Code Review Report

**Reviewed:** 2026-05-22T12:00:00Z  
**Depth:** standard  
**Files Reviewed:** 3  
**Status:** issues_found

## Summary

Phase 74 adds run-state persistence at graph transitions (`persistNodeStatus`, `persistResumeCursor`), a `resume` flag on `GraphExecutorInput`, and `loadResumeState` / `parseLoadedResumeState` for skip-completed resume. The targeted resume tests pass (`graph-executor-resume.test.js`, existing `graph-executor.test.js`).

Core resume behavior (skip persisted completed nodes, single model call on partial restart) works for the seeded fixture. Remaining issues are Rust-parity gaps and defensive robustness around resume-state loading — none block the seeded resume path, but they can cause duplicate execution or hard failures in edge cases outside the current test coverage.

## Warnings

### WR-01: `shouldSkipExecutionStatus` omits `"completed"` (Rust parity gap)

**File:** `src/application/graph/graph-executor.ts:179-181`  
**Issue:** Rust `should_skip_status` skips `Completed` nodes in addition to `Skipped` and `Cancelled`. TypeScript only skips `"skipped"` and `"cancelled"`. Resume relies on `skipCompleted` (only populated when `resume: true`), so nodes already marked `"completed"` in the session graph are re-executed when `resume` is false or when completed status exists only in the graph snapshot (not in persisted cursor/nodeStatuses). This diverges from Rust and can cause duplicate model calls.  
**Fix:**
```typescript
function shouldSkipExecutionStatus(status: ExecutionStatus): boolean {
  return (
    status === "skipped" ||
    status === "cancelled" ||
    status === "completed"
  );
}
```

### WR-02: `parseLoadedResumeState` can throw on malformed `resumeCursor`

**File:** `src/domain/run-state-persistence.ts:24-27`  
**Issue:** When `snapshot.resumeCursor` is truthy but `completedNodeIds` is missing or not iterable (partial/corrupt JSON on disk), `for (const nodeId of cursor.completedNodeIds)` throws and aborts `executeGraph`. Rust wraps cursor deserialization in `serde_json::from_value` and falls back to node-status-only parsing on failure.  
**Fix:**
```typescript
if (cursor) {
  const cursorCompleted = Array.isArray(cursor.completedNodeIds)
    ? cursor.completedNodeIds
    : [];
  for (const nodeId of cursorCompleted) {
    if (typeof nodeId === "string") {
      completed.add(nodeId);
    }
  }
  return {
    completedNodeIds: [...completed],
    activeNodeId: cursor.activeNodeId,
    variant: cursor.variant,
  };
}
```

### WR-03: Store read errors abort resume instead of degrading gracefully

**File:** `src/application/graph/graph-executor.ts:259`  
**Issue:** `prepareResumeState` awaits `persistence.loadResumeState()` without a try/catch. If `getSnapshot` throws (I/O error, corrupt file), the entire graph run fails. Rust uses `load_resume_state().ok().flatten()` and proceeds with an empty skip set on error, allowing best-effort execution.  
**Fix:**
```typescript
let resume: LoadedResumeState | undefined;
try {
  resume = await persistence.loadResumeState();
} catch {
  resume = undefined;
}
if (!resume) {
  return { skipCompleted, completedNodeIds };
}
```

## Info

### IN-01: `resume` flag not yet wired through production callers

**File:** `src/application/graph/graph-workflow-runner.ts:228-240`, `src/application/execution/ui-execution-runner.ts:69-82`  
**Issue:** `GraphExecutorInput.resume` is implemented but neither workflow runner nor UI execution runner passes `resume: true`. Resume consumption is only exercised in tests until Phase 73/CLI wiring lands (explicitly deferred in phase context).  
**Fix:** Pass `resume: true` (and gate on caller intent) when restarting a run with existing run-state, matching Rust control-server behavior.

### IN-02: Resume tests do not assert post-run cursor persistence

**File:** `tests/application/graph/graph-executor-resume.test.ts:82-147`  
**Issue:** Tests verify skip behavior and model call count but do not read back `FileRunStateStore` after `executeGraph` to confirm `resumeCursor` / final `nodeStatuses` were written at transitions. Regression in persist calls would not be caught.  
**Fix:** After `executeGraph`, call `loadResumeState()` or `getSnapshot` and assert `activeNodeId === "child"` and `completedNodeIds` includes both `"root"` and `"child"`.

---

_Reviewed: 2026-05-22T12:00:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
