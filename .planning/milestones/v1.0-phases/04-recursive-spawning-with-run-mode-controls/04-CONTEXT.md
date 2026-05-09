# Phase 4: Recursive Spawning with Run-Mode Controls - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Preserve recursive child-node spawning while making approval policy explicit, including full checkpoint approval, initial-plan-only auto-run, and a recursive auto-approval variant. Spawned node behavior must remain observable and controllable without weakening no-silent-failure guarantees.

</domain>

<decisions>
## Implementation Decisions

### Run Mode Contract
- **D-01:** Add approval modes as a first-class runtime concept, not a reinterpretation of existing `--require-approval` behavior.
- **D-02:** Preserve `--require-approval` as full checkpoint approval.
- **D-03:** Add a separate approval-mode surface for initial-plan-only behavior.
- **D-04:** The mode must be selectable from both CLI and UI before approval.
- **D-05:** User-facing labels are:
  - `Full checkpoints`
  - `Initial plan`
  - `Initial plan + recursive`
- **D-06:** CLI/config values should be stable machine-style values:
  - `full`
  - `initial-plan`
  - `initial-plan-recursive`

### Spawn Approval Inheritance
- **D-07:** In initial-plan modes, spawned nodes should still appear in the execution graph rather than running invisibly.
- **D-08:** Auto-approved spawned nodes must have an explicit auto-approved/approved state before running, so the graph and event stream show what happened.
- **D-09:** `initial-plan` is conservative: it auto-runs nodes from the initially approved graph, but pauses when recursion creates a new branch the user has not already seen.
- **D-10:** `initial-plan-recursive` is hands-off: it continues auto-approving newly spawned recursive branches unless a hard system risk occurs.
- **D-11:** Manual "pause future auto-approvals" should affect future nodes only. The current running node finishes unless the user uses stop/cancel.

### Observability During Auto-Run
- **D-12:** CLI should emit an event stream plus a final summary for spawned auto-approved nodes.
- **D-13:** UI should keep the live graph as the primary surface, with auto-approved badges/statuses on spawned node cards.
- **D-14:** Both CLI/API/UI should support stop and "pause future auto-approvals". Pausing future auto-approvals switches future spawned/ready nodes back to manual approval.

### Safety Boundaries
- **D-15:** Hard system risks must pause/fail visibly in both initial-plan modes:
  - model errors
  - tool errors
  - invalid graph state
  - budget exhaustion
  - cancellation
- **D-16:** Hard risks should not be silently converted into auto-approval or fallback behavior.
- **D-17:** `initial-plan` and `initial-plan-recursive` differ only on new recursive branch auto-approval. They share the same hard-risk handling.

### Plan-Only Behavior
- **D-18:** `--plan-only` should include selected approval mode and branch policy in metadata.
- **D-19:** `--plan-only` should not mark nodes with execution-like auto-approved statuses, because no execution is happening.
- **D-20:** `--plan-only` should validate invalid approval-mode values and conflicting settings, fail visibly, and avoid simulating execution.

### Testing Expectations
- **D-21:** Prioritize domain/controller behavior tests for approval policy inheritance, auto-approval, pause-future behavior, and branch-policy behavior.
- **D-22:** Phase 4 should also require cross-surface behavior coverage across domain/controller, CLI, and UI for the mode contract.

### the agent's Discretion
No user decisions were delegated to the agent. Planner may choose exact internal type names and file boundaries consistent with existing architecture.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and Phase Scope
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, and requirement mapping.
- `.planning/REQUIREMENTS.md` — `APRV-05`, `RECR-01`, and `RECR-02`.
- `.planning/PROJECT.md` — core value, constraints, existing validated requirements, and no-silent-failure posture.

### Prior Phase Decisions
- `.planning/phases/01-planned-graph-and-approval-foundation/01-CONTEXT.md` — backend-authoritative approval state machine and checkpoint semantics.
- `.planning/phases/02-interactive-graph-mutation-at-checkpoints/02-CONTEXT.md` — controller-only mutation boundary and structured mutation error contract.
- `.planning/phases/03-model-aware-node-planning-and-overrides/03-CONTEXT.md` — per-node model override scope, strict selected-model failure behavior, and model audit visibility.

### Implementation Surfaces
- `src/domain/types.ts` — execution graph, node status, execution control, and approval decision types.
- `src/domain/recursive-language-model.ts` — recursive spawning, node registration, approval waits, model calls, and execution metadata.
- `src/application/execution-controller.ts` — interactive session authority, approval token handling, mutation APIs, stop behavior, and graph snapshots.
- `src/application/control-server.ts` — HTTP/API control surface for UI actions.
- `src/cli/args.ts` — CLI flag parsing and help text.
- `src/index.ts` — composition of CLI/UI execution controls and plan-only / require-approval flows.
- `ui/src/main.tsx` — graph UI, node cards, inspector controls, model trail, stop action, and mutation controls.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ExecutionControl.waitForNodeApproval` already provides the central point where approval policy can be applied.
- `InteractiveExecutionSession` already owns approval tokens, node statuses, graph snapshots, stop behavior, and UI event publishing.
- `ExecutionGraphNode` already carries status and model metadata that can be extended or reused for auto-approved display.
- `--json-stream` / execution events already provide a path for CLI observability during long-running execution.
- The React UI already renders live graph nodes and node details through `ExecutionNodeCard` and `NodeInspector`.

### Established Patterns
- Backend/controller is authoritative for approval and mutation state.
- UI should render backend-confirmed graph state and send intents, not infer execution policy locally.
- Structured explicit failure is required; strict model-selection behavior from Phase 3 should remain intact.
- Config/CLI behavior flows through typed runtime config and argument parsing rather than ad hoc flags.

### Integration Points
- Add approval-mode fields to the runtime config/request/control path so domain execution and controller policy see the same mode.
- Extend node status or node metadata to distinguish auto-approved nodes from manually approved nodes without hiding normal execution state.
- Add API/UI controls for approval mode selection before approval and for pausing future auto-approvals during a run.
- Add plan-only metadata without mutating node execution statuses.

</code_context>

<specifics>
## Specific Ideas

- User wants three visible mode concepts: `Full checkpoints`, `Initial plan`, and `Initial plan + recursive`.
- User explicitly wants both conservative and hands-off behavior for new recursive branches.
- User wants pause-future behavior to avoid interrupting the current running node.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Recursive Spawning with Run-Mode Controls*
*Context gathered: 2026-05-09*
