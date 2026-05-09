# Phase 3 Context: Model-Aware Node Planning and Overrides

## Domain
Make model assignment a first-class, visible, and overridable property per node, with strict execution semantics and explicit auditability.

## Canonical Refs
- `.planning/ROADMAP.md` — Phase 3 goal and success criteria.
- `.planning/REQUIREMENTS.md` — `PLAN-02`, `MODL-01`, `MODL-02`, `MODL-03`.
- `.planning/PROJECT.md` — core constraints and no-silent-failure posture.
- `.planning/phases/01-planned-graph-and-approval-foundation/01-CONTEXT.md` — approval authority and checkpoint semantics.
- `.planning/phases/02-interactive-graph-mutation-at-checkpoints/02-CONTEXT.md` — mutation/error contract patterns.
- `src/domain/recursive-language-model.ts` — node creation and execution flow.
- `src/application/model-provider.ts` — model routing resolution logic.
- `src/application/agent-runner.ts` — agent/model orchestration integration.
- `ui/src/main.tsx` — node card display and checkpoint interaction surface.

## Code Context
### Reusable Assets
- Existing node metadata model (`ExecutionGraphNode`) can be extended with planned/effective model fields.
- Existing approval checkpoint flow supports per-node user actions.
- Existing model routing layer (`PurposeRoutingLanguageModel`) already records selection traces.

### Established Patterns
- Backend remains authoritative for execution decisions and state transitions.
- UI should render backend-confirmed model state, not infer independently.
- Structured, explicit failure handling is required (no silent model fallback).

### Integration Points
- Node creation path should persist planned model metadata.
- Approval/inspection APIs should support per-node model override actions.
- Execution path should write effective model + full audit trail into events/metadata.

## Decisions
### Model Assignment Source
- Persist planned model on each node at creation time.
- Planned model remains stable for visibility and override targeting.

### Override Scope
- Override applies to current node only.
- Descendants and run defaults are unaffected.

### Fallback Behavior
- Strict fail if selected model is unavailable/fails.
- No automatic fallback.
- Failure must be explicit and user-visible.

### UI Display Format
- Node cards show both planned model and effective model.
- Divergence (override/failure path) must be obvious in card/inspector display.

### Audit and Logging Contract
- Full model routing trail required per node:
  - planned model
  - override source
  - fallback reason (if ever present)
  - final effective model

## Deferred Ideas
- None newly deferred in this phase discussion.

## Scope Guardrail
Phase 3 is limited to model metadata, per-node override, execution-time model application, and audit visibility. Run-mode auto-approval behavior remains Phase 4 scope.

---
*Captured on: 2026-05-08*
