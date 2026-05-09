# Phase 1 Research: Planned Graph and Approval Foundation

## Scope
- Phase: 1
- Requirements: `PLAN-01`, `APRV-01`
- Goal: prompt-to-plan graph must exist before child execution, and approvals must act as a hard gate.

## Existing Implementation Findings

### Approval Lifecycle and State
- `src/application/execution-controller.ts` already provides a central execution control with:
  - `waitForNodeApproval` integration point
  - `approveNode`, `skipNode`, cancellation path
  - node status updates and event publishing
- `src/domain/recursive-language-model.ts` uses `waitForNodeApproval` for nodes and transitions through `awaiting_approval`.

### UI and API Control Surface
- `src/application/control-server.ts` exposes node approval endpoint(s) and SSE events.
- `ui/src/main.tsx` renders node status and currently supports approval action from inspector.

### Planning vs Execution Semantics
- Current flow includes `planOnly` and execution graph metadata paths.
- Requirement gap for phase: explicit hard boundary that plan graph is emitted before child execution starts and approval gating cannot be bypassed accidentally.

## Gaps to Address in Phase 1
1. Hardening backend-authoritative approval state machine with single acceptance path for approvals.
2. Checkpoint concurrency safety (first-write-wins + stale/duplicate action behavior).
3. Explicit plan-graph-available-before-run behavior and guardrails in orchestration flow.
4. Uniform error surfacing for approval transition failures in CLI/UI.

## Recommended Build Strategy
1. Stabilize backend gate semantics in `execution-controller` and related domain calls.
2. Route all approval intents through one controller contract from both CLI/UI.
3. Tighten control-server handlers so they proxy controller decisions and return explicit errors.
4. Ensure UI reflects backend-confirmed state and failure details without optimistic divergence.
5. Add integration tests around:
  - plan graph emitted before execution
  - approval checkpoint hard stop
  - duplicate/stale approval handling
  - explicit failure status propagation

## Risks and Mitigations
- Risk: race conditions from concurrent approve actions.
  - Mitigation: version/token contract at checkpoint and idempotent action handling.
- Risk: UI appears approved while backend rejects.
  - Mitigation: backend-authoritative events; UI only transitions on backend event.
- Risk: silent failures in async event/update paths.
  - Mitigation: normalized error events and failed node/run statuses.

## Deliverables for Planning
- Two-wave plan split:
  - Wave 1: backend hard-gate and orchestration contracts
  - Wave 2: UI/control-server alignment + verification suite
