---
phase: 01-close-v1-8-tech-debt-ui-regressions-mcp-client-cli-parity-ru
reviewed: 2026-05-22T12:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - ui/src/nodes/GraphActionModal.tsx
  - ui/src/app/TopBar.tsx
  - ui/src/styles.css
  - ui/src/legacy/panels.tsx
  - ui/src/nodes/NodeContextMenu.tsx
  - ui/src/nodes/ExecutionNodeCard.tsx
  - crates/rlm-core/src/interop/mcp_stdio_client.rs
  - crates/rlm-core/src/interop/mcp_tools.rs
  - crates/rlm-core/src/plugins/runtime.rs
  - crates/rlm-core/src/control_server/routes.rs
  - crates/rlm-core/src/bootstrap/cli_runtime.rs
  - crates/rlm-cli/src/commands/ask.rs
  - crates/rlm-cli/src/main.rs
  - crates/rlm-core/src/domain/run_state_types.rs
  - crates/rlm-core/src/domain/run_state_persistence.rs
  - crates/rlm-core/src/graph/executor.rs
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 1: Code Review Report

**Reviewed:** 2026-05-22T12:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** clean (fixes verified in source 2026-05-22)

## Summary

Phase 1 spans UI regression fixes (TopBar pause control, GraphActionModal, HF download wiring), Rust MCP stdio client + doctor warnings, CLI `ask` bootstrap, and run-state resume cursor persistence. Two blockers affect user-visible correctness: graph action modals vanish when the context menu closes, and `rlm ask` can deadlock when MCP servers are configured because `block_on_async` runs inside the tokio runtime. Three warnings cover MCP request cleanup, single-pass execution error handling, and inconsistent doctor-fix reporting.

## Critical Issues

### CR-01: Graph action modals unmount when context menu closes

**File:** `ui/src/nodes/NodeContextMenu.tsx:67-68`
**Issue:** The component returns `null` when `open` is false, but `GraphActionModal` instances are rendered inside the same component and controlled by separate `graphModal` state. Closing the menu (outside click, Escape, or after an API action) sets `open=false` and unmounts active modals before the user can submit — breaking Add child, Connect parent, and Delete subtree flows.
**Fix:**
```tsx
if (!setErrorMessage || !refresh) {
  return null;
}

const showMenu = open;
const showGraphModal = graphModal !== null;

if (!showMenu && !showGraphModal) {
  return null;
}

return (
  <>
    {showMenu ? (
      <div ref={menuRef} className="node-context-menu" ...>
        {/* menu contents */}
      </div>
    ) : null}
    <GraphActionModal open={graphModal?.kind === "add-child"} ... />
    {/* other modals */}
  </>
);
```

### CR-02: `block_on_async` deadlocks inside `rlm ask` tokio runtime

**File:** `crates/rlm-cli/src/commands/ask.rs:17-18`, `crates/rlm-core/src/interop/mcp_tools.rs:107`
**Issue:** `ask::run` is async under `#[tokio::main]`. It calls `prepare_ask_execution` synchronously, which calls `build_runtime_context` → `load_mcp_interop` → `block_on_async`. When a tokio handle exists, `block_on_async` uses `Handle::block_on` on a worker thread, blocking the runtime from polling MCP spawn I/O — hang or panic when MCP servers are configured.
**Fix:**
```rust
// ask.rs — run MCP/bootstrap on blocking thread (no active runtime handle)
let prepared = tokio::task::spawn_blocking({
    let project_root = project_root.clone();
    let config_path = config_path.clone();
    move || prepare_ask_execution(&project_root, config_path.as_deref())
})
.await
.map_err(|err| -> Box<dyn std::error::Error> { err.into() })??;
```

## Warnings

### WR-01: MCP pending request not removed on write failure

**File:** `crates/rlm-core/src/interop/mcp_stdio_client.rs:160-163`
**Issue:** `request()` inserts the oneshot sender into `pending` before `write_message`. If writing fails, the entry is never removed, leaking a slot and leaving a dangling sender if the server later responds.
**Fix:**
```rust
self.pending.lock().await.insert(id, tx);
if let Err(err) = self.write_message(&payload).await {
    self.pending.lock().await.remove(&id);
    return Err(err);
}
```

### WR-02: Single-pass graph execution ignores model failures

**File:** `crates/rlm-core/src/graph/executor.rs:356-373`
**Issue:** `ExpertRuntimeMode::SinglePass` awaits `model.complete()` but discards `LanguageModelResponse`. Ollama errors are returned as content strings (not `Err`), so failed inference still marks the node `Completed`.
**Fix:** Inspect `LanguageModelResponse.content` for failure prefix or add an `is_error` field; propagate failure to `ExecutionStatus::Failed` instead of `Ok(())`.

### WR-03: `plugins_doctor_fix` omits MCP interop warnings

**File:** `crates/rlm-core/src/control_server/routes.rs:1324-1338`
**Issue:** `plugins_doctor` appends `runtime.interop_warnings` as `mcp_not_connected` issues, but `plugins_doctor_fix` returns registry results without the same merge — doctor fix UX hides optional MCP disconnect warnings.
**Fix:** Mirror the `plugins_doctor` loop that pushes `interop_warnings` into `result.issues` before returning.

## Resolution (2026-05-22)

All findings addressed in source:

| ID | Status | Evidence |
|----|--------|----------|
| CR-01 | Fixed | `NodeContextMenu.tsx` keeps modals mounted via `showMenu` / `showGraphModal` guards |
| CR-02 | Fixed | `ask.rs` uses `tokio::task::spawn_blocking` for `prepare_ask_execution` |
| WR-01 | Fixed | `mcp_stdio_client.rs` removes pending entry on write failure |
| WR-02 | Fixed | `executor.rs` treats `Ollama inference failed:` prefix as failure |
| WR-03 | Fixed | `plugins_doctor_fix` merges `runtime.interop_warnings` |

Verification: source inspection only (no full workspace test run per operator request).

---

_Reviewed: 2026-05-22T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
