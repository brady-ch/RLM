---
phase: 13-rubric-and-evaluator-contract
subsystem: quality-loop-runtime
tags: [typescript, quality-loop, rubric, evaluator, parsing, tests]
created: 2026-05-18
---

# Phase 13 Research: Rubric and Evaluator Contract

## Research Complete

Phase 13 should build directly on the Phase 12 quality-loop runtime contract. The existing runtime already creates a collapsed `quality-loop` graph node, calls the five loop phases with tools disabled, stores canonical loop metadata in `RecursivePromptMetadata.qualityLoop` and `ExecutionGraphNode.loop`, returns full selected candidate text from runtime-local storage, and exposes compact/JSON loop metadata through `src/cli/render.ts`.

The implementation should add deterministic rubric selection and structured evaluator parsing inside the domain layer, with renderer and fake-model tests proving the new contract is visible and non-silent.

## Current Runtime Shape

### Source of Truth

- `src/domain/types.ts`
  - Defines `QualityLoopConfig`, `QualityLoopMetadata`, `QualityLoopIterationRecord`, `QualityLoopPhaseRecord`, `QualityLoopCandidateSummary`, `QualityLoopIssue`, `QualityLoopStopReason`.
  - Stop reasons already include `passed`, `critique_resolved`, `no_meaningful_improvement`, `max_iterations`, `budget_exhausted`, `human_accepted`, `stopped`, `degraded`, and `failed`.
- `src/domain/recursive-language-model.ts`
  - `QUALITY_LOOP_PHASES` is `draft`, `critique`, `refine`, `gate`, `best_of_progress`.
  - `runQualityLoop()` owns iteration lifecycle, candidate summaries, issue records, usage, and terminal state.
  - `completeQualityLoopPhase()` centralizes loop model calls, model name capture, usage delta, tool disabling, and cancellation.
  - `qualityLoopMessages()` currently emits free-text placeholder instructions.
  - Gate degraded handling currently checks whether gate output includes `DEGRADED`.
- `src/cli/render.ts`
  - Compact output prints loop status, stop reason, iteration count, selected candidate, and usage.
  - JSON output already includes `qualityLoop`.
- `tests/recursive-language-model.test.ts`
  - Uses `QueueModel` fake completions to verify quality-loop execution without external services.
  - Already covers collapsed node shape, phase model metadata, budget exhaustion, degraded/failed terminal states, approval wait, compact render, and JSON render.

## Implementation Approach

### 1. Extend Quality Loop Types

Add rubric and evaluator contract types in `src/domain/types.ts`:

- `QualityLoopRubricId`
  - `general_answer_quality`
  - `code_engineering`
  - `planning_architecture`
  - `user_facing_writing`
  - `structured_artifact`
- `QualityLoopRubricCriterion`
  - `id`, `label`, `description`
- `QualityLoopRubricSelection`
  - `id`, `label`, `rationale`, `matchedSignals`, `confidence`, `criteria`
- `QualityLoopCritiqueEvaluation`
  - `summary`, `issues`, `resolved`, `suggestedImprovements`
- `QualityLoopGateEvaluation`
  - `decision`, `score`, `passThreshold`, `rubricFit`, `critiqueResolved`, `meaningfulImprovement`, `rationale`, `failedConditions`, `unresolvedIssues`
- `QualityLoopBestOfProgressEvaluation`
  - `selectedCandidateId`, `rationale`, `score`, `comparisonNotes`
- `QualityLoopEvaluatorParseState`
  - phase, status, optional error, rawPreview, and parsed output if needed.

Extend `QualityLoopMetadata` with:

- `rubric?: QualityLoopRubricSelection`
- Optional compact terminal gate details, such as `gate?: QualityLoopGateEvaluation`

Extend `QualityLoopIterationRecord` with:

- Optional `critiqueEvaluation`, `gateEvaluation`, and `bestOfProgressEvaluation`.

Extend `QualityLoopPhaseRecord` with:

- Optional `parseStatus: "parsed" | "degraded" | "failed"`
- Optional `parseError`

These fields remain optional so existing callers and non-loop behavior stay compatible under `exactOptionalPropertyTypes`.

### 2. Deterministic Rubric Selection

Use a pure helper to select a rubric before the first iteration starts:

```ts
function selectQualityLoopRubric(prompt: string, task: TaskNode): QualityLoopRubricSelection
```

Heuristic signals:

- Code/engineering: code fences, stack terms, file paths, tests, TypeScript/Node terms, "bug", "fix", "refactor", "implement".
- Planning/architecture: "plan", "architecture", "roadmap", "design", "tradeoff", "system", "phase".
- User-facing writing: "rewrite", "copy", "email", "tone", "blog", "headline", "announcement", "documentation for users".
- Structured artifact: "JSON", "YAML", "schema", "table", "checklist", "frontmatter", "XML", "CSV".
- General answer quality: fallback.

Record matched signal strings and a confidence score. Keep selection deterministic and local; do not call a model to choose rubrics.

### 3. Structured Evaluator Parsing

Do not add a new dependency. Use JSON extraction and runtime shape guards:

- Ask critique, gate, and best-of-progress phases to return JSON.
- Parse the first JSON object from model output.
- Validate field presence and primitive types with small type guards.
- Convert parsed issues into existing `QualityLoopIssue` records.
- On malformed evaluator output:
  - If a usable candidate exists, terminate with `status: "degraded"` and `stopReason: "degraded"`.
  - If no usable candidate exists, terminate with `status: "failed"` and `stopReason: "failed"`.
  - Attach issue records to the evaluator phase and loop metadata.

Draft and refine may stay text-producing for this phase. Critique, gate, and best-of-progress become structured evaluator outputs.

### 4. Gate Semantics

Replace the `DEGRADED` text marker with structured gate evaluation.

Pass conditions:

- `decision === "pass"`
- `score >= passThreshold`
- `rubricFit === true`
- `critiqueResolved === true`
- `meaningfulImprovement === true`
- no error-severity unresolved issues

Stop routing:

- `passed`: all pass conditions true.
- `critique_resolved`: critique is resolved or informational-only and score meets threshold.
- `no_meaningful_improvement`: no material score or issue-count improvement compared with previous iteration.
- Continue: gate says continue and iteration budget remains.
- `degraded`: evaluator parse failed but a usable selected candidate exists.
- `failed`: evaluator parse failed before any usable candidate exists.
- Existing `max_iterations` and `budget_exhausted` remain unchanged.

Use compact gate rationale and failed condition strings so later UI/CLI phases can render without reparsing raw model output.

### 5. Best-of-Progress Contract Boundary

Phase 13 should parse best-of-progress evaluator output and record rationale/score/comparison notes, but it should not implement the final selection algorithm beyond the current simple selected candidate behavior. Phase 14 owns refined candidate selection and robust best-of-progress behavior.

For Phase 13, best-of-progress can still select the current `best_of_progress` candidate id, provided the structured output is recorded and malformed output degrades/fails explicitly.

## Validation Architecture

### Automated Test Strategy

Use existing Node test infrastructure:

- Quick command:
  - `npm run build && node --test --test-name-pattern='quality loop.*rubric|quality loop.*evaluator|quality loop.*gate|renders .*quality loop' dist/tests/recursive-language-model.test.js`
- Full command:
  - `npm test`

Add focused fake-model tests in `tests/recursive-language-model.test.ts`:

1. Deterministic rubric selection for each accepted rubric id.
2. Rubric selection metadata appears on `result.metadata.qualityLoop` and graph node loop metadata.
3. Valid structured critique, gate, and best-of-progress JSON parses into iteration metadata.
4. Malformed critique/gate/best-of-progress output produces explicit degraded state when a candidate exists.
5. Malformed evaluator output before a usable candidate produces failed terminal metadata.
6. Gate pass conditions return `passed`.
7. Critique-resolved conditions return `critique_resolved`.
8. No-meaningful-improvement conditions return `no_meaningful_improvement`.
9. Compact and JSON render include new rubric/evaluator metadata in a grep-verifiable way.

### Verification Constraints

- Do not run browser automation or localhost control-server tests for this phase unless a later plan explicitly scopes UI work.
- Preserve non-loop recursive behavior by keeping all new logic under `qualityLoop.enabled === true`.
- Preserve tool disabling in loop phase calls.
- Preserve strict TypeScript compatibility with `exactOptionalPropertyTypes`.

## Recommended Plan Slices

1. **Type and Rubric Contract**
   - Extend domain types.
   - Add deterministic rubric definitions and selection helper.
   - Store selected rubric in loop metadata.
   - Add tests for all five rubric categories.

2. **Evaluator Parsing and Gate Semantics**
   - Add JSON extraction/guards for critique, gate, and best-of-progress.
   - Replace `DEGRADED` text marker gate behavior with structured gate routing.
   - Add parse success/degraded/failed and stop-reason tests.

3. **Renderer and Contract Verification**
   - Expose compact rubric/gate lines in `src/cli/render.ts`.
   - Extend JSON render assertions for structured evaluator fields.
   - Run targeted quality-loop tests and build.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Type growth makes `recursive-language-model.ts` harder to maintain. | Keep pure rubric/parser helpers near existing loop helpers first; only extract a module if readability requires it. |
| Model outputs include prose around JSON. | Parse the first JSON object and report `rawPreview` on failure. |
| Gate semantics accidentally skip best-of-progress phase. | Preserve the five-call phase sequence for Phase 13 unless budget preflight stops before an iteration. |
| Stop reasons overlap. | Apply a deterministic priority order: parse failure, pass, critique resolved, no meaningful improvement, continue/max iterations. |
| Renderer output becomes too verbose. | Keep compact output to one additional rubric line and one gate line; full detail stays in JSON metadata. |

## Open Questions

None blocking. The smart-discuss decisions are sufficient for planning.
