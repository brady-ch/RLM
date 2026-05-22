# Phase 42: Test Restructure & Docs - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure/refactor phase — discuss skipped)

<domain>
## Phase Boundary

Extract shared test helpers to `tests/helpers/`. Split `recursive-language-model.test.ts` into subsystem-aligned files under `tests/domain/recursion/`. Add focused unit tests for config/bootstrap at extraction boundaries. Update AGENTS.md contributor map. Integration anchors stay intact; test count parity verified.

</domain>

<decisions>
### Claude's Discretion
TEST-01 through TEST-05, DOC-01, DOC-02, REG-01, REG-02. Test blocks move verbatim unless structurally justified.

</decisions>

<code_context>
Large monolithic test files. New module boundaries from phases 37-41 define split targets.

</code_context>

<specifics>
Final phase of v1.6 — AGENTS.md must reflect all new module homes.

</specifics>

<deferred>
None.

</deferred>
