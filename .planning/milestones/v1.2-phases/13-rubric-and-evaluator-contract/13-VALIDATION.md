---
phase: 13
slug: rubric-and-evaluator-contract
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-18
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner with TypeScript build output |
| **Config file** | `package.json`, `tsconfig.json` |
| **Quick run command** | `npm run build && node --test --test-name-pattern='quality loop.*rubric|quality loop.*evaluator|quality loop.*gate|renders .*quality loop' dist/tests/recursive-language-model.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build && node --test --test-name-pattern='quality loop.*rubric|quality loop.*evaluator|quality loop.*gate|renders .*quality loop' dist/tests/recursive-language-model.test.js`
- **After every plan wave:** Run `npm test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | RUBR-01 | T-13-01 | Deterministic rubric selection cannot silently fall back without metadata | unit | `npm run build && node --test --test-name-pattern='quality loop.*rubric' dist/tests/recursive-language-model.test.js` | yes | pending |
| 13-01-02 | 01 | 1 | RUBR-01 | T-13-02 | Loop metadata exposes selected rubric to CLI/UI consumers | unit | `npm run build && node --test --test-name-pattern='quality loop.*rubric' dist/tests/recursive-language-model.test.js` | yes | pending |
| 13-02-01 | 02 | 2 | RUBR-02 | T-13-03 | Malformed evaluator output becomes degraded or failed loop state, not silent text parsing | unit | `npm run build && node --test --test-name-pattern='quality loop.*evaluator' dist/tests/recursive-language-model.test.js` | yes | pending |
| 13-02-02 | 02 | 2 | RUBR-03 | T-13-04 | Gate pass/continue decisions require rubric fit, critique resolution, and improvement signals | unit | `npm run build && node --test --test-name-pattern='quality loop.*gate' dist/tests/recursive-language-model.test.js` | yes | pending |
| 13-03-01 | 03 | 3 | RUBR-01,RUBR-02,RUBR-03 | T-13-05 | Renderer output exposes compact contract without hiding structured JSON metadata | unit | `npm run build && node --test --test-name-pattern='renders .*quality loop' dist/tests/recursive-language-model.test.js` | yes | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | N/A | All Phase 13 behaviors have automated fake-model or renderer verification. | N/A |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-18
