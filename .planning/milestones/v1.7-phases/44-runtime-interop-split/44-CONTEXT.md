# Phase 44: Runtime & Interop Split - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure/refactor phase — discuss skipped)

<domain>
## Phase Boundary

Composition and interop wiring move from `application/` to `src/runtime/` using strangler extraction. Bootstrap becomes a thin re-export facade; init order preserved. Prerequisite for application concern grouping (Phase 45).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Strangler pattern: extract modules first, re-export facades second, delete application copies. Preserve init order: plugins → interop → tools resolver → agent registry → models. REG-01, REG-02, RUNT-03–05, TAXN-03 must hold.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/application/extension-host.ts` — ExtensionHost implementation
- `src/application/runtime-composition.ts` — createToolsResolver, createModelFactory
- `src/application/bootstrap/build-runtime-context.ts` — buildRuntimeContext orchestration
- `src/application/interop-runtime.ts` — MCP/skill tool wiring
- `src/application/mcp-skill-runtime.ts` — McpSkillRuntime, event sinks

### Established Patterns
- Phase 43 strangler: extract types first, preserve behavior, `npm run check` green
- Bootstrap boundary already thin via `application/bootstrap/index.ts`

### Integration Points
- `src/index.ts` imports buildRuntimeContext and readablePath
- Tests: `bootstrap-runtime.unit.test.ts`, `extension-host.test.ts`, `mcp-skill-interoperability.test.ts`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP success criteria and REQUIREMENTS RUNT-03–05, TAXN-03.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
