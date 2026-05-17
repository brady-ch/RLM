---
phase: 12
slug: loop-runtime-contract
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-16
---

# Phase 12 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner |
| **Config file** | none; package scripts compile with `tsc -p tsconfig.json` and run `node --test dist/tests/*.test.js` |
| **Quick run command** | `npm run build && node --test dist/tests/recursive-language-model.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

## Sampling Rate

- **After every task commit:** Run `npm run build && node --test dist/tests/recursive-language-model.test.js`
- **After every plan wave:** Run `npm test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | LOOP-01 | T-12-01 | Loop internals do not expand into top-level graph nodes | unit/integration | `npm run build && node --test dist/tests/recursive-language-model.test.js --test-name-pattern='quality loop graph node'` | no - W0 | pending |
| 12-01-02 | 01 | 1 | LOOP-02 | T-12-02 | Invalid or unbounded loop config cannot create an unbounded run | unit/integration | `npm run build && node --test dist/tests/recursive-language-model.test.js --test-name-pattern='quality loop budget'` | no - W0 | pending |
| 12-01-03 | 01 | 1 | LOOP-03 | T-12-03 | Terminal loop metadata includes inspectable history, usage, selected candidate, and stop reason | unit/integration | `npm run build && node --test dist/tests/recursive-language-model.test.js --test-name-pattern='quality loop metadata'` | no - W0 | pending |
| 12-01-04 | 01 | 1 | LOOP-01, LOOP-02, LOOP-03 | T-12-04 | Non-loop recursive execution remains unchanged unless explicitly configured | regression | `npm test` | yes | pending |

## Wave 0 Requirements

- [ ] `tests/recursive-language-model.test.ts` - add LOOP-01 collapsed node and nested metadata shape tests.
- [ ] `tests/recursive-language-model.test.ts` - add LOOP-02 max-iteration, budget-exhaustion, cancellation, and stop-reason tests.
- [ ] `tests/recursive-language-model.test.ts` - add LOOP-03 phase usage, token/model, candidate, and unresolved issue metadata tests.
- [ ] Optional CLI/render assertion if Phase 12 changes compact or JSON loop output.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | LOOP-01, LOOP-02, LOOP-03 | Phase 12 runtime contract is fully testable with fake models and metadata assertions | N/A |

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-16
