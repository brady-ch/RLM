---
status: human_needed
phase: 62-ui-regression-fixes
plan: 01
automated: passed
updated: "2026-05-22T00:00:00Z"
---

# Phase 62 Verification — UI Regression Fixes

## Automated checks

| Check | Result |
|-------|--------|
| TopBar pause-auto-approvals → `/api/pause-future-auto-approvals` | PASS (TopBar.tsx) |
| ModelLibraryRow HF → `/api/model-library/download` | PASS (panels.tsx) |
| Approval mode contract test (api.ts + panels.tsx) | PASS |
| Stale `dist/tests/recursive-language-model.test.js` removed | PASS |
| `npm run check` | PASS (344 tests) |

## Human verification (deferred)

REG-01 live UAT with Rust control server + Ollama (from 61-06 checklist):

1. Pause future auto-approvals during recursive run
2. Install HF model from Advanced → Models
3. Canvas-first shell workflows unchanged

**Resume signal:** Operator signs off when live server available.
