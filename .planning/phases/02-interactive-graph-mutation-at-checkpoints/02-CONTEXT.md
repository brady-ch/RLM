# Phase 2 Context: Interactive Graph Mutation at Checkpoints

## Domain
Allow safe in-memory node edit/add/delete/connect operations at paused checkpoints, with backend-controlled validation and explicit user-visible errors.

## Canonical Refs
- `.planning/ROADMAP.md` — Phase 2 scope and success criteria.
- `.planning/REQUIREMENTS.md` — `APRV-02`, `APRV-03`, `APRV-04`, `ERRO-02`.
- `.planning/PROJECT.md` — v1 boundaries and constraints.
- `.planning/phases/01-planned-graph-and-approval-foundation/01-CONTEXT.md` — locked phase 1 control invariants.
- `src/application/execution-controller.ts` — source of truth for graph state and approval transitions.
- `src/application/control-server.ts` — transport API to controller.
- `src/domain/recursive-language-model.ts` — subtree execution semantics.
- `ui/src/main.tsx` — mutation UI actions and error display.

## Code Context
### Reusable Assets
- Existing controller-authoritative approval model with tokened actions.
- Existing control-server endpoints and normalized error paths.
- Existing UI node inspector action pattern with explicit error surface.

### Established Patterns
- Mutation authority belongs in backend control layer (`execution-controller`).
- Route handlers should proxy controller operations, not own graph logic.
- Structured errors preferred for deterministic handling and testing.

### Integration Points
- Add/delete/connect APIs should call a single controller mutation contract.
- Recursive engine should support subtree re-evaluation after approved mutation sets.
- UI should render structured mutation errors without hidden fallback.

## Decisions
### Mutation Boundary Model
- All graph mutation operations are controller-only.
- `control-server` remains transport/proxy only.
- UI sends mutation intents and renders backend results.

### Graph Integrity Rules
- Cycle policy: cycles are allowed.
- Delete behavior: cascade-delete descendants.
- Parent/depth constraints:
  - valid parent is required for non-root nodes,
  - enforce configured max depth when max depth is configured.

### Resume Semantics After Mutation
- After mutation at a checkpoint, re-evaluate affected subtree before resuming execution.
- Resume should not blindly continue stale downstream state.

### Error Contract
- Invalid mutation responses must use structured errors:
  - `code`
  - `message`
  - `nodeIds`
  - optional `details`
  - optional `suggestedFix`

## Deferred Ideas
- Optional no-max-depth execution mode with stronger stopping guardrails.
- This is deferred beyond Phase 2 (execution-policy expansion scope).

## Scope Guardrail
Phase 2 focuses on safe graph mutation + validation + checkpoint resume behavior only. Model routing overrides and initial-plan-only auto-run remain in later phases.

---
*Captured on: 2026-05-08*
