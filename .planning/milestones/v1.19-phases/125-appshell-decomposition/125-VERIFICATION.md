---
status: passed
phase: 125
verified: 2026-05-24
---

# Phase 125 Verification

## Goal

Move domain state/fetches out of AppShell into Advanced views.

## Must-haves

| ID | Requirement | Status |
|----|-------------|--------|
| UI-125-01 | AppShell under ~200 lines | ✅ PASS — 132 lines |
| UI-125-02 | No model/plugin/memory fetch on workflow mount | ✅ PASS — appshell-decomposition.test.ts |
| UI-125-03 | Session/graph refresh works on workflow view | ✅ PASS — useWorkflowSession hook |
| UI-125-04 | `npm run test:agent:verify:light` passes | ✅ PASS |

## Success criteria (ROADMAP)

1. AppShell under ~200 lines — ✅ (132)
2. No model/plugin/memory fetch on workflow view mount — ✅
3. Session/graph refresh still works — ✅
