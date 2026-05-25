# Phase 123: Workflow View Simplification — Research

**Researched:** 2026-05-24

## Key findings

- `TopBar.tsx` renders approval-mode pill, run-variant pill, and `ThemeToggle` — all exceed thin-bar contract (Phase 121 cut list).
- `RunPanel.tsx` renders `WorkflowOverview` when `!selectedNode`; CSS `.workflow-main:has(.run-panel)` already expands canvas when panel absent.
- Run variant controls live in `GraphWorkflowPanel` (Advanced settings) — safe to remove variant pill from TopBar.
- `shell-boundaries.test.ts` already asserts RunPanel has `if (!selectedNode)` and approve/clarify wiring; needs update for null-return behavior.
- `WorkflowOverview.tsx` kept on disk, unmounted from workflow view per CONTEXT.md.

## Validation Architecture

Nyquist: static UI wiring tests in `tests/ui/` — extend shell-boundaries for selection-gated panel.
