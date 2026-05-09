# Phase 1 Context: Planned Graph and Approval Foundation

## Domain
Deliver a reliable prompt-to-plan graph and enforce approval pause semantics as a hard gate before child execution.

## Canonical Refs
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and scope lock.
- `.planning/REQUIREMENTS.md` — `PLAN-01` and `APRV-01` definitions.
- `.planning/PROJECT.md` — project-level constraints and locked decisions.
- `src/application/execution-controller.ts` — approval lifecycle authority and execution state transitions.
- `src/application/control-server.ts` — UI/HTTP control surface and event delivery.
- `src/domain/recursive-language-model.ts` — planning/decomposition and recursive execution flow.
- `ui/src/main.tsx` — UI graph/event handling and approval interaction surface.

## Code Context
### Reusable Assets
- Existing execution control abstraction in `src/application/execution-controller.ts`.
- Existing event streaming path in `src/application/control-server.ts`.
- Existing UI graph inspector/state flow in `ui/src/main.tsx`.

### Established Patterns
- Ports/adapters separation and centralized orchestration in `src/application/`.
- Structured tool/model error returns; avoid silent failure patterns.
- Config-driven runtime behavior in `rlm.config.yaml` and `src/application/project-config.ts`.

### Integration Points
- Approval intents from CLI/UI should route through one controller API layer.
- UI should consume controller-emitted state/events, not own authoritative state.

## Decisions
### Approval State Machine Boundary
- Backend-authoritative state machine: `execution-controller` is source of truth.
- UI is a client: sends intents, renders backend-acknowledged state.
- No direct UI route/state shortcuts for approval transitions.

### Command Acceptance Boundary
- CLI and UI must call the same controller API for approval actions.
- Direct graph/state mutation from HTTP route handlers is disallowed for approval gating.

### Concurrency Semantics
- First-write-wins with idempotent checkpoint tokens/versioning.
- Duplicate actions become no-ops.
- Stale actions are rejected explicitly with a surfaced error.

## Deferred Ideas
- None from this discussion.

## Scope Guardrail
This context only covers Phase 1 scope (`PLAN-01`, `APRV-01`). Graph edit/add/delete functionality remains in Phase 2.

---
*Captured on: 2026-05-08*
