# Phase 84 Context: Radix Context Menu

**Phase:** 84 — Radix Context Menu  
**Milestone:** v1.12 UI Canvas Visual Polish  
**Requirements:** CANV-03

## Goal

Replace hand-rolled positioned context menu with `@radix-ui/react-context-menu` while preserving Variant B Plan/Run/Graph/Advanced actions and shell boundary invariants.

## Decisions

| Area | Decision |
|------|----------|
| Primitive | `@radix-ui/react-context-menu` only (no full shadcn) |
| API | `NodeContextMenuShell` wraps card as `ContextMenu.Trigger`; ⋮ uses synthetic contextmenu event |
| Graph modals | Keep existing `GraphActionModal` for add-child/connect/delete |
| Tests | Update shell-boundaries to assert `NodeContextMenuShell` + `openNodeContextMenuFromButton` |

## References

- `ui/src/nodes/NodeContextMenu.tsx` (Variant B sections)
- `tests/ui/shell-boundaries.test.ts`
