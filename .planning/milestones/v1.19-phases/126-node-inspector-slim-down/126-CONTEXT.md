# Phase 126: Node Inspector and Settings Slim Down - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations accepted via --auto)

<domain>
## Phase Boundary

Execute cut list Demote verdicts on Settings/NodeInspector (Phase 126 owner). Reduce NodeInspector and GraphWorkflowPanel per audit. Prompt editing stays on node card / context menu only — no duplicate edit surfaces in Run panel or inspector.

</domain>

<decisions>
## Implementation Decisions

### NodeInspector (Demote — 461 LOC)
- Remove duplicate prompt edit UI — ExecutionNodeCard and NodeContextMenu own inline edit
- Remove duplicate plan/run actions available on canvas
- Keep Advanced-only node metadata view if still valuable (agent binding, tool list read-only)
- Target significant LOC reduction, not necessarily delete file

### GraphWorkflowPanel (Demote)
- Collapse by default in SettingsView
- Remove overlap with workflow shell (graph-level config only in Advanced)
- Trim redundant graph-wide controls already on canvas/TopBar

### inspectorHelpers (Demote)
- Slim or inline after NodeInspector reduction
- Delete if orphaned after inspector trim

### Run Panel / Workflow
- Confirm Run panel has no prompt edit (Phase 123) — do not reintroduce
- Core plan/run/approve path unchanged

### Claude's Discretion
- Minimum viable NodeInspector content for power users
- Whether GraphWorkflowPanel merges into collapsed accordion vs partial delete

</decisions>

<code_context>
## Cut List
- NodeInspector: Demote, 461 LOC overlap
- GraphWorkflowPanel: Demote, settings overlap
- inspectorHelpers: Demote, support module

</code_context>

<specifics>
## Specific Ideas

- No duplicate prompt editing in Run panel or inspector (success criterion)
- Quality loop read-only on node cards via QualityLoopCardSummary (inspector deleted Phase 122)

</specifics>

<deferred>
## Deferred Ideas

- Full NodeInspector delete — only if Demote slim leaves nothing; prefer slim keep

</deferred>
