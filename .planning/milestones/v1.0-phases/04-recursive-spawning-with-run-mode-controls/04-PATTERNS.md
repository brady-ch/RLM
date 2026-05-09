---
phase: "04"
status: complete
created: 2026-05-09
---

# Phase 4 Pattern Map

## PATTERN MAPPING COMPLETE

## Files and Existing Analogs

| Target | Role | Closest Existing Pattern | Notes |
|--------|------|--------------------------|-------|
| `src/domain/types.ts` | Shared domain contract | Existing `ExecutionStatus`, `ExecutionGraphNode`, `ExecutionControl`, `NodeApprovalDecision` | Add approval-mode and approval-source fields here so CLI/API/UI share one contract. |
| `src/application/execution-controller.ts` | Backend authority for live graph and approvals | `waitForNodeApprovalInternal`, `approveNode`, `skipNode`, `stop`, `setNodeModelOverride` | Apply policy here. Preserve structured errors and token semantics. |
| `src/domain/recursive-language-model.ts` | Recursive graph registration and child spawning | `ensureExecutionNode`, `decompose`, `waitForNodeApproval`, `markExecutionNodeRunning` | Tag spawned children and emit observable approved/running transitions. |
| `src/cli/args.ts` | CLI flags and validation | Existing parse branches for `--require-approval`, `--plan-only`, `--approve`, `--json-stream` | Add `--approval-mode <full|initial-plan|initial-plan-recursive>` with explicit validation. |
| `src/index.ts` | Runtime composition | `createExecutionControl`, `createInteractiveExecutionSession`, require-approval rerun path | Pass approval mode through control creation and result metadata. Preserve `--require-approval` full mode. |
| `src/cli/render.ts` | CLI graph output | Existing per-node model trail lines | Add mode/branch policy summary and auto-approved node visibility. |
| `src/application/control-server.ts` | UI API proxy | Existing `/api/stop`, `/api/nodes/:id/approve`, mutation endpoints | Add endpoint to pause future auto-approvals and expose session mode in snapshots. |
| `ui/src/main.tsx` | Live graph UI | `ExecutionNodeCard`, `NodeInspector`, `App` status header | Render mode selector, auto-approved badges, and pause-future control from backend state. |
| `ui/src/styles.css` | UI status styling | `.status`, `.node-card.awaiting_approval` | Add badge and paused/auto-approved visual treatment. |
| `tests/recursive-language-model.test.ts` | Integration-style regression tests | Existing approval, mutation, model override, CLI parse tests | Add focused tests beside similar approval/model tests. |

## Concrete Patterns to Reuse

### Controller as authority

The controller already owns pending approval tokens and graph snapshot publication. New approval policy should live in this same class so UI/API/CLI consumers receive consistent state.

### Structured mutation failures

`MutationError` already carries `code`, `message`, `nodeIds`, `details`, and `suggestedFix`. Use this pattern for invalid approval mode, unsupported mode transitions, and invalid pause operations where applicable.

### Node metadata propagation

Phase 3 established the pattern of adding fields to `ExecutionGraphNode`, setting defaults in `registerNode`, updating metadata in `RecursiveLanguageModel`, and rendering the same fields in CLI/UI. Approval metadata should follow that path.

### Tests

Existing tests directly instantiate `InteractiveExecutionSession` and `RecursiveLanguageModel` with queue models. New tests should continue using those helpers to avoid broad fixture churn.

## Data Flow

1. CLI/UI selects approval mode before execution.
2. `index.ts` creates `ExecutionControl` or interactive session with that mode.
3. `RecursiveLanguageModel` registers root and spawned nodes with branch metadata.
4. `InteractiveExecutionSession.waitForNodeApprovalInternal` decides manual wait versus auto-approval.
5. Events and snapshots expose `approvalMode`, `approvalSource`, `approvalReason`, and paused state.
6. CLI render and UI node cards display the backend-confirmed state.

