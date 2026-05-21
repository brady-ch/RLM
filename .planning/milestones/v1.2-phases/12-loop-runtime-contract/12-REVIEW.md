---
phase: 12-loop-runtime-contract
reviewed: 2026-05-17T17:49:57Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/domain/recursive-language-model.ts
  - tests/recursive-language-model.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-05-17T17:49:57Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Re-reviewed the Phase 12 fixes for the prior code review findings only, plus obvious regressions in the touched quality-loop code.

Resolved findings:

- CR-01 resolved: the quality-loop root now calls `waitForNodeApproval()` before model phases, and the new test verifies no model calls occur while approval is pending.
- WR-01 resolved: a failed phase now leaves an attempted `failed` phase record with completion timestamp, summary, and unresolved issue metadata.

Targeted local checks run:

- `npm run build && node --test --test-name-pattern='quality loop' dist/tests/recursive-language-model.test.js`

## Critical Issues

### CR-01: Failed Phase Calls Still Underreport Per-Phase Loop Usage

**Severity:** BLOCKER
**File:** `src/domain/recursive-language-model.ts:356`
**Issue:** The fix updates `qualityLoop.usage.modelCallsTotal` from the loop-local `modelCalls` delta, but `phaseCallCounts[phase]` is still incremented only after `completeQualityLoopPhase()` returns successfully. If the `refine` model call throws, the run spends the refine call and records a failed refine phase, but `qualityLoop.usage.phaseCallCounts.refine` remains `0`. This leaves the loop usage metadata internally inconsistent: `modelCallsTotal` reports `3` while per-phase counts sum to `2`, so the failed phase call is still undercounted in the usage breakdown.
**Fix:**
```typescript
try {
  phaseResult = await this.completeQualityLoopPhase(task, phase, qualityLoopMessages(task.prompt, phase, phaseOutputs), startedAt);
} catch (error: unknown) {
  metadata.usage.phaseCallCounts[phase] += 1;
  metadata.usage = this.summarizeQualityLoopUsage(metadata, this.modelCalls - loopModelCallsBefore);
  // existing failed phase record metadata...
  throw error;
}
```
Prefer deriving the failed-phase increment from the model-call delta around the attempted phase so budget-precheck failures do not count as model calls. Add an assertion to `quality loop failure records terminal failed metadata` that `phaseCallCounts.refine === 1` and that the sum of phase counts matches `modelCallsTotal`.

---

_Reviewed: 2026-05-17T17:49:57Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
