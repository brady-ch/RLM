# Phase 121: UI Vision Cut List

**Phase 121 scope is audit-only — no component removals, refactors, or CSS edits in this phase.**

## Audit framework

Score every UI surface against these questions:

1. **Graph-first?** Does it help the user inspect, edit, approve, or run a node graph?
2. **Default path?** Should a first-run user see this before their first successful run?
3. **Recoverable state?** If removed from default view, can the user still reach it via Advanced when needed?
4. **Vision match?** Does it match locked shell architecture (no global panels on workflow view)?
5. **Weight cost?** Lines of code, CSS, bundle KB, mount-time fetches?

Verdicts: **Keep** (workflow or essential Advanced) · **Demote** (Advanced only, collapsed default) · **Delete** (no product fit post-audit)

## Inventory

Verified 2026-05-24:

| Metric | Value |
|--------|-------|
| `.tsx` files under `ui/src/` | 27 |
| Auditable `.tsx` rows | 25 (excludes bootstrap + shared primitive) |
| `styles.css` lines | 1,803 |
| Total audit rows | 26 |

### All `.tsx` files (`find ui/src -type f -name '*.tsx' | sort`)

```
ui/src/advanced/AdvancedHub.tsx
ui/src/advanced/memory/MemoryPanel.tsx
ui/src/advanced/MemoryView.tsx
ui/src/advanced/models/ModelLibraryPanel.tsx
ui/src/advanced/ModelsView.tsx
ui/src/advanced/PluginPanel.tsx
ui/src/advanced/PluginsView.tsx
ui/src/advanced/sessions/SavedSessionPanel.tsx
ui/src/advanced/SessionsView.tsx
ui/src/advanced/settings/GraphWorkflowPanel.tsx
ui/src/advanced/settings/inspectorHelpers.tsx
ui/src/advanced/settings/NodeInspector.tsx
ui/src/advanced/settings/QualityLoopInspector.tsx
ui/src/advanced/settings/RefineGraphPanel.tsx
ui/src/advanced/SettingsView.tsx
ui/src/app/AppShell.tsx
ui/src/app/FirstRunLauncher.tsx
ui/src/app/TopBar.tsx
ui/src/canvas/GraphCanvas.tsx
ui/src/main.tsx
ui/src/nodes/ExecutionNodeCard.tsx
ui/src/nodes/GraphActionModal.tsx
ui/src/nodes/NodeContextMenu.tsx
ui/src/nodes/QualityLoopCardSummary.tsx
ui/src/run-panel/RunPanel.tsx
ui/src/run-panel/WorkflowOverview.tsx
ui/src/shared/ThemeToggle.tsx
```

### Exclusions

- `main.tsx` — bootstrap entry, excluded from verdict table
- `shared/ThemeToggle.tsx` — shared primitive without domain fetch weight, excluded

## Phase owner summary

| Phase | Owner scope |
|-------|-------------|
| 122 | Advanced hub deletes |
| 123 | Workflow chrome (TopBar, RunPanel, WorkflowOverview) |
| 124 | CSS split / dead rule removal |
| 125 | AppShell fetch decomposition |
| 126 | Node inspector & settings slim-down |
| 127 | Lazy routes & bundle impact |

## References

- `.planning/notes/ui-shell-architecture.md`
- `.planning/notes/product-shell-entry-model.md`
- `.planning/notes/ui-canvas-visual-polish-decision.md`
- `.planning/notes/desktop-product-vision.md`

## Verdict table

### app/

| Surface | Path | Verdict | Rationale | Phase owner |
|---------|------|---------|-----------|-------------|
| AppShell | `ui/src/app/AppShell.tsx` | Keep | Graph-first shell orchestrator; 453 LOC domain state concentrated — decomposition target | 125 |
| FirstRunLauncher | `ui/src/app/FirstRunLauncher.tsx` | Keep | Default-path guided composer entry for first-run users | — |
| TopBar | `ui/src/app/TopBar.tsx` | Demote | Spec drift: run-variant, approval mode pill, theme toggle exceed thin-bar contract | 123 |

### canvas/

| Surface | Path | Verdict | Rationale | Phase owner |
|---------|------|---------|-----------|-------------|
| GraphCanvas | `ui/src/canvas/GraphCanvas.tsx` | Keep | Graph-first core surface — workflow canvas is the product | — |

### nodes/

| Surface | Path | Verdict | Rationale | Phase owner |
|---------|------|---------|-----------|-------------|
| ExecutionNodeCard | `ui/src/nodes/ExecutionNodeCard.tsx` | Keep | Graph-first core surface — inline node inspect/edit on canvas | — |
| GraphActionModal | `ui/src/nodes/GraphActionModal.tsx` | Keep | Graph-first — plan/run/graph actions from node selection | — |
| NodeContextMenu | `ui/src/nodes/NodeContextMenu.tsx` | Keep | Graph-first core surface — Variant B context menu for node mutations | — |
| QualityLoopCardSummary | `ui/src/nodes/QualityLoopCardSummary.tsx` | Keep | Graph-first — inline quality loop status on node cards | — |

### run-panel/

| Surface | Path | Verdict | Rationale | Phase owner |
|---------|------|---------|-----------|-------------|
| RunPanel | `ui/src/run-panel/RunPanel.tsx` | Keep | Graph-first approve/clarify surface; spec drift: renders overview when no node selected | 123 |
| WorkflowOverview | `ui/src/run-panel/WorkflowOverview.tsx` | Demote | Spec drift: shown when no node selected; overlaps TopBar status — not default-path | 123 |

### advanced/

| Surface | Path | Verdict | Rationale | Phase owner |
|---------|------|---------|-----------|-------------|
| AdvancedHub | `ui/src/advanced/AdvancedHub.tsx` | Keep | Essential Advanced power surface; eager-imports all tabs — bundle concern | 127 |
| ModelsView | `ui/src/advanced/ModelsView.tsx` | Keep | Essential Advanced tab — model routing is power-user capability | — |
| PluginsView | `ui/src/advanced/PluginsView.tsx` | Keep | Essential Advanced tab — plugin management is power-user capability | — |
| MemoryView | `ui/src/advanced/MemoryView.tsx` | Keep | Essential Advanced tab — memory inspection is power-user capability | — |
| SettingsView | `ui/src/advanced/SettingsView.tsx` | Keep | Essential Advanced tab container for settings panels | — |
| SessionsView | `ui/src/advanced/SessionsView.tsx` | Keep | Essential Advanced tab — session management is power-user capability | — |
| PluginPanel | `ui/src/advanced/PluginPanel.tsx` | Keep | Advanced-only domain panel — recoverable via Plugins tab | — |

#### advanced/models/

| Surface | Path | Verdict | Rationale | Phase owner |
|---------|------|---------|-----------|-------------|
| ModelLibraryPanel | `ui/src/advanced/models/ModelLibraryPanel.tsx` | Keep | Advanced-only domain panel — recoverable via Models tab | — |

#### advanced/memory/

| Surface | Path | Verdict | Rationale | Phase owner |
|---------|------|---------|-----------|-------------|
| MemoryPanel | `ui/src/advanced/memory/MemoryPanel.tsx` | Keep | Advanced-only domain panel — recoverable via Memory tab | — |

#### advanced/sessions/

| Surface | Path | Verdict | Rationale | Phase owner |
|---------|------|---------|-----------|-------------|
| SavedSessionPanel | `ui/src/advanced/sessions/SavedSessionPanel.tsx` | Keep | Advanced-only domain panel — recoverable via Sessions tab | — |

#### advanced/settings/

| Surface | Path | Verdict | Rationale | Phase owner |
|---------|------|---------|-----------|-------------|
| RefineGraphPanel | `ui/src/advanced/settings/RefineGraphPanel.tsx` | Delete | Not graph-first default path — chat refine duplicates graph authoring on canvas | 122 |
| QualityLoopInspector | `ui/src/advanced/settings/QualityLoopInspector.tsx` | Delete | Not default path — quality loop status recoverable via node card summary | 122 |
| NodeInspector | `ui/src/advanced/settings/NodeInspector.tsx` | Demote | 461 LOC duplicates node card / context menu prompt edit and plan actions | 126 |
| GraphWorkflowPanel | `ui/src/advanced/settings/GraphWorkflowPanel.tsx` | Demote | Settings overlap with workflow shell — graph config belongs in Advanced collapsed default | 126 |
| inspectorHelpers | `ui/src/advanced/settings/inspectorHelpers.tsx` | Demote | Support module for inspector panels slated for slim-down — no standalone product surface | 126 |

### styles.css

| Surface | Path | Verdict | Rationale | Phase owner |
|---------|------|---------|-----------|-------------|
| styles.css (monolith) | `ui/src/styles.css` | Demote | Keep styles; split monolith structure deferred — clusters: canvas grid, node cards, run panel, advanced hub (~1,803 LOC) | 124 |

## Summary

| Verdict | Count |
|---------|-------|
| Keep | 18 |
| Demote | 6 |
| Delete | 2 |

### Mandatory scored surfaces

| Surface | Verdict | Phase owner |
|---------|---------|-------------|
| RefineGraphPanel | Delete | 122 |
| QualityLoopInspector | Delete | 122 |
| NodeInspector | Demote | 126 |
| WorkflowOverview | Demote | 123 |
| GraphWorkflowPanel | Demote | 126 |
| AppShell.tsx | Keep | 125 |
| styles.css | Demote | 124 |

### Spec drift callouts

- RunPanel renders WorkflowOverview when no node selected (conflicts with ui-shell-architecture.md — Run panel should be selection-gated)
- NodeInspector duplicates node card / context menu actions (461 LOC overlap with ExecutionNodeCard and NodeContextMenu)
- TopBar exceeds thin-bar contract (run-variant selector, approval mode pill, theme toggle — trim in Phase 123)
- AdvancedHub eager-imports all tab views at mount (ModelsView, PluginsView, SessionsView, MemoryView, SettingsView — Phase 127 lazy-route target)

### Bundle baseline (pre-v1.19)

| Asset | Size | Notes |
|-------|------|-------|
| JS (main chunk) | 522.60 kB | Single chunk, no lazy routes yet — Phase 127 target (from research — build skipped due to RAM gate) |
| CSS | 45.52 kB | From styles.css monolith — Phase 124 target (from research — build skipped due to RAM gate) |
| Build date | 2026-05-24 | Captured during Phase 121 audit |

## Ready for Phase 122

All Phase 121 deliverables present. Phase 122 executor should use `121-CUT-LIST.md` Delete/Demote rows with Phase owner 122 for Advanced hub pruning; Phases 123–127 use Phase owner column.
