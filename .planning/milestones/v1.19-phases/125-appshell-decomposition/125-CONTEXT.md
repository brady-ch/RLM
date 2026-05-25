# Phase 125: AppShell State Decomposition - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations accepted via --auto)

<domain>
## Phase Boundary

Move domain state and data fetches out of AppShell into Advanced view modules. Target AppShell under ~200 lines. Workflow view mount must not trigger model/plugin/memory fetches. Session and graph refresh on workflow view must still work.

</domain>

<decisions>
## Implementation Decisions

### Fetch Relocation
- Model library fetch → ModelsView mount
- Plugin registry fetch → PluginsView mount
- Memory index fetch → MemoryView mount
- Session list/detail → SessionsView + minimal workflow session hook in AppShell

### AppShell Retains
- View routing (workflow vs Advanced)
- Active session ID and graph snapshot for canvas
- Run/stop orchestration and SSE/event subscription for workflow
- First-run launcher gate

### Line Count Target
- AppShell under ~200 lines (from ~453 at audit)
- Extract hooks: useWorkflowSession, useRunControl, useViewRouter as needed

### Workflow View Mount
- On workflow mount: only session/graph/run state — no domain panel data
- Lazy or on-demand fetch when user opens Advanced tab

### Claude's Discretion
- Hook file locations (app/hooks/ vs colocated)
- How much session state stays in AppShell vs context provider

</decisions>

<code_context>
## Existing Code Insights

- AppShell.tsx: Keep verdict, 453 LOC, Phase 125 owner
- Advanced views already exist as mount targets
- Cut list: AdvancedHub eager imports — Phase 127 addresses bundle, not fetch timing

</code_context>

<specifics>
## Specific Ideas

- No model/plugin/memory fetch on workflow view mount (success criterion)
- Graph refresh and run controls unchanged for user

</specifics>

<deferred>
## Deferred Ideas

- React.lazy for Advanced routes — Phase 127
- NodeInspector slim — Phase 126

</deferred>
