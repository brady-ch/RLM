# Phase 30: Plan-from-Node Foundation - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can author execution graphs from any node using model-driven planning as the default path. This phase replaces keyword `plannedChildrenFor` heuristics with a structured planner, demotes chat-first pre-run authoring, and surfaces explicit failure states with no silent fallback. Protected replan UX (Replace/Merge/Cancel) is deferred to Phase 31.

</domain>

<decisions>
## Implementation Decisions

### Root Authoring UX
- Default landing state is a focused empty `root-composer` with the prompt field ready (PLAN-01).
- Primary submit action lives on the selected node card (root or child) — graph-primary authoring.
- Chat-first pre-run flow is demoted to a secondary refinement panel; graph submit is the default path.
- Empty-root submit immediately invokes model planner on `root-composer` with no intermediate chat turn.

### Model Planner Contract
- Replace `plannedChildrenFor` keyword heuristics with a dedicated planner completion returning structured child nodes (label, prompt, type, complexity).
- Invalid or malformed planner output hard-fails with explicit `planning_failed` state — no heuristic fallback (PLAN-07).
- Planning uses a configurable `purpose: plan` tier via existing purpose routing.
- Child `type` values reuse existing `ComposerNodeType` enum at plan time.

### Subtree & Replan Semantics
- Child-node submit plans only that node's direct children (subtree root = selected node) per PLAN-03.
- Planner receives concatenated ancestor prompts and labels up to the budget root.
- Parent resubmit silently replaces pristine auto-planned descendants without a dialog (PLAN-04); protection gate is Phase 31.
- During parent replan in Phase 30, leave manual/pinned children untouched; only replace nodes with `planned` status and no user overrides.

### Failure States & CLI Parity
- Plan-budget exhaustion sets node to `awaiting_approval` with explicit exhausted budget metadata (extend existing pattern).
- CLI exposes plan-from-node via `POST /api/nodes/:id/plan` plus matching CLI flag/command with the same error codes as UI.
- Align errors via existing `MutationError` codes plus new `planning_failed` and `invalid_planner_output`.
- Planner failures include planner purpose, model used, and redacted validation error in trace/diagnostics.

### Claude's Discretion
- Exact planner prompt/schema design, UI layout for demoted chat panel, and test fixture structure.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ExecutionController.planNode()` in `src/application/execution-controller.ts` — budget checks, child creation, `pendingPlan`, approval flow.
- `plannedChildrenFor()` — keyword heuristic to replace (lines ~1653–1675).
- `POST /api/nodes/:id/plan` in `src/application/control-server.ts`.
- `root-composer` bootstrap in execution controller and UI tests in `tests/recursive-language-model.test.ts`.
- `PurposeRoutingLanguageModel` in `src/application/model-provider.ts` for tier routing.

### Established Patterns
- Composer metadata on nodes (`composer.planBudget`, `pendingPlan`, `recommendedAction`).
- Explicit failure visibility via `MutationError` and non-silent publish events.
- Layered architecture: application orchestration, domain types in `src/domain/types.ts`, React UI under `ui/`.

### Integration Points
- `execution-controller.ts` — core plan/replan logic.
- `control-server.ts` — API routes for plan and extend-budget.
- `ui/src/main.tsx` — graph rendering and node submit UX.
- `rlm.config.yaml` — add `plan` purpose tier if missing.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP success criteria and accepted smart-discuss defaults.

</specifics>

<deferred>
## Deferred Ideas

- Protected replan Replace/Merge/Cancel gate — Phase 31 (PLAN-05, PLAN-06).
- Full CLI parity for all v1.5 flows — Phase 35 (SURF-01).

</deferred>
