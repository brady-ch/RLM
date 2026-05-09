# Phase 3 Research: Model-Aware Node Planning and Overrides

## Scope
- Phase: 3
- Requirements: `PLAN-02`, `MODL-01`, `MODL-02`, `MODL-03`
- Goal: persist planned model per node, support per-node override, display planned+effective model, and keep full model routing audit trail.

## Existing Surfaces
- `ExecutionGraphNode` metadata exists and can hold model fields.
- `PurposeRoutingLanguageModel` already logs model selection traces.
- Approval checkpoint flows are stable and can host per-node override action.

## Gaps
1. Node-level planned/effective model fields are not first-class in execution graph.
2. No per-node override command at checkpoint.
3. Execution path does not enforce strict fail on explicit selected-model failure at node scope.
4. Node cards do not display planned + effective model pair.
5. Full per-node model trail not emitted in a unified contract.

## Recommendations
- Extend node model with `plannedModel`, `effectiveModel`, `modelOverrideSource`.
- Add controller API for node-level model override (current-node only).
- Apply override in execution path for that node only.
- Keep strict fail: no auto-fallback when explicit node model fails.
- Add consolidated audit emission per node for planned/override/final model details.

## Wave Strategy
- Wave 1: backend model metadata + override semantics + strict fail behavior + tests.
- Wave 2: UI planned/effective display + checkpoint override controls + logging/report visibility.
