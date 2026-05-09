# Feature Research

## Table Stakes
- Prompt -> plan graph -> execute workflow loop.
- Visible execution graph with node status updates.
- Approval-gated execution mode.
- Explicit error surfacing in UI and terminal.
- Configurable model routing/tier selection.

## Differentiators
- Node-level model annotations on cards before execution.
- Mid-run graph mutation at approval checkpoints (edit/add/delete).
- Initial-plan-only approval override (then auto-run).
- Cross-model handoff support for format-capable final node.

## Anti-Features (for v1)
- Persistent graph-edit history across restarts.
- Multi-user collaborative approvals.
- Silent fallback behavior that hides model/tool errors.

## Complexity Notes
- Highest complexity: safe graph mutation + preserving recursive semantics.
- Medium: per-node model display + override UX.
- Medium: override mode integration with existing `--require-approval` flow.
