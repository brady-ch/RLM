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

### Active

- [ ] User can submit a prompt and receive a planning node graph before execution.
- [ ] Execution pauses at every approval checkpoint and allows node edit/delete/add before continuing.
- [ ] Each node card displays the model planned for that node.
- [ ] Planning can assign model per downstream node, including final-node handoff to a different model.
- [ ] User can override node model assignments before execution resumes.
- [ ] User can enable an override mode that requires only initial-plan approval and then runs without further approvals.
- [ ] Recursive execution can spawn additional agents/nodes when needed while respecting approval/override behavior.
- [ ] Failures are always surfaced to the user (UI and/or CLI) with no silent failure paths.

### Out of Scope

- Persisting manual graph edits/additions/deletions across process restarts (v1 is in-memory only) — deferred to a later phase after approval/edit flow stabilizes.
- Multi-user collaboration or shared remote approval sessions — not required for repo-local developer v1.

## Context

The repository already has a layered architecture (`src/application`, `src/domain`, `src/ports`, `src/adapters`) and an existing React UI execution surface in `ui/` that subscribes to runtime execution events. There is existing interactive approval/control infrastructure in `src/application/execution-controller.ts` and `src/application/control-server.ts`, but current behavior does not meet expectations for robust approval gating in UI. The product target is any developer using this repository locally, with a strong emphasis on transparent model routing between nodes and explicit failure visibility.

## Constraints

- **Tech stack**: Continue using TypeScript/Node + existing React/Vite UI architecture — minimize disruption to current repo boundaries.
- **Runtime mode**: Keep recursive agent behavior and dynamic node spawning — core product behavior depends on it.
- **State scope (v1)**: Node edits are in-memory per run — chosen to reduce initial complexity.
- **Observability**: No silent failures — all errors must be surfaced in CLI/UI states.
- **Compatibility**: Changes must preserve existing CLI workflows (`--plan-only`, `--require-approval`, workflow execution).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Approval checkpoints allow edit/delete/add actions before continuing | Needed for human-in-the-loop control over recursive execution plans | — Pending |
| Show planned model directly on each node card | Model choice is a first-class execution concern, including cross-model handoff | — Pending |
| v1 graph edits remain in-memory | Faster path to stable approval flow; avoids persistence/versioning complexity initially | — Pending |
| Add override mode: approve initial plan only, then auto-run | Maintains safety at planning boundary while reducing interaction overhead | — Pending |

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
*Last updated: 2026-05-08 after initialization*
