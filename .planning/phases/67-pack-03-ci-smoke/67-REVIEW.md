---
status: clean
phase: 67-pack-03-ci-smoke
depth: standard
reviewed: "2026-05-22T00:00:00Z"
fix_applied: true
---

# Phase 67 Code Review

## Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| Critical | 1 | 1 |
| Warning | 0 | 0 |
| Info | 0 | 0 |

**Verdict:** clean after auto-fix

## Findings

### CRITICAL-1: process.exit in try block skipped finally uninstall

- **File:** `scripts/packaging/smoke-deb.mjs`
- **Issue:** `process.exit(1)` inside the `try` block terminates the process before `finally` runs, leaving the installed `.deb` on the system when smoke fails mid-flow.
- **Fix:** Refactored to `runDebSmoke()` returning exit codes; `smokeDesktopBinary` returns status instead of exiting; single `process.exit` after cleanup in `finally`.
- **Commit:** 99480ab

## Positive notes

- T-67-01: smoke only installs caller-supplied or repo-built deb paths; no external download path
- Skip semantics correctly exit 0 for RLM_SKIP_DEB_SMOKE and missing glib-2.0
- CI workflow pins action versions and does not set RLM_SKIP_DEB_SMOKE
