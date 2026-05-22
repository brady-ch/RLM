---
phase: 61-ui-shell-rewrite
reviewed: 2026-05-22T12:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - ui/src/shared/types.ts
  - ui/src/shared/api.ts
  - ui/src/shared/graph-utils.ts
  - ui/src/shared/labels.ts
  - ui/src/shared/tokens.css
  - ui/src/app/AppShell.tsx
  - ui/src/app/TopBar.tsx
  - ui/src/canvas/GraphCanvas.tsx
  - ui/src/nodes/ExecutionNodeCard.tsx
  - ui/src/nodes/NodeContextMenu.tsx
  - ui/src/run-panel/RunPanel.tsx
  - ui/src/advanced/AdvancedHub.tsx
  - ui/src/advanced/MemoryView.tsx
  - ui/src/advanced/ModelsView.tsx
  - ui/src/advanced/PluginsView.tsx
  - ui/src/advanced/SessionsView.tsx
  - ui/src/advanced/SettingsView.tsx
  - ui/src/main.tsx
  - ui/src/legacy/panels.tsx
  - ui/src/styles.css
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
  initial_critical: 2
  initial_warning: 4
  initial_total: 6
  fixed: 6
status: clean
---

# Phase 61: Code Review Report

**Reviewed:** 2026-05-22T12:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** clean (6 findings auto-fixed)

## Auto-fix Applied

All Critical and Warning findings were fixed in the same review pass:

| ID | Fix |
|----|-----|
| CR-01 | Restructured `post()` error parsing to avoid catch swallowing structured errors |
| CR-02 | Removed broken duplicate `QualityLoopInspector` from `SettingsView` |
| WR-01 | Run variant pill now gated on `snapshot.status === "running"` |
| WR-02 | Resolved by CR-02 removal (duplicate inspector eliminated) |
| WR-03 | Added `SessionSnapshot` and `GraphWorkflowSaveVariant` imports to `panels.tsx` |
| WR-04 | Wrapped SSE snapshot `JSON.parse` in try/catch with `refresh()` fallback |

Verification: `npm run lint` and `npm run build:ui` pass.

## Critical Issues

### CR-01: `post()` catch block discards structured API errors

**File:** `ui/src/shared/api.ts:45-62`
**Issue:** The outer `catch` intercepts the intentionally thrown `Error` built from parsed JSON fields and rethrows raw response text instead, losing `code`, `details`, and `suggestedFix` from the server.
**Fix:**
```typescript
const text = await response.text();
let payload: Record<string, unknown> = {};
if (text) {
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(text || response.statusText);
  }
}
const parts = [
  payload["code"],
  payload["error"] ?? payload["message"],
  payload["details"],
  payload["suggestedFix"],
].filter(Boolean);
throw new Error(parts.length > 0 ? parts.join(" | ") : text || response.statusText);
```

### CR-02: Settings view crashes when node has quality loop

**File:** `ui/src/advanced/SettingsView.tsx:90-92`
**Issue:** `QualityLoopInspector` requires a `loop` prop but SettingsView only passes `node`. When `selectedNode.loop` is truthy the component mounts with `loop === undefined`, causing `Cannot read properties of undefined` on first render. `NodeInspector` (already rendered above) includes a correct `QualityLoopInspector` with `loop={node.loop}` — this block is duplicate and broken.
**Fix:** Remove the standalone `QualityLoopInspector` block from `SettingsView`; `NodeInspector` already renders it when `node.loop` is present.

## Warnings

### WR-01: Run variant pill persists after run completes

**File:** `ui/src/app/TopBar.tsx:37-38`
**Issue:** Condition `activeRunVariant || snapshot.status === "running"` keeps showing "Running {variant}" whenever `activeRunVariant` was set, even after the session returns to idle/failed/completed.
**Fix:** Gate the pill on `snapshot.status === "running"` only:
```tsx
{snapshot.status === "running" ? (
  <span className="meta-pill run-variant-pill">
    Running {activeRunVariant ?? runVariant}
  </span>
) : null}
```

### WR-02: Duplicate quality loop inspector in Advanced Settings

**File:** `ui/src/advanced/SettingsView.tsx:80-92` and `ui/src/legacy/panels.tsx:1294-1300`
**Issue:** When a node has a quality loop, `NodeInspector` renders `QualityLoopInspector` and SettingsView renders a second (broken) instance — duplicate UI even after CR-02 fix is scoped to crash only.
**Fix:** Remove redundant block in SettingsView (same fix as CR-02).

### WR-03: Missing type imports in legacy panels

**File:** `ui/src/legacy/panels.tsx:30,143`
**Issue:** `SessionSnapshot` and `GraphWorkflowSaveVariant` are referenced but not imported from `../shared/types`. Root `tsconfig.json` excludes `ui/`, so this slips past CI; ui-local typecheck would fail.
**Fix:** Add `SessionSnapshot` and `GraphWorkflowSaveVariant` to the type import from `../shared/types`.

### WR-04: Unguarded SSE snapshot JSON parsing

**File:** `ui/src/app/AppShell.tsx:147-148`
**Issue:** Malformed SSE `snapshot` event data will throw from `JSON.parse` inside the listener, potentially breaking live updates with no recovery.
**Fix:**
```typescript
events.addEventListener("snapshot", (event) => {
  try {
    setSnapshot(JSON.parse((event as MessageEvent).data) as SessionSnapshot);
  } catch {
    void refresh();
  }
});
```

---

_Reviewed: 2026-05-22T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
