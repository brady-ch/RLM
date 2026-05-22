# Phase 52: Rust Workspace + Control Server Strangler - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Cargo workspace scaffold with Axum control server strangler: freeze UI HTTP/SSE contract via golden fixtures before porting orchestration logic.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Axum + Tokio stack per research; explicit routes for read-path scaffold; golden fixtures in tests/fixtures/control-server/; check:rust CI script added.

</decisions>

<code_context>
## Existing Code Insights

- TS route probe order in route-request.ts
- Idle session snapshot shape from execution-controller
- ui/dist served via static-ui handler

</code_context>

<specifics>
## Specific Ideas

Strangler first slice only — stub handlers return fixture-aligned JSON; full orchestration deferred to phases 54–58.

</specifics>

<deferred>
## Deferred Ideas

Full handler parity, mutation routes, plugin registry wiring — later phases.

</deferred>
