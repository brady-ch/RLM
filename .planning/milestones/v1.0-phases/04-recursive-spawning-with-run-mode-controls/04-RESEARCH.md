---
phase: "04"
status: complete
created: 2026-05-09
requirements: ["RECR-01", "RECR-02", "APRV-05"]
---

# Phase 4 Research: Recursive Spawning with Run-Mode Controls

## RESEARCH COMPLETE

## Executive Summary

Phase 4 should be implemented by extending the existing backend-authoritative execution control path, not by adding UI-side approval inference or a second execution mode. The central leverage points are:

- `src/domain/types.ts` for the approval mode contract and graph/event metadata.
- `src/application/execution-controller.ts` for approval policy, token resolution, auto-approval state, and pause-future behavior.
- `src/domain/recursive-language-model.ts` for tagging initially planned nodes versus recursively spawned nodes.
- `src/cli/args.ts`, `src/index.ts`, and `src/cli/render.ts` for CLI/config/plan-only/json-stream behavior.
- `src/application/control-server.ts` and `ui/src/main.tsx` for UI mode selection, auto-approved badges, and pause-future controls.
- `tests/recursive-language-model.test.ts` for regression coverage across domain/controller, CLI parsing, API, rendering, and UI metadata contracts.

## Current Architecture Findings

### Approval Flow

`RecursiveLanguageModel.waitForNodeApproval` calls `execution.waitForNodeApproval` whenever execution control provides it. The interactive UI path provides that hook through `InteractiveExecutionSession.control`; non-UI CLI control created by `createExecutionControl` currently has no `waitForNodeApproval`, so runs proceed without per-node waiting.

`InteractiveExecutionSession.waitForNodeApprovalInternal` currently:

- registers or updates the node,
- creates an approval token,
- sets status to `awaiting_approval`,
- returns a promise that resolves through `approveNode`, `skipNode`, or `stop`.

This is the right place to apply `full`, `initial-plan`, and `initial-plan-recursive` behavior because it already owns tokens, node status, graph snapshots, and event publication.

### Recursive Spawning

`RecursiveLanguageModel.decompose` creates child `TaskNode` values, calls `ensureExecutionNode` for each child, and records parent-child edges. Children are created during execution, after the root/depth-selector planning step has already started. That means the executor needs metadata distinguishing nodes that were visible in the initially approved graph from nodes spawned later by recursion.

The current plan-only path returns immediately after creating the root and depth selector metadata. It does not run decomposition, so plan-only can report approval mode and branch policy but must not mark any node with execution-like auto-approved status.

### Observability

`ExecutionGraphNode` already carries status, timestamps, prompt, model trail, parent edges, and editable fields. `ExecutionEvent` already supports status, nodeId, budget fields, and message. Adding explicit approval-mode and approval-source metadata to these types keeps CLI/API/UI surfaces consistent.

The React UI renders live graph nodes from `/api/session` and updates from `/api/events`. It should render backend-confirmed `approvalMode`, `approvalSource`, and `autoApprovalPaused` state rather than deriving policy locally.

## Recommended Design

### Approval Mode Contract

Add stable runtime values:

- `full`
- `initial-plan`
- `initial-plan-recursive`

Add user-facing labels:

- `Full checkpoints`
- `Initial plan`
- `Initial plan + recursive`

Represent the branch policy explicitly:

- `full`: every checkpoint waits for manual approval.
- `initial-plan`: nodes in the initially approved graph can auto-run after initial acceptance; newly spawned recursive branches pause.
- `initial-plan-recursive`: nodes in the initially approved graph and newly spawned recursive branches auto-approve unless a hard-risk condition occurs.

### Node Approval Metadata

Add metadata rather than overloading the existing status alone:

- `approvalMode?: ApprovalMode`
- `approvalSource?: "manual" | "auto" | "none"`
- `approvalReason?: string`
- `autoApprovalPaused?: boolean`
- `spawnedAfterInitialApproval?: boolean`

Use status transitions for observability:

- Full mode: `awaiting_approval` -> `approved` -> `running`.
- Auto-approved mode: `ready` or `awaiting_approval` -> `approved` with `approvalSource: "auto"` and a descriptive event -> `running`.

The UI can show an "auto-approved" badge from `approvalSource === "auto"` without adding a separate terminal status that would complicate existing status handling.

### Initial Graph Boundary

The `initial-plan` distinction needs a deterministic boundary. The clean approach is:

- `RecursiveLanguageModel` marks nodes created before the first accepted approval boundary as `spawnedAfterInitialApproval: false`.
- Nodes created by later `decompose` calls after the approval boundary are marked `spawnedAfterInitialApproval: true`.
- `InteractiveExecutionSession` uses that flag to decide whether `initial-plan` can auto-approve a node.

If the current plan-only path does not fully expand the graph, Phase 4 should still make the metadata explicit and test recursive child creation during actual execution, not simulate execution in plan-only.

### Pause Future Auto-Approvals

Add `pauseFutureAutoApprovals()` on the session/controller and expose it through `ExecutionControl`. It should:

- set an internal `autoApprovalPaused` flag,
- publish an event with status `approved` or `ready` and message `future auto-approvals paused`,
- affect only future calls to `waitForNodeApprovalInternal`,
- not cancel or mutate the current running node.

Once paused, future nodes use manual approval regardless of `initial-plan` or `initial-plan-recursive`.

### Hard-Risk Handling

Hard risks must remain explicit failures or pauses:

- model errors,
- tool errors,
- invalid graph state,
- budget exhaustion,
- cancellation.

The approval-mode policy should only decide whether a node can proceed past an approval checkpoint. It must not catch and convert model/tool/runtime errors into auto-approval success. Existing error paths in model completion, tool handling, budget recording, and cancellation should be preserved and tested.

## Validation Architecture

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node built-in test runner |
| Config file | `tsconfig.json` |
| Quick run command | `npm run build` |
| Full suite command | `npm test` |
| Estimated runtime | ~30 seconds |

## Sampling Strategy

- Run `npm run build` after backend type changes.
- Run `npm test` after each plan file is completed.
- Add focused tests near existing approval/model tests in `tests/recursive-language-model.test.ts`.
- Use CLI parser/render tests for `--approval-mode`, `--plan-only`, and JSON output behavior.
- Use control-server tests or direct session tests for pause-future and API behavior.

## Required Regression Cases

| Behavior | Requirement | Automated Coverage |
|----------|-------------|--------------------|
| `--require-approval` preserves full checkpoint behavior | APRV-05 | CLI parse + interactive session test |
| `initial-plan` auto-approves initially approved graph nodes but pauses new recursive branches | APRV-05, RECR-02 | domain/controller test with recursive child creation |
| `initial-plan-recursive` auto-approves spawned branches | APRV-05, RECR-01, RECR-02 | domain/controller recursive execution test |
| Auto-approved nodes appear in graph/events before running | RECR-02 | session event and graph snapshot assertions |
| Pause future auto-approvals affects future nodes only | APRV-05, RECR-02 | session test with current running node and later child |
| Plan-only reports approval mode and branch policy without execution statuses | APRV-05 | CLI/render metadata test |
| Invalid approval mode fails visibly | APRV-05 | CLI parser test |
| Hard risks are not converted into auto-approval | RECR-02 | model/tool/budget/cancellation error tests |

## Implementation Pitfalls

- Do not infer run mode in the UI. The backend must remain authoritative.
- Do not make `--require-approval` mean initial-plan mode; preserve it as full checkpoints.
- Do not use `planOnly` to simulate execution state. It may include mode metadata only.
- Do not skip event emission for auto-approved nodes. D-08 and D-12 require observability.
- Do not pause or cancel the current running node when the user pauses future auto-approvals.
- Do not allow invalid approval-mode values to fall back to `full`; fail visibly.

