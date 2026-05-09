# Recursive Language Model CLI

## What This Is

A local recursive language model CLI and UI workflow system for developers in this repo. It accepts a prompt, plans a node graph for recursive execution, lets users review and modify that graph at approval checkpoints, and then runs the AI workflow through to completion with visible execution state. It is intended to support model-aware orchestration where different nodes can run on different models, including final-format handoff nodes.

## Core Value

Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## Requirements

### Validated

- ✓ CLI prompt execution and recursive orchestration engine exist — existing
- ✓ Interactive execution graph and node inspection UI plumbing exist — existing
- ✓ Config-driven model tier routing and agent/workflow configuration exist — existing
- ✓ Tool adapters for shell, file write, web search, and web fetch exist — existing
- ✓ User can submit a prompt and receive a planning node graph before execution — Phase 1
- ✓ Approval checkpoints are backend-authoritative with explicit stale/duplicate handling — Phase 1
- ✓ Checkpoint graph mutations (edit/add/delete/connect) are controller-authoritative and in-memory — Phase 2
- ✓ Mutation validation failures are explicit and structured for UI/CLI handling — Phase 2
- ✓ Planned/effective model metadata is captured and surfaced per node — Phase 3
- ✓ Per-node model overrides at checkpoints route execution model selection — Phase 3
- ✓ Explicit selected-model failures are strict and user-visible (no silent fallback) — Phase 3
- ✓ Recursive execution can spawn downstream nodes while honoring approval/run-mode policy — Phase 4
- ✓ Runtime failures are visible across UI/CLI with aligned vocabulary and non-zero CLI exit on failure — Phase 5

### Active

- [x] User can submit a prompt and receive a planning node graph before execution.
- [x] Execution pauses at every approval checkpoint and allows node edit/delete/add before continuing.
- [x] Each node card displays the model planned for that node.
- [x] Planning can assign model per downstream node, including final-node handoff to a different model.
- [x] User can override node model assignments before execution resumes.
- [x] User can enable an override mode that requires only initial-plan approval and then runs without further approvals.
- [x] Recursive execution can spawn additional agents/nodes when needed while respecting approval/override behavior.
- [x] Failures are always surfaced to the user (UI and/or CLI) with no silent failure paths.

### Out of Scope

- Persisting manual graph edits/additions/deletions across process restarts (v1 is in-memory only) — deferred to a later phase after approval/edit flow stabilizes.
- Multi-user collaboration or shared remote approval sessions — not required for repo-local developer v1.

## Context

The repository already has a layered architecture (`src/application`, `src/domain`, `src/ports`, `src/adapters`) and an existing React UI execution surface in `ui/` that subscribes to runtime execution events. Interactive approval/control infrastructure in `src/application/execution-controller.ts` and `src/application/control-server.ts` is now aligned with v1 expectations for plan-first execution, checkpoint editing, model-aware routing, recursive spawning policy, and explicit failure surfacing. The product target is any developer using this repository locally, with a strong emphasis on transparent model routing between nodes and explicit failure visibility.

## Constraints

- **Tech stack**: Continue using TypeScript/Node + existing React/Vite UI architecture — minimize disruption to current repo boundaries.
- **Runtime mode**: Keep recursive agent behavior and dynamic node spawning — core product behavior depends on it.
- **State scope (v1)**: Node edits are in-memory per run — chosen to reduce initial complexity.
- **Observability**: No silent failures — all errors must be surfaced in CLI/UI states.
- **Compatibility**: Changes must preserve existing CLI workflows (`--plan-only`, `--require-approval`, workflow execution).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Approval checkpoints allow edit/delete/add actions before continuing | Needed for human-in-the-loop control over recursive execution plans | Shipped in v1.0 |
| Show planned model directly on each node card | Model choice is a first-class execution concern, including cross-model handoff | Shipped in v1.0 |
| v1 graph edits remain in-memory | Faster path to stable approval flow; avoids persistence/versioning complexity initially | Shipped in v1.0 |
| Add override mode: approve initial plan only, then auto-run | Maintains safety at planning boundary while reducing interaction overhead | Shipped in v1.0 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-08 after v1.0 milestone completion*
