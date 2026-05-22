# Phase 31 Research

Phase 31 builds directly on Phase 30's model-driven planner and current session mutation architecture.

Relevant existing patterns:
- `InteractiveExecutionSession.planNode` already removes pristine model-planned descendants and creates new planner children.
- `MutationError` is the standard graph mutation failure contract and maps to 409 JSON through `control-server.ts`.
- `composer.plannedBy` distinguishes model-created and user-created nodes.
- `modelOverrideSource === "user"` already indicates user protection.
- UI planning failures already surface node-scoped copy from Phase 30.

Planning implication:
- The cleanest implementation is to add an explicit replan choice to `planNode`, detect protected descendants before planner mutation, and use existing error mapping for missing choice.
