# Phase 13: Rubric and Evaluator Contract - Pattern Map

## Closest Analogs

| Target | Closest Existing Analog | Pattern to Reuse |
|--------|-------------------------|------------------|
| `src/domain/types.ts` quality-loop extensions | Existing `QualityLoopMetadata`, `QualityLoopIterationRecord`, `QualityLoopPhaseRecord`, `QualityLoopIssue` | Add optional typed fields under the same domain contract; preserve `exactOptionalPropertyTypes` with explicit `| undefined` on optional fields where needed. |
| `src/domain/recursive-language-model.ts` rubric selection | Existing `createEmptyLoopUsage()`, `qualityLoopMessages()`, `qualityLoopStopMessage()`, `preview()` helpers | Add pure helpers near existing loop helpers unless extraction is clearly needed. Keep logic deterministic and side-effect free. |
| `runQualityLoop()` metadata writes | Existing `writeLoopMetadata(task.id, metadata)` after phase/candidate/state updates | Update metadata immediately after rubric selection, parsed evaluator results, gate decisions, and terminal outcomes. |
| Evaluator parse failures | Existing failed phase catch block inside `runQualityLoop()` | Convert parse errors to `QualityLoopIssue` records with evaluator phase source and terminal degraded/failed behavior. |
| CLI compact rendering | Existing `qualityLoop:` and `qualityLoopUsage:` lines in `src/cli/render.ts` | Add at most one rubric line and one gate/evaluator line; keep full detail in JSON. |
| Tests | Existing `QueueModel` tests in `tests/recursive-language-model.test.ts` | Add fake completions returning JSON strings; assert loop metadata, graph node metadata, answer, stop reason, and renderer output. |

## Data Flow

1. CLI/config enables `config.qualityLoop`.
2. `RecursiveLanguageModel.run()` creates one `quality-loop` graph node and calls `runQualityLoop()`.
3. Phase 13 should select rubric before iteration execution and write it to `QualityLoopMetadata`.
4. Draft/refine phases produce candidate text.
5. Critique/gate/best-of-progress phases return structured JSON.
6. Parser helpers validate JSON and attach parsed evaluations to iteration/phase metadata.
7. Gate evaluation determines pass, critique resolved, no meaningful improvement, continue, degraded, or failed.
8. `writeLoopMetadata()` mirrors canonical loop metadata to result metadata and graph node metadata.
9. `renderCompact()` and `renderJson()` project the same canonical metadata.

## Files Expected To Change

- `src/domain/types.ts`
- `src/domain/recursive-language-model.ts`
- `src/cli/render.ts`
- `tests/recursive-language-model.test.ts`

## Implementation Notes

- Preserve the five phase order in `QUALITY_LOOP_PHASES`.
- Preserve no-tool loop calls in `completeQualityLoopPhase()`.
- Do not add phase-specific model routing yet; Phase 15 owns that.
- Do not make non-loop recursive execution depend on rubric/evaluator code.
- Keep parser output intentionally small and typed; raw full model text should not become graph metadata.
