---
status: passed
phase: 126
verified: 2026-05-24
---

# Phase 126 Verification

## Goal

Execute cut list on Settings/NodeInspector; prompt edit stays on node card only.

## Must-haves

| ID | Requirement | Status |
|----|-------------|--------|
| UI-126-01 | NodeInspector reduced per cut list (no duplicate prompt/plan/run) | ✅ PASS — 453→318 LOC; shell-boundaries tests |
| UI-126-02 | No duplicate prompt editing in Run panel or inspector | ✅ PASS — RunPanel unchanged; NodeInspector has no textarea |
| UI-126-03 | Core plan/run/approve path unchanged on canvas | ✅ PASS — ExecutionNodeCard + NodeContextMenu intact |
| UI-126-04 | GraphWorkflowPanel collapsed; no run-variant overlap | ✅ PASS — details.settings-collapsible; no run-variant-controls |
| UI-126-05 | `npm run test:agent:verify:light` passes | ✅ PASS |

## Success criteria (ROADMAP)

1. NodeInspector reduced per cut list — ✅ (137 lines removed, duplicate actions gone)
2. No duplicate prompt editing in Run panel or inspector — ✅
3. Core plan/run/approve path unchanged — ✅

## Automated checks

- `npm run test:agent:verify:light` — exit 0
- `node --test tests/ui/shell-boundaries.test.ts` — 12/12 pass

## Code review

- `126-REVIEW.md` — status: clean (0 critical, 0 warning)
