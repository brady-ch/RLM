# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-14
**Context:** Active requirements captured after v1.1 shipped; archived requirements live under `.planning/milestones/`.

## Refinement Loop Requirements

- [ ] **LOOP-01**: User can create a hybrid refinement loop node that appears as a single top-level graph node while exposing an inspectable internal `Draft -> Critique -> Refine -> Gate -> Best-of-Progress` workflow.
- [ ] **LOOP-02**: Refinement loop nodes use a default adaptive rubric that selects evaluation criteria from prompt and artifact context, with general answer quality as fallback and specialized rubrics for code, planning/architecture, user-facing writing, and structured artifacts.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOOP-01 | TBD | Proposed |
| LOOP-02 | TBD | Proposed |

