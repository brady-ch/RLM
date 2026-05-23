# Phase 80 Context: First-Run Launcher

**Phase:** 80 — First-Run Launcher  
**Milestone:** v1.11 UI Product Hardening  
**Requirements:** LAUN-01, LAUN-02, LAUN-03

## Goal

Guide new users into the graph workspace with a guided composer and session picker before the canvas becomes the primary surface. Advanced remains secondary via TopBar.

## Decisions

| Area | Decision |
|------|----------|
| Launcher trigger | Show when graph is pristine: single `root-composer`, no edges/children |
| Dismissal | Continue (save prompt), Start fresh, or Open saved session — all dismiss launcher |
| Refresh / deep-link | Graph with progress skips launcher; existing session state preserved |
| Backend | Reuse `/api/saved-sessions`, `/api/nodes/root-composer/edit`, `/api/nodes/root-composer/plan` |
| Placement | `ui/src/app/FirstRunLauncher.tsx` — no imports from `advanced/` |

## Out of scope

- New control-server endpoints
- Full-screen Advanced hub changes
- Operator UAT (Phase 81)

## References

- `.planning/notes/ui-shell-architecture.md`
- `.planning/notes/product-shell-entry-model.md`
- `ui/src/app/AppShell.tsx`
- `ui/src/advanced/sessions/SavedSessionPanel.tsx` (API patterns)
