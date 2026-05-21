# Phase 14: Refine and Best-of-Progress Engine - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 14 delivers refinement and best-of-progress selection behavior for answer-quality loops. Users receive a final answer selected from accumulated loop progress rather than blindly receiving the last iteration. This phase builds on Phase 13 rubric and evaluator metadata, preserves previous candidates for comparison, and adds deterministic selection/fallback behavior without changing phase model routing or adding UI controls.

</domain>

<decisions>
## Implementation Decisions

### Refined Candidate Production
- Refine should use the original prompt, current draft/refine candidate, structured critique issues/improvements, and selected rubric criteria.
- Store each refined answer as a candidate with iteration, phase, score when available, summary, and runtime-local full text.
- Preserve draft, refine, and best-of-progress candidates across iterations so earlier strong candidates can win later.
- Add compact refinement rationale/source issue ids where useful, but avoid a separate heavy refine schema unless needed for selection.

### Best-of-Progress Selection
- Select the final answer with a deterministic selector over accumulated candidates using parsed best-of-progress output, candidate scores, gate scores, unresolved issue severity, and recency only as a tie-breaker.
- If best-of-progress selects an invalid candidate id, degrade if no safe fallback exists; otherwise select the highest-ranked valid candidate and record the invalid id as an issue.
- Earlier candidates must remain eligible and can be selected when they have better score or fewer unresolved issues.
- Store selected candidate id, score basis, comparison notes, and fallback/degraded reason in typed loop metadata and candidate flags.

### Early Stop and Iteration Policy
- Stop immediately when structured gate passes and selected candidate is valid, returning the selected best candidate.
- Stop when critique is resolved and no warning/error unresolved issues remain, even if gate decision says continue.
- Compare ranked candidate quality across iterations; stop after a new iteration fails to beat the best prior candidate or reduce material issues.
- Keep existing stop reasons and add selection/gate rationale fields so users can see why the final candidate won.

### Compatibility and Scope Boundaries
- Do not change model routing in this phase. Keep the existing loop phase completion path; routing and overrides belong to Phase 15.
- Do not add UI controls in this phase. Store typed metadata for later UI/CLI rendering; Phase 16 owns inspection controls.
- Malformed selection output must produce explicit degraded state with a fallback candidate if safe, and failed state only if no usable candidate can be returned.
- Add fake-model tests for refined candidate preservation, earlier-candidate selection, invalid candidate fallback/degraded state, pass/critique/no-improvement stops, and non-loop regression.

### the agent's Discretion
The agent may choose helper names and exact ranking weights as long as selection is deterministic, typed metadata explains the selected candidate, earlier candidates remain eligible, non-loop behavior is preserved, and failures are explicit.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/domain/types.ts` contains `QualityLoopCandidateSummary`, `QualityLoopGateEvaluation`, `QualityLoopBestOfProgressEvaluation`, `QualityLoopIterationRecord`, and `QualityLoopMetadata`.
- `src/domain/recursive-language-model.ts` already stores runtime-local candidate full text in `candidateTexts`, parses structured best-of-progress JSON, and has gate stop routing.
- `tests/recursive-language-model.test.ts` has `QueueModel`, structured evaluator fixtures, quality-loop stop tests, and renderer tests.

### Established Patterns
- Full answer text stays runtime-local; metadata stores capped summaries and ids.
- Loop metadata is canonical and mirrored to execution graph nodes through `writeLoopMetadata()`.
- Terminal states go through the local `finish()` helper.
- Tests use fake model queues rather than external model calls.

### Integration Points
- Extend candidate/selection metadata types in `src/domain/types.ts`.
- Add deterministic candidate ranking/selection helpers in `src/domain/recursive-language-model.ts`.
- Replace current "best_of_progress candidate always selected" behavior with selector state that can select any valid candidate.
- Update quality-loop tests to assert earlier-candidate wins, invalid selection fallback, and stop reasons return the selected best text.

</code_context>

<specifics>
## Specific Ideas

Use existing stop reasons: `passed`, `critique_resolved`, `no_meaningful_improvement`, `max_iterations`, `budget_exhausted`, `human_accepted`, `stopped`, `degraded`, `failed`.

</specifics>

<deferred>
## Deferred Ideas

- Phase-specific model routing and overrides belong to Phase 15.
- Rich UI/CLI loop inspection and manual loop controls belong to Phase 16.
- Broader regression harness coverage belongs to Phase 17.

</deferred>
