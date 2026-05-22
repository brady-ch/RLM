# Phase 38: Runtime Bootstrap - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure/refactor phase — discuss skipped)

<domain>
## Phase Boundary

Extract runtime construction from `src/index.ts` into `application/bootstrap/` with typed `RuntimeContext` and `buildRuntimeContext()`. Slim index.ts to argument parsing, early exits, runtime build, and dispatch. Move CLI run modes to `cli/run-modes/*` receiving built RuntimeContext. Preserve init order: extensions → MCP cleanup → tool resolver → agent registry → model factory → execution control → shutdown wiring.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation at Claude's discretion. Constraints from STATE.md blocker: verify bootstrap cleanup order against current index.ts contract during planning. Target index.ts <150 LOC. BOOT-01 through BOOT-06, REG-01, REG-02 must hold.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Monolithic `src/index.ts` — CLI parsing, config load, tool/model/store wiring, run modes
- Phase 37: config split complete under `application/config/`

### Established Patterns
- Ports/adapters injection at composition root
- Phase 36 check gate: typecheck, lint, format, depcruise, test

### Integration Points
- Control server startup, agent runner, workflow runner all wired from index.ts
- Shutdown handlers in cli/shutdown.ts

</code_context>

<specifics>
## Specific Ideas

Follow BOOT-01 through BOOT-06. Extension/tool registration stays unified through one path.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
