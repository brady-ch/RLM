# Phase 123: Workflow View Simplification - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations accepted via --auto)

<domain>
## Phase Boundary

Trim workflow chrome to locked shell model: thin TopBar (status, run/stop, Advanced entry only), canvas-first view, Run panel on node select only (approve/clarify — no edit fields). Remove or gate WorkflowOverview from default empty-selection state. Preserve first-run launcher → guided composer → graph path.

</domain>

<decisions>
## Implementation Decisions

### TopBar Trim (Demote from cut list)
- Remove run-variant selector, approval mode pill from default TopBar (or move to Advanced if needed for power users)
- Keep: run status, run/stop controls, Advanced hub entry, essential session indicator
- Theme toggle: move to Advanced Settings or keep minimal icon — prefer Advanced to reduce chrome

### Run Panel (Keep, fix spec drift)
- Run panel visible only when a node is selected
- When no node selected: do NOT render WorkflowOverview in run panel slot — canvas fills workflow view
- Run panel content: approve/clarify actions only — remove prompt edit fields, plan fields, duplicate inspector controls

### WorkflowOverview (Demote — Phase owner 123)
- Remove from default workflow view when no selection
- If status summary needed: merge minimal status into TopBar OR remove entirely if TopBar covers it
- Do not delete file yet if Advanced might need it later — gate from workflow mount

### Domain Panels on Workflow View
- Confirm no models/plugins/sessions/memory panels mount on workflow view (already Advanced-only post prior phases)
- AppShell may still fetch on mount — defer fetch removal to Phase 125

### First-Run Path
- FirstRunLauncher → guided composer → graph must remain intact — regression test via existing UI tests or manual checklist note

### Claude's Discretion
- Exact TopBar layout after trim
- Whether WorkflowOverview file is deleted vs unused import cleanup

</decisions>

<code_context>
## Existing Code Insights

### Cut List References
- TopBar: Demote (Phase 123) — spec drift on run-variant, approval pill, theme
- RunPanel: Keep with spec drift fix (no overview when unselected)
- WorkflowOverview: Demote (Phase 123)

### Files
- `ui/src/app/TopBar.tsx`, `ui/src/run-panel/RunPanel.tsx`, `ui/src/run-panel/WorkflowOverview.tsx`
- `ui/src/app/AppShell.tsx` — orchestrates panel visibility

</code_context>

<specifics>
## Specific Ideas

- Locked shell: thin top bar, canvas, Run panel on select only (ui-shell-architecture.md)
- No domain panels on workflow view

</specifics>

<deferred>
## Deferred Ideas

- AppShell fetch decomposition — Phase 125
- CSS split — Phase 124
- NodeInspector slim — Phase 126

</deferred>
