---
phase: 14-refine-and-best-of-progress-engine
subsystem: quality-loop-runtime
tags: [typescript, quality-loop, refinement, selection, tests]
created: 2026-05-18
---

# Phase 14 Research: Refine and Best-of-Progress Engine

## Research Complete

Phase 14 should extend the Phase 13 structured evaluator contract by making final answer selection deterministic over all accumulated candidates. Existing runtime-local `candidateTexts` already allows full answers to stay out of graph metadata while candidates remain inspectable by id, phase, summary, and score.

## Implementation Approach

- Extend `QualityLoopCandidateSummary` with compact selection metadata.
- Add `QualityLoopSelectionMetadata` to `QualityLoopMetadata`.
- Keep draft, refine, and best-of-progress candidates from all iterations eligible.
- Parse best-of-progress output as before, but validate the selected candidate id against accumulated candidates.
- If the selected candidate is valid, return its runtime-local full text.
- If the selected candidate is invalid, rank valid candidates deterministically, select a safe fallback, record the invalid id, and terminate degraded.
- If no usable candidate exists, fail explicitly.

## Validation Architecture

Use existing Node test infrastructure:

- Quick command: `npm run build && node --test --test-name-pattern='quality loop (preserves refined candidates for comparison|can select earlier candidate as final answer|degrades and falls back on invalid best of progress candidate|gate stops with passed|gate stops with critique resolved|gate stops with no meaningful improvement)' dist/tests/recursive-language-model.test.js`
- Broad quality loop command: `npm run build && node --test --test-name-pattern='quality loop' dist/tests/recursive-language-model.test.js`
- Full suite: `npm test`

## Risks

| Risk | Mitigation |
|------|------------|
| Selection silently falls back to latest candidate | Add invalid-id degraded test and earlier-candidate selection test. |
| Full answer text leaks into graph metadata | Preserve runtime-local `candidateTexts`; metadata stores summary and selection fields only. |
| Older parse failure behavior regresses | Run broad `quality loop` subset. |
