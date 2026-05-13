---
phase: 11-node-embedded-chat-and-intuitive-graph-editing-ux
fixed_at: 2026-05-12T18:45:00Z
review_path: .planning/phases/11-node-embedded-chat-and-intuitive-graph-editing-ux/11-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-05-12T18:45:00Z  
**Source review:** `11-REVIEW.md`  
**Iteration:** 1  

**Summary**

- Findings in scope (Critical + Warning): 7  
- Fixed: 7  
- Skipped: 0  
- Info findings (IN-01, IN-02) were out of scope for `fix_scope: critical_warning`.

## Fixed issues

### CR-01: Absolute-path escape when serving UI static assets

**Files modified:** `src/application/control-server.ts`  
**Commit:** `fix(11): CR-01 contain static UI paths under uiDistDir`  
**Applied fix:** Strip URL pathname to a relative segment, resolve under `resolve(uiDistDir)`, and reject paths whose relative path escapes the dist root (using `relative` / `sep` checks). Prevents POSIX `join(dist, '/etc/passwd')` style escapes.

### CR-02: `rewire_dependents` stale depths on nested descendants

**Files modified:** `src/application/execution-controller.ts`  
**Commit:** `fix(11): CR-02 recompute subtree depths after rewire dependents delete`  
**Applied fix:** Resolve the deleted node’s parent, validate it exists, and call existing `updateDepthsFrom(dependent.id, parent.depth + 1)` for each rewired dependent so descendant depths match `parentId` chains.

### WR-01: Unbounded approval wait polling under foreign clarification

**Files modified:** `src/application/execution-controller.ts`  
**Commit:** `fix(11): WR-01 exit approval polling when session is cancelled`  
**Applied fix:** Poll loop checks `cancellation.isCancelled()` and rejects the pending approval promise with the cancel reason instead of looping until clarification clears indefinitely.

### WR-02: Unbounded JSON POST bodies on control API

**Files modified:** `src/application/control-server.ts`  
**Commit:** `fix(11): WR-02 cap control server JSON body size at 1MB`  
**Applied fix:** `readJsonBody` enforces `Content-Length` upper bound when present and a running byte tally while streaming, throwing when over 1 MiB (surfaced as 400 via existing route handler).

### WR-03: Session `refresh` ignores non-OK responses

### WR-04: Icon-only header controls lack accessible names

**Files modified:** `ui/src/main.tsx`  
**Commit:** `fix(11): WR-03 WR-04 check session fetch errors and add header aria-labels`  
**Applied fix:** `refresh` throws on `!response.ok` so errors surface via existing `runAction` handling; added `aria-label` on header icon buttons matching `title` where applicable and `aria-hidden` on decorative stop icon.

### WR-05: `waitForNodeStatus` subscribers not cleared on delete/stop

**Files modified:** `src/application/execution-controller.ts`  
**Commit:** `fix(11): WR-05 reject or clear waitForNodeStatus waiters on stop/delete`  
**Applied fix:** Per-wait cancellation handlers registered with `waitForNodeStatus`; `rejectAllStatusWaits` runs at start of `stop()`; `clearStatusWaitsForNode` runs on subtree delete and rewire delete so pending promises reject with a descriptive message instead of living forever when the waited-for status never arrives.

---

## Skipped issues

None.

---

_Fixed: 2026-05-12T18:45:00Z_  
_Fixer: Claude (gsd-code-fixer)_  
_Iteration: 1_
