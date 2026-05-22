# Phase 40: Domain Engine Decomposition - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure/refactor phase — discuss skipped)

<domain>
## Phase Boundary

Decompose `recursive-language-model.ts` into `domain/recursion/` modules (budget guard, tool-round loop, quality loop, execution-graph sync, prompt utilities). Orchestrator retains top-level flow. Domain modules import ports only, not application types.

</domain>

<decisions>
### Claude's Discretion
RLM-01 through RLM-05, REG-01, REG-02. **Mandatory plan-phase spike** on state threading between RecursiveLanguageModel class fields and extracted modules before quality-loop extraction (flagged in ROADMAP/STATE).

</decisions>

<code_context>
Monolithic `src/domain/recursive-language-model.ts`. Quality loop has complex class field state.

</code_context>

<specifics>
Extract incrementally; each slice passes RLM, graph-executor, integration tests before next peel.

</specifics>

<deferred>
Simultaneous RLM algorithm changes — log bugs as todos, separate fix commits.

</deferred>
