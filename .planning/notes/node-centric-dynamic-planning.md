# Node-Centric Dynamic Planning (Explore B)

**Date:** 2026-05-19  
**Context:** `$gsd-explore` — dynamic graph authoring as the primary product surface (before fixed workflows and expert-team tooling).

## Product intent

Users describe work **on the graph**, not in a side channel. The default canvas is a **single empty root node** (`root-composer`). Typing into a node and **submitting** runs **plan mode** for that node’s subtree. Fixed pipelines (n8n-style YAML) are a **later export** of a graph the user likes, not the default authoring path.

Priority order across the larger vision: **B → A → C** (dynamic plan-from-node first, then save-as-workflow, then expert team + specialized tools).

## Interaction model

| Action | Behavior |
|--------|----------|
| App load | One empty/focused root node; no “waiting for execution graph” empty canvas |
| Submit on node | Model-driven plan: generate or refresh **direct children** (and optionally deeper recursion per flags/budget) |
| Submit on child | Plan **under that child** only; inherits parent prompt chain + plan budget root |
| Resubmit parent (broad strokes) | Replan descendant **planned** structure from updated parent prompt |
| Manual add child | Still supported; counts as protected state for replan gating |

Planning must replace today’s **keyword heuristics** in `plannedChildrenFor` (`execution-controller.ts`) with a **planner model** that reads the node prompt, ancestor context, agent/tool policy, and budget.

## Parent replan and conflict UX

When a parent replan would affect existing descendants:

- **Silent replan** if the subtree is still **pristine** (all nodes from the last auto-plan from this parent; no manual prompt edits, pins, or user model overrides).
- **Ask** if **protected** state exists:
  - **Replace subtree** — discard auto-planned descendants; replan from parent intent
  - **Merge** — keep pinned / user-edited nodes; regenerate or adjust only non-protected nodes; add nodes for gaps
  - **Cancel**

Merge semantics (implementation detail for plan-phase):

- Track `planGenerationId` or `plannedByParentAt` on auto-created nodes
- Treat `originalPrompt !== prompt`, `modelOverrideSource === "user"`, explicit **pin** flag, or manual `addNode` as protected
- Merge passes parent + pinned children summaries into the planner

## Relation to existing runtime

- **Reuse:** `InteractiveExecutionSession`, `planNode` / `planBudget` / `findBudgetRoot`, composer node types, approval modes, `--plan-only`, UI React Flow canvas
- **Change:** Always seed `root-composer`; unify **Save + Plan** into **Submit** on the node card; implement cascade replan API; wire planner to model port (small/fast tier acceptable for planning)

## Out of scope for this note

- Hugging Face installer, multi-host catalog, temperature UI (separate milestone themes)
- Full n8n parity (scheduling, triggers, credentials) — export/import is the bridge
- Expert-team tool specialization (explore C) — same graph, different agent/tool bindings per node type later

## Open follow-ups (explore A / C)

- **A:** Export graph → `workflows.*` YAML + agent dispatch snapshot
- **C:** Per-node agent profile + constrained tool sets for small-model experts
