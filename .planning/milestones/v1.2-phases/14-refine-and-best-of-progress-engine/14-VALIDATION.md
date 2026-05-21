---
phase: 14
slug: refine-and-best-of-progress-engine
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-18
---

# Phase 14 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner |
| **Config file** | `package.json`, `tsconfig.json` |
| **Quick run command** | `npm run build && node --test --test-name-pattern='quality loop (preserves refined candidates for comparison|can select earlier candidate as final answer|degrades and falls back on invalid best of progress candidate|gate stops with passed|gate stops with critique resolved|gate stops with no meaningful improvement)' dist/tests/recursive-language-model.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

## Sampling Rate

- After every task commit: quick run command
- After every wave: `npm run build && node --test --test-name-pattern='quality loop' dist/tests/recursive-language-model.test.js`
- Before verification: `npm test`

## Manual-Only Verifications

All Phase 14 behavior has automated fake-model coverage.
