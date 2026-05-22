---
phase: 30
slug: plan-from-node-foundation
created: "2026-05-21"
---

# Phase 30 Validation Strategy

## Critical Behaviors

| ID | Behavior | Verification |
|----|----------|----------------|
| V-01 | Model planner returns structured children | Mock model test → child nodes with label/prompt/type/complexity |
| V-02 | No heuristic fallback on failure | Planner error → graph unchanged, MutationError code set |
| V-03 | Child plan inherits ancestor context | Planner prompt includes ancestor chain |
| V-04 | Parent replan replaces pristine descendants | Second plan removes prior `plannedBy: model` children |
| V-05 | Budget exhaustion → awaiting_approval | Existing budget test still passes |
| V-06 | API/CLI error code parity | 409 response with `planning_failed` / `invalid_planner_output` |
| V-07 | Root composer empty-state UX | UI grep for UI-SPEC copy strings |

## Test Commands

```bash
npm test -- tests/recursive-language-model.test.ts -t "plan"
npm test
npm run build
```
