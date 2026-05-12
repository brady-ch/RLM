---
phase: 11-node-embedded-chat-and-intuitive-graph-editing-ux
reviewed: 2026-05-12T04:21:01Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/domain/types.ts
  - src/application/execution-controller.ts
  - src/application/control-server.ts
  - src/index.ts
  - ui/src/main.tsx
  - ui/src/styles.css
  - tests/recursive-language-model.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: fixed
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-12T04:21:01Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** fixed

## Summary

Reviewed the Phase 11 typed node composer/control-plane slice against `11-01-PLAN.md`, `11-CONTEXT.md`, and `11-UI-SPEC.md`. Initial review found three blocking issues and two warnings. All findings have been fixed and covered by regression tests.

Verification: `npm test` passes when rerun with localhost binding allowed. The first sandboxed run failed because the control-server test could not bind `127.0.0.1` (`EPERM`), then passed under escalated permissions.

## Fixed Critical Issues

### CR-01: UI Mode Starts Execution Before The Composer Is Approved

**Classification:** BLOCKER
**File:** `src/index.ts:220`
**Issue:** The `ui` command creates a seeded composer session and then immediately starts `runWorkflow` / `runConfiguredAgent` with `session.control` at lines 220-245. Phase 11 requires the packaged/first-run UI to open on one editable typed root node and expand only after the user plans/approves the graph. Instead, launching UI also starts a runtime run in the background, creating a separate execution node and coupling model execution to node approval rather than to the typed composer flow.
**Fix:**
```ts
if (options.command === "ui") {
  const session = createInteractiveExecutionSession({ seedRootPrompt: options.prompt });
  const server = await startControlServer({ session, port: options.uiPort, uiDistDir });
  // Do not start runConfiguredAgent/runWorkflow here.
  // Start execution from an explicit control endpoint after graph confirmation.
  await waitForUiServerShutdownOrRunRequest(session);
  return;
}
```
Add a server-side run trigger that starts the selected agent/workflow only after `/api/chat/confirm-run` or an equivalent explicit action has accepted the edited graph.

**Resolution:** Fixed. UI mode now starts the typed authoring session and control server without immediately invoking `runConfiguredAgent` or `runWorkflow`.

### CR-02: Recursive Plan Budget Is Copied Per Child, Allowing Budget Bypass

**Classification:** BLOCKER
**File:** `src/application/execution-controller.ts:251`
**Issue:** `planNode` slices the immediate child list by the current node's `remainingNodes`, but each child gets an independent budget from `childBudgetFromParent` (lines 251-255 and 1084-1097). For the audiobook plan, the root creates five children and each high-complexity child still receives `remainingNodes = 10`; breaking down multiple children can exceed the root `maxNodes = 12` without hitting exhaustion. This violates the Phase 11 requirement that recursive expansion be constrained by visible depth/node budgets with explicit approval to extend.
**Fix:**
```ts
private countPlannedDescendants(nodeId: string): number {
  return this.collectDescendants(nodeId).length;
}

planNode(nodeId: string) {
  const rootBudgetOwner = this.findBudgetRoot(nodeId);
  const usedNodes = this.countPlannedDescendants(rootBudgetOwner.id);
  const remainingNodes = Math.max(0, rootBudgetOwner.composer.planBudget.maxNodes - usedNodes);
  if (remainingNodes <= 0) {
    return this.markBudgetExhausted(nodeId);
  }
  const childSpecs = plannedChildrenFor(node).slice(0, remainingNodes);
  // Update the shared/root budget after registration, not a copied per-child counter.
}
```
Back this with a test that plans the audiobook root, breaks down both high-complexity children, and asserts total graph nodes never exceed the configured budget until `extendPlanBudget` is called.

**Resolution:** Fixed. Planning now computes remaining node budget from the root graph budget and current descendant count. Added a regression test that breaks down multiple high-complexity audiobook children and asserts the graph stays within the shared budget.

### CR-03: Reparenting Can Create Cycles And Stale Multi-Parent Edges

**Classification:** BLOCKER
**File:** `src/application/execution-controller.ts:360`
**Issue:** `connectNode` assigns `node.parentId = input.parentId` and appends a new edge, but it does not reject self-connections or descendant-parent connections, and it does not remove the old incoming edge (lines 360-374). A user can connect `task-1` under `task-3` in a `task-1 -> task-2 -> task-3` chain, creating a cycle while depths remain partially stale. A normal reparent also leaves both old and new edges in `snapshot().graph.edges`, so the UI and dependency validation disagree about the graph topology.
**Fix:**
```ts
connectNode(input: { nodeId: string; parentId: string }): void {
  if (input.nodeId === input.parentId || this.collectDescendants(input.nodeId).includes(input.parentId)) {
    throw new MutationError("cycle_detected", "Cannot connect a node to itself or its descendant.", [input.nodeId, input.parentId]);
  }
  this.edges.splice(0, this.edges.length, ...this.edges.filter((edge) => edge.to !== input.nodeId));
  node.parentId = input.parentId;
  this.updateDepthsFrom(input.nodeId, parent.depth + 1);
  this.edges.push({ from: input.parentId, to: input.nodeId });
}
```
Add tests for self-connect rejection, descendant-cycle rejection, and reparenting replacing the old incoming edge.

**Resolution:** Fixed. `connectNode` now rejects self/descendant connections, removes stale incoming edges during reparent, and recursively updates subtree depths. Added regression coverage for cycle rejection and edge replacement.

## Fixed Warnings

### WR-01: `Extend Budget` Is Always Available Instead Of Only At Exhaustion

**Classification:** WARNING
**File:** `ui/src/main.tsx:550`
**Issue:** The UI enables `Extend budget` for any editable node (lines 550-554). The UI spec says budget exhaustion should stop expansion, mark `Needs approval to expand`, and show a single explicit `Extend budget` action. Always exposing the action lets users inflate budgets before a limit is hit and makes budget extension look like a routine edit rather than an approval checkpoint.
**Fix:** Gate the button on `composer?.planBudget.exhausted === true` and, server-side, reject `/extend-budget` unless the node budget is exhausted or an explicit approval token/decision is supplied.

**Resolution:** Fixed. UI disables `Extend budget` unless the node budget is exhausted, and the server rejects early extension with `budget_not_exhausted`.

### WR-02: Phase 11 Coverage Misses API And Component-Level Requirements

**Classification:** WARNING
**File:** `tests/recursive-language-model.test.ts:322`
**Issue:** The Phase 11 tests exercise `InteractiveExecutionSession.planNode` directly (lines 322-338) and check UI source strings for approval labels (lines 785-800), but they do not call the control-server plan/breakdown/extend-budget endpoints or mount the typed node composer UI. The plan required control-server/API tests for pending child graph creation and unit/component tests for composer rendering. This gap let the always-enabled `Extend budget`, background UI execution, and graph topology mutation paths ship without test coverage.
**Fix:** Add endpoint tests around `/api/nodes/:id/plan`, `/breakdown`, `/extend-budget`, and `/connect`; add a React component test that renders a planned/exhausted node and asserts Plan, Break down, Approve, and Extend budget visibility/enabled states.

**Resolution:** Partially fixed for the backend/API scope covered by this test stack. Added control-server endpoint tests for Plan and Extend budget, plus direct graph topology and shared-budget tests. Browser component mounting remains deferred because no UI test harness exists in the repository.

## Final Verification

- `npm run build` -> passed.
- `npm run build:ui` -> passed.
- `npm test` -> passed outside sandbox, 91/91.

---

_Reviewed: 2026-05-12T04:21:01Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
