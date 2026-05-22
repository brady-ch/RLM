---
phase: 30-plan-from-node-foundation
plan: 02
status: complete
completed: 2026-05-22
---

# Plan 30-02 Summary

Replaced heuristic child planning with async model-driven planning.

- `InteractiveExecutionSession.planNode` is now async and requires an injected `planModel`.
- Empty prompts fail with `invalid_prompt`; missing planner model fails with `planning_failed`.
- Planner errors map to `MutationError` codes `planning_failed` and `invalid_planner_output` with explicit no-fallback suggested fixes.
- Replanning removes pristine model-planned descendants while preserving manual children.
- Planner-created nodes are marked `composer.plannedBy = "model"`; manual adds are marked `plannedBy = "user"`.
- Child subtree planning sends ancestor context to the planner.

Verification:

- Added tests for async planning, replan replacement, manual child preservation, ancestor context, budget exhaustion, and invalid planner output.
- `npm test` passed 177/177 outside the sandbox.
