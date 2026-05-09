# Discussion Log: Phase 1

## Session
- Phase: 1
- Name: Planned Graph and Approval Foundation
- Date: 2026-05-08

## Area Discussed
### Approval state machine boundary

1. Boundary model selected:
- Option chosen: Backend-authoritative
- Outcome: `execution-controller` is sole state authority.

2. Command routing selected:
- Option chosen: One controller API only
- Outcome: CLI and UI both invoke shared controller methods; no direct shortcut path.

3. Concurrency policy selected:
- Option chosen: First-write-wins with idempotent tokens
- Outcome: duplicate actions no-op, stale actions rejected with explicit error.

## Locked For Planning
- Backend state authority is non-negotiable for this phase.
- Approval actions converge through one API contract.
- Checkpoint actions require token/version semantics to avoid race ambiguity.

## Deferred
- None.
