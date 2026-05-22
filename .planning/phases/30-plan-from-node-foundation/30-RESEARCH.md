# Phase 30: Plan-from-Node Foundation — Research

**Researched:** 2026-05-21
**Status:** Complete

## Summary

Phase 30 replaces the synchronous keyword heuristic `plannedChildrenFor()` in `execution-controller.ts` with an async model-driven graph planner that returns structured child node specs. The existing `planNode()` orchestration (budget checks, child registration, `pendingPlan`, approval flow) stays; only the child-spec source changes. UI and API surfaces already expose `POST /api/nodes/:id/plan` — this phase wires a real planner and updates UX per UI-SPEC.

## Standard Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Planner output validation | `zod` (already in project) | Matches `project-config.ts` patterns; hard-fail on malformed JSON |
| Model routing | `PurposeRoutingLanguageModel` with new `purpose: "plan"` | CONTEXT locked decision D-model-planner |
| Planner module location | `src/application/graph-planner.ts` | Application orchestration layer per AGENTS.md |
| Test doubles | Injectable `LanguageModelPort` mock returning fixed JSON | Avoids live Ollama in unit tests |
| JSON extraction | Brace-slice parse like `recursive-language-model.ts` | Existing pattern for model JSON output |

## Architecture

```
UI/CLI → control-server POST /api/nodes/:id/plan
       → InteractiveExecutionSession.planNode() [async]
       → graph-planner.planChildren(model, context)
       → PurposeRoutingLanguageModel.complete({ purpose: "plan" })
       → zod validate → child specs → register nodes
```

### Key changes

1. **`LanguageModelPurpose`** — add `"plan"` to `src/ports/language-model-port.ts` and `MODEL_PURPOSES` in `project-config.ts`.
2. **`rlm.config.yaml`** — add `plan: medium` (or `small`) under each agent's `models` block; default agent at minimum.
3. **`graph-planner.ts`** — exports:
   - `PlannedChildSpec` type (label, prompt, type, complexity)
   - `GraphPlannerContext` (node prompt/label, ancestor chain, remainingNodes cap)
   - `planChildren(model, context): Promise<PlanChildrenResult>` with diagnostics (model, purpose, validationError)
4. **`execution-controller.ts`** — `planNode` becomes async; accepts injected model; calls planner; throws `MutationError("planning_failed" | "invalid_planner_output" | "invalid_prompt")`; removes `plannedChildrenFor`.
5. **Replan (PLAN-04)** — before creating new children, remove existing direct descendants where `status === "planned"` AND no `modelOverrideSource === "user"` AND not manually added (no `approvalSource` manual markers / detect via absence of user edits: keep nodes with `modelOverrideSource === "user"` or manually added via `addNode` — use `originalPrompt !== prompt` or a `plannedBy: "model" | "user"` flag). Simplest approach per CONTEXT: remove descendants with `status === "planned"` that have no user model override and were created by prior plan (track `plannedBy: "model"` on composer metadata OR infer: child ids matching `plan-*` prefix from auto-plan). **Recommendation:** add optional `composer.plannedBy?: "model" | "user"` when registering planned children.

## Validation Architecture

| Behavior | Test approach |
|----------|---------------|
| Model planner returns valid children | Mock model → assert child nodes created |
| Invalid JSON → `invalid_planner_output` | Mock model returns garbage → MutationError |
| Model failure → `planning_failed` | Mock model throws → MutationError |
| Empty prompt → `invalid_prompt` | planNode before save |
| Budget exhausted → `awaiting_approval` | Existing test pattern preserved |
| Parent replan replaces pristine children | Plan twice; count unchanged; old plan-* ids gone |
| Child plan uses ancestor context | Assert planner prompt includes ancestor labels |
| API returns MutationError codes | fetch `/api/nodes/:id/plan` → 409 + code |
| UI copy for failures | grep UI-SPEC strings in main.tsx |

## Architectural Responsibility Map

| Layer | Responsibility |
|-------|----------------|
| `src/application/graph-planner.ts` | Prompt construction, model call, JSON parse/validate |
| `src/application/execution-controller.ts` | Budget, replan, node registration, MutationError |
| `src/application/control-server.ts` | Async route handler, error mapping |
| `src/application/model-provider.ts` | No change (purpose routing already generic) |
| `src/domain/types.ts` | Optional `composer.plannedBy`, planning diagnostics type |
| `ui/src/main.tsx` | Graph-primary UX, failure surfaces |
| `rlm.config.yaml` | `plan` purpose tier |
| `tests/recursive-language-model.test.ts` | Integration tests with mock planner |

## Pitfalls

- **Do not fall back to `plannedChildrenFor`** on planner failure — hard-fail per PLAN-07.
- **`planNode` is currently sync** — control-server and tests must await it.
- **Existing tests rely on keyword heuristics** (audiobook prompt → 5 TTS children) — update to mock planner fixtures.
- **Session constructor lacks model** — add optional `planModel?: LanguageModelPort` to session factory; wire from `index.ts` via `PurposeRoutingLanguageModel`.
- **Break down route** reuses `planNode` — same planner path applies.

## Out of Scope

- Protected replan Replace/Merge/Cancel (Phase 31)
- Expert team binding (Phase 32)
- Graph execution loop (Phase 33)
- Full CLI parity for all v1.5 flows (Phase 35) — only plan-from-node command/API parity here
