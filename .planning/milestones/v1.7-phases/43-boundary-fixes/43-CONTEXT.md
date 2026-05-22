# Phase 43: Boundary Fixes - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure/refactor phase — discuss skipped)

<domain>
## Phase Boundary

Layer import directions are corrected and plugin registration contracts decouple from application types — prerequisite for runtime split and taxonomy moves. Fix three ARCH-02 baseline violations, introduce ExtensionHostPort, relocate content-tree with its owning concern.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Follow ARCHITECTURE.md Wave 1: move AgentConfig to domain, ExtensionHostPort in ports, content-tree colocated with web-fetch adapter, shrink baseline to empty. REG-01, REG-02, RUNT-01, RUNT-02 must hold.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dependency-cruiser-baseline.json` — three known violations documented
- `src/application/config/types.ts` — AgentConfig source to extract
- `src/application/extension-host.ts` — ExtensionHost implementation
- `src/application/content-tree.ts` — HTML analysis used by web-fetch-tool

### Established Patterns
- Config facade re-exports through `application/project-config.ts`
- v1.6 strangler: extract types first, preserve behavior, `npm run check` green

### Integration Points
- `domain/agents.ts` AgentProfile.config uses AgentConfig
- `ports/extension-port.ts` ExtensionManifest.register(host)
- `adapters/tools/web-fetch-tool.ts` imports content-tree

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP success criteria and REQUIREMENTS RUNT-01/RUNT-02.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
