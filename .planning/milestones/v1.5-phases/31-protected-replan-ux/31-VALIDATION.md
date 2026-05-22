# Phase 31 Validation

Must-have validation cases:
- Parent replan with protected manual child and no replan choice returns `replan_requires_choice`.
- `replace` removes protected and pristine descendants and applies fresh planner output.
- `merge` preserves protected descendants, removes pristine model-planned descendants, and creates new planner children.
- `cancel` makes no model call and leaves the graph unchanged.
- API route accepts `{ replan: "replace" | "merge" | "cancel" }`.
- CLI parser accepts `--replan replace|merge|cancel`.
- UI contains protected replan gate copy and actions.
