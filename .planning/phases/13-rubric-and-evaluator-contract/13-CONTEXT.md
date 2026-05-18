# Phase 13: Rubric and Evaluator Contract - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 13 delivers the rubric and evaluator contract for answer-quality loops. Users can see which adaptive default rubric was selected and why, distinguish the five v1.2 rubric categories, and trust critique, gate, and best-of-progress evaluator outputs because they parse into structured loop state or surface explicit degraded/failed states. This phase enriches the Phase 12 loop runtime contract without implementing the full refinement/selection engine, phase-specific model routing, or rich UI controls reserved for later phases.

</domain>

<decisions>
## Implementation Decisions

### Rubric Selection and Visibility
- Select the default rubric deterministically from prompt/task text, artifact hints, and node/task metadata; record matched signals and confidence so users can audit why it fit.
- Add typed rubric metadata to `QualityLoopMetadata` and mirror key selection fields into graph node loop metadata, keeping final result and UI/CLI consumers aligned.
- Expose rubric id, label, fit rationale, matched signals, and top-level criteria immediately; keep full criterion scoring nested in evaluator records.
- Implement exactly the roadmap rubric set for this phase: general answer quality, code/engineering, planning/architecture, user-facing writing, and structured artifact.

### Structured Evaluator Outputs
- Add a strict structured critique schema with summary, issues, severity, resolved status, and suggested improvements; malformed output becomes an explicit degraded state when a usable candidate exists.
- Add a structured gate schema with decision, score, pass threshold, rubric fit, critique resolution, meaningful improvement, and unresolved issues.
- Add a structured best-of-progress selection schema with selected candidate id, rationale, score, and comparison notes, while preserving full selected answer text outside graph metadata.
- Surface explicit degraded loop state when parse failures occur and a usable candidate exists; surface failed state when no usable candidate exists, with issue records tied to the evaluator phase.

### Gate Semantics and Stop Reasons
- Require the gate to account for rubric fit, critique resolution, and meaningful improvement before returning `passed`.
- Use `critique_resolved` when unresolved issues are empty or informational-only and score meets the configured pass threshold.
- Compare current candidate score and unresolved issue delta against prior iterations; stop with `no_meaningful_improvement` after no material gain.
- Store compact gate rationale and failed conditions on the iteration and terminal loop metadata so CLI/UI can render it without reparsing text.

### Compatibility and Boundaries
- Do not change final answer selection in this phase. Enrich rubric/evaluator state and gate decisions; final best-of-progress selection behavior stays simple until Phase 14.
- Do not add model routing changes in this phase. Keep all loop phases on the existing completion path; phase-specific model routing belongs to Phase 15.
- Replace placeholder free-text phase prompts with schema-constrained instructions for critique, gate, and best-of-progress, while preserving no-tool loop calls.
- Add fake-model tests for rubric selection, each rubric category, parse success, parse degraded/failure, gate pass/continue semantics, and explicit metadata rendering.

### the agent's Discretion
The agent may choose exact TypeScript names, helper boundaries, and parser implementation details as long as rubric selection is deterministic, evaluator outputs are typed, parse failures are non-silent, existing non-loop behavior is preserved, and later phases can build on the same metadata contract.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/domain/types.ts` already defines `QualityLoopConfig`, `QualityLoopMetadata`, `QualityLoopIssue`, candidate, phase, iteration, and stop-reason contracts that should be extended rather than bypassed.
- `src/domain/recursive-language-model.ts` already owns `runQualityLoop()`, `completeQualityLoopPhase()`, loop phase prompts, candidate summaries, issue records, terminal stop handling, metadata synchronization, and loop execution events.
- `src/cli/render.ts` already projects canonical `result.metadata.qualityLoop` into compact and JSON output.
- `tests/recursive-language-model.test.ts` already contains `QueueModel`-style fake-model coverage for quality-loop runtime behavior, degraded outputs, failures, selected candidates, and renderer output.
- Phase 12 planning artifacts establish that rubric schema, structured evaluator parsing, and richer gate semantics are intentionally deferred to this phase.

### Established Patterns
- Domain code keeps canonical runtime state in typed metadata and mirrors execution graph updates through `writeLoopMetadata()` and execution graph helpers.
- Loop terminal states go through one `finish()` helper that requires a status, stop reason, message, usage summary, and synchronized graph/result metadata.
- Loop phase calls use the same model completion path with tools disabled, centralized model-call counting, usage capture, and response model tracking.
- Full candidate text is kept runtime-local while graph/result metadata stores capped summaries and optional selected candidate ids.
- The project prefers explicit degraded/failed states over silent fallback when parsing, config, model selection, or execution behavior is invalid.

### Integration Points
- Extend `QualityLoopMetadata`, `QualityLoopIterationRecord`, and related evaluator/rubric types in `src/domain/types.ts`.
- Add deterministic rubric selection and schema parsing helpers near the quality-loop runtime path or in a small domain helper module if that keeps `recursive-language-model.ts` manageable.
- Replace `qualityLoopMessages()` placeholder prompts for critique, gate, and best-of-progress with schema-constrained instructions.
- Update `runQualityLoop()` gate handling so structured gate outcomes drive `passed`, `critique_resolved`, `no_meaningful_improvement`, `degraded`, and continuation behavior.
- Update renderer tests and quality-loop runtime tests to verify typed rubric/evaluator metadata and explicit parse failure behavior.

</code_context>

<specifics>
## Specific Ideas

Use the five accepted rubric ids as stable public contract values: `general_answer_quality`, `code_engineering`, `planning_architecture`, `user_facing_writing`, and `structured_artifact`.

Preserve the Phase 12 stop-reason set: `passed`, `critique_resolved`, `no_meaningful_improvement`, `max_iterations`, `budget_exhausted`, `human_accepted`, `stopped`, `degraded`, `failed`.

</specifics>

<deferred>
## Deferred Ideas

- Full refine algorithm and final best-of-progress selection behavior belong to Phase 14.
- Phase-specific model routing and overrides for draft, critique, refine, gate, and best-of-progress belong to Phase 15.
- Rich UI/CLI loop inspection and human loop controls belong to Phase 16.
- Full cross-surface regression harness belongs to Phase 17.

</deferred>
