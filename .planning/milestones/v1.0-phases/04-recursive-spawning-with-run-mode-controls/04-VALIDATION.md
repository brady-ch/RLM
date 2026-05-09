---
phase: "04"
slug: "recursive-spawning-with-run-mode-controls"
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for recursive spawning and run-mode controls.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | APRV-05 | T-04-01 | Invalid mode fails visibly instead of falling back | unit | `npm test` | yes | pending |
| 04-01-02 | 01 | 1 | RECR-02 | T-04-02 | Auto-approval applies only where branch policy allows | integration | `npm test` | yes | pending |
| 04-01-03 | 01 | 1 | RECR-01 | T-04-03 | Recursive child nodes remain observable in graph/events | integration | `npm test` | yes | pending |
| 04-02-01 | 02 | 2 | APRV-05 | T-04-04 | CLI/API report mode and auto-approved state explicitly | integration | `npm test` | yes | pending |
| 04-02-02 | 02 | 2 | RECR-02 | T-04-05 | Pause-future affects future approvals only | integration | `npm test` | yes | pending |
| 04-03-01 | 03 | 3 | RECR-01 | T-04-06 | Full recursive execution passes with no silent hard-risk fallback | regression | `npm test` | yes | pending |

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

## Manual-Only Verifications

All phase behaviors have automated verification.

## Validation Sign-Off

- [x] All tasks have automated verify commands or existing test infrastructure.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency < 60 seconds.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending

