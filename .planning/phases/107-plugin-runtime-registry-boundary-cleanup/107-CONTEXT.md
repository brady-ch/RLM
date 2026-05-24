# Phase 107: Plugin Runtime & Registry Boundary Cleanup - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Extract runtime/registry tests; inject config and tool filter via port/bootstrap. Remove `no-plugins-to-application` and `no-plugins-to-persistence` baseline entries (baseline now at 2 entries).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Expose `filter_agent_tools` through port/bootstrap per AGENTS.md transitional plan. Registry service config injected via port, not direct `LoadedProjectConfig` import. Follow Phase 105/106 ports consolidation pattern.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `plugins/runtime.rs` — imports `filter_agent_tools`, `AgentProfile` from application
- `plugins/registry/service.rs` — imports `LoadedProjectConfig` from persistence
- Remaining baseline: 2 entries (both plugins-related)
- Phase 106: ports consolidation precedent

</code_context>

<specifics>
## Specific Ideas

No specific requirements — boundary cleanup + test extraction if inline tests exist.

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
