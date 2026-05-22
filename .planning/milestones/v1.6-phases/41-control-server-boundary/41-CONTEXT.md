# Phase 41: Control-Server Boundary - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure/refactor phase — discuss skipped)

<domain>
## Phase Boundary

Group HTTP route handlers into `application/control-server/handlers/` by surface (session, graph, workflows, model-library, static UI). Control server transport-only; session/graph authority stays in application services. `startControlServer` receives composed runtime deps from bootstrap.

</domain>

<decisions>
### Claude's Discretion
CTRL-01 through CTRL-04, REG-01, REG-02. Endpoint paths, JSON shapes, error vocabulary unchanged.

</decisions>

<code_context>
Control server likely in application layer with inline route handlers. Phase 38 bootstrap provides RuntimeContext injection point.

</code_context>

<specifics>
No API or UI contract drift.

</specifics>

<deferred>
None.

</deferred>
