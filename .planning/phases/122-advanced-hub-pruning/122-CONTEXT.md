# Phase 122: Advanced Hub Pruning - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations accepted via --auto)

<domain>
## Phase Boundary

Execute Phase 121 cut list **Delete** verdicts owned by Phase 122 on the Advanced hub. Remove RefineGraphPanel and QualityLoopInspector from codebase and SettingsView wiring. Simplify Advanced landing — essential tabs (Models, Sessions) first. Do not touch Demote items owned by Phases 123–127 (TopBar trim, NodeInspector slim, CSS split, AppShell decomposition, lazy routes).

</domain>

<decisions>
## Implementation Decisions

### Delete Scope (from 121-CUT-LIST.md)
- **Delete** `ui/src/advanced/settings/RefineGraphPanel.tsx` — chat refine not default path
- **Delete** `ui/src/advanced/settings/QualityLoopInspector.tsx` — quality loop status on node cards
- Remove all imports, routes, tab sections, and CSS selectors exclusive to deleted panels
- Do not delete NodeInspector, GraphWorkflowPanel, inspectorHelpers (Phase 126 Demote)

### Advanced Hub Tab Order
- Reorder tabs: **Models**, **Sessions**, Plugins, Memory, Settings (Models + Sessions first per success criteria)
- Keep all five tabs — only reorder, no tab removal in this phase

### Settings View Cleanup
- SettingsView retains NodeInspector and GraphWorkflowPanel (slim-down deferred to Phase 126)
- Remove deleted panel sections and any orphaned state/handlers for refine/quality-loop inspector

### CSS & Dead Code
- Remove CSS rules used only by deleted components (within styles.css monolith — no split yet)
- Do not refactor styles.css structure (Phase 124)

### Verification
- `npm run build:ui` must pass
- `npm run test:agent:verify:light` for agent gate
- Cut-list completeness test must still pass (update if file inventory changes)

### Claude's Discretion
- Exact SettingsView layout after panel removal
- Whether quality loop config moves anywhere or is fully dropped with inspector
- Minor tab label/icon adjustments if needed for reorder

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Cut list: `.planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md`
- AdvancedHub.tsx — tab container, eager imports (lazy deferred Phase 127)
- SettingsView.tsx — hosts RefineGraphPanel, QualityLoopInspector, NodeInspector, GraphWorkflowPanel

### Established Patterns
- Advanced hub full-screen takeover from workflow via TopBar
- Settings panels as sections within SettingsView tab

### Integration Points
- AppShell may reference refine/quality-loop handlers — grep and remove dead wiring
- Static tests in tests/ui/ may reference deleted components — update

</code_context>

<specifics>
## Specific Ideas

- Phase 122 owner rows from cut list: RefineGraphPanel Delete, QualityLoopInspector Delete
- Advanced landing simplified = tab order + deleted clutter removed, not structural hub rewrite

</specifics>

<deferred>
## Deferred Ideas

- NodeInspector / GraphWorkflowPanel slim-down — Phase 126
- AdvancedHub lazy imports — Phase 127
- TopBar / RunPanel / WorkflowOverview trim — Phase 123

</deferred>
