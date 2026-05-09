# Phase 4: Recursive Spawning with Run-Mode Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 4-Recursive Spawning with Run-Mode Controls
**Areas discussed:** Run Mode Contract, Spawn Approval Inheritance, Observability During Auto-Run, Safety Boundaries, Naming and UX Copy, Plan-Only Behavior, Testing Expectations

---

## Run Mode Contract

| Option | Description | Selected |
|--------|-------------|----------|
| CLI flag + UI toggle | Add a CLI flag for scripted runs and a UI toggle before approval. | ✓ |
| CLI flag only | Simpler implementation, but UI users would need to restart with the right flag. | |
| Config option only | Good for persistent defaults, but less obvious at the moment of approval. | |
| You decide | Planner chooses smallest coherent surface preserving current behavior. | |

**User's choice:** CLI flag + UI toggle.
**Notes:** Existing `--require-approval` should remain full checkpoint approval. Add a separate approval-mode flag rather than changing `--approve` semantics.

---

## Spawn Approval Inheritance

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-approve spawned nodes but show them | New nodes enter the graph with explicit approved/auto-approved state and then run. | ✓ |
| Run spawned nodes immediately with no approval state | Simplest runtime behavior, but less transparent. | |
| Pause only when spawned nodes differ materially from the approved plan | Safer in theory, but fuzzy and edge-case-heavy. | |
| You decide | Planner prioritizes deterministic semantics. | |

**User's choice:** Auto-approve spawned nodes but show them.
**Notes:** User also chose a manual pause control for future spawned nodes. Current running node should finish unless the user stops/cancels.

---

## New Recursive Branch Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Conservative initial-plan mode | Auto-run initially approved graph, pause on newly created recursive branches. | ✓ |
| Hands-off recursive mode | Continue auto-approving newly spawned recursive branches unless a hard risk occurs. | ✓ |
| Single behavior only | Choose either conservative or hands-off globally. | |

**User's choice:** Provide both conservative and hands-off variants.
**Notes:** This became the distinction between `initial-plan` and `initial-plan-recursive`.

---

## Observability During Auto-Run

| Option | Description | Selected |
|--------|-------------|----------|
| Event stream + final summary | Emit node registered/auto-approved/running/completed events, then summarize counts and failures. | ✓ |
| Final summary only | Less noisy, but less transparent. | |
| Graph JSON only with `--json-stream` | Good for tooling, weaker for normal terminal users. | |
| You decide | Planner preserves current render style. | |

**User's choice:** Event stream + final summary.
**Notes:** UI should keep the live graph as primary surface and show auto-approved badges/statuses on node cards. CLI/API/UI should support stop and pause-future-auto-approvals.

---

## Safety Boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| Only explicit system risks | Pause/fail on model/tool errors, invalid graph state, budget exhaustion, or cancellation. | ✓ |
| Any new recursive branch | Pause whenever recursion expands beyond the initial graph. | ✓ |
| Tool calls and model overrides | Pause when spawned node wants tools or differs from initial model assignment. | |
| You decide | Planner chooses minimal hard-stop cases. | |

**User's choice:** Hard system risks always pause/fail visibly, and conservative mode pauses on new recursive branches.
**Notes:** User clarified they want one mode that pauses on new recursive branches and one mode that does not.

---

## Naming and UX Copy

| Option | Description | Selected |
|--------|-------------|----------|
| Full checkpoints / Initial plan / Initial plan + recursive | Clear and plain, maps directly to behavior. | ✓ |
| Manual / Auto after plan / Auto recursive | Shorter, less explicit about checkpoints. | |
| Review every node / Review initial graph / Review initial graph then run all | Very explicit, longer labels. | |
| You decide | Planner chooses labels fitting existing style. | |

**User's choice:** Full checkpoints / Initial plan / Initial plan + recursive.
**Notes:** CLI/config values should be `full`, `initial-plan`, and `initial-plan-recursive`.

---

## Plan-Only Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Mode metadata only | Include selected approval mode and branch policy in metadata, but no auto-approved statuses. | ✓ |
| Preview statuses | Mark which nodes would be manual vs auto-approved if executed. | |
| No approval-mode output | Keep plan-only as pure graph. | |
| You decide | Planner keeps output consistent with execution metadata. | |

**User's choice:** Mode metadata only.
**Notes:** `--plan-only` should validate invalid approval-mode values and conflicting settings, fail visibly, and avoid simulating execution.

---

## Testing Expectations

| Option | Description | Selected |
|--------|-------------|----------|
| Domain/controller tests first | Prove policy inheritance, auto-approval, pause-future, and branch policy behavior. | ✓ |
| CLI tests first | Prove flags/config parsing, plan-only metadata, and terminal output. | |
| UI tests first | Prove toggle labels, badges, and stop/pause controls. | |
| All of the above | Cover full mode contract across domain/controller, CLI, and UI. | ✓ |

**User's choice:** Domain/controller first, with full cross-surface behavior coverage required for Phase 4.
**Notes:** Coverage should be focused on behavior rather than broad snapshots.

---

## the agent's Discretion

No decisions were delegated to the agent.

## Deferred Ideas

None.
