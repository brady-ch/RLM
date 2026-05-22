# Phase 39: Adapters & Tools Taxonomy - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure/refactor phase — discuss skipped)

<domain>
## Phase Boundary

Reorganize adapters by concern: tools under `adapters/tools/`, persistence under `adapters/persistence/`, models under `adapters/models/`. Align extension shims in `src/extensions/tools/`. Ports remain public contract. No behavior changes to CLI, UI, session, graph, memory flows.

</domain>

<decisions>
### Claude's Discretion
ADPT-01 through ADPT-06, REG-01, REG-02. Import updates route through composition/bootstrap without growing scattered application→adapter coupling.

</decisions>

<code_context>
Flat `src/adapters/` with mixed tool, persistence, model files. Extension shims in `src/extensions/tools/`.

</code_context>

<specifics>
Follow REQUIREMENTS.md ADPT-* items. Update imports via bootstrap/composition paths from Phase 38.

</specifics>

<deferred>
None.

</deferred>
