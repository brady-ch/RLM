---
status: human_needed
phase: 61
score: 11/12
verified: 2026-05-22
---

# Phase 61 Verification

**Goal:** Sketch 002-B shell — canvas-first workflow, context menus, slim Run panel, Advanced hub; same HTTP/SSE contract.

## Must-haves

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Shared layer extracted | PASS | `ui/src/shared/*` |
| AppShell + TopBar | PASS | `ui/src/app/AppShell.tsx`, `TopBar.tsx` |
| No domain fetch on workflow mount | PASS | AppShell `useEffect` only `refresh()` + SSE |
| GraphCanvas primary surface | PASS | `ui/src/canvas/GraphCanvas.tsx` |
| Node card 002-B (no Plan footer) | PASS | `ExecutionNodeCard.tsx` |
| Context menu wired | PASS | `NodeContextMenu.tsx` |
| Run panel on select only | PASS | `RunPanel.tsx` returns null without selection |
| Advanced hub full-screen | PASS | `AdvancedHub.tsx` |
| main.tsx thin entry | PASS | 5 lines |
| build:ui + lint | PASS | executor run 2026-05-22 |
| REG-01 Rust UI UAT | PENDING | `61-06-VERIFICATION.md` human steps |

## Human verification

See `.planning/phases/61-ui-shell-rewrite/61-06-VERIFICATION.md` for REG-01 checklist on Rust-served UI.
