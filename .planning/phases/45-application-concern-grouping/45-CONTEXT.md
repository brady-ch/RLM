# Phase 45: Application Concern Grouping - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure/refactor phase — discuss skipped)

<domain>
## Phase Boundary

Group flat `src/application/` modules into concern folders (`execution/`, `graph/`, `memory/`, `plugins/`, `control-server/`) using strangler extraction. Root keeps facades for backward-compatible imports; `config/`, `bootstrap/`, and `project-config.ts` remain cross-cutting entry points.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Strangler pattern: move implementations to concern folders first, add root re-export facades second. Preserve CLI, control-server, and session behavior. TAXN-02 must hold.

</decisions>

<code_context>
## Existing Code Insights

### Flat root modules to relocate
- Execution: agent-runner, agent-registry, workflow-runner, run-recursive-prompt, execution-controller, ui-execution-runner, model-provider, model-library, resource-cleanup, runtime-events
- Graph: graph-planner, graph-executor, graph-workflow-* (store, serializer, runner, types)
- Memory: memory-manager, memory-resolver, semantic-memory-index, session-memory-bridge

### Already grouped
- `application/config/` — config layer (Phase 37)
- `application/bootstrap/` — thin runtime facade (Phase 44)
- `application/control-server/` — HTTP handlers (Phase 41)

### Established Patterns
- Phase 44 strangler: extract modules, facade re-exports, `npm run check` green
- Root `project-config.ts` remains public config facade

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP success criteria and TAXN-02.

</specifics>

<deferred>
## Deferred Ideas

Plugin manager implementation deferred to Phase 46; `plugins/` folder established with extension registry facade.

</deferred>
