# Roadmap: Recursive Language Model CLI

## Milestones

- ✅ **v1.2 Answer Quality Loops** — Phases 12-17 (shipped 2026-05-20; archive: `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.1 Interop, chat-first, plugins, constrained tools** — Phases 6-11, including inserted Phase 8.5 (shipped 2026-05-13; archive: `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-08; archive: `.planning/milestones/v1.0-ROADMAP.md`)

## Current Status

No active milestone is selected. Start the next milestone with `$gsd-new-milestone` when ready.

## Shipped Milestones

<details>
<summary>✅ v1.2 Answer Quality Loops (Phases 12-17) — SHIPPED 2026-05-20</summary>

- [x] Phase 12: Loop Runtime Contract (2/2 plans) — completed 2026-05-17
- [x] Phase 13: Rubric and Evaluator Contract (3/3 plans) — completed 2026-05-18
- [x] Phase 14: Refine and Best-of-Progress Engine (1/1 plan) — completed 2026-05-18
- [x] Phase 15: Loop Phase Model Routing and Overrides (1/1 plan) — completed 2026-05-18
- [x] Phase 16: Inspectable UI, CLI, and Human Loop Control (1/1 plan) — completed 2026-05-19
- [x] Phase 17: Quality Verification and Regression Harness (1/1 plan) — completed 2026-05-20

Audit: `.planning/milestones/v1.2-MILESTONE-AUDIT.md`
Requirements: `.planning/milestones/v1.2-REQUIREMENTS.md`
Phase artifacts: `.planning/phases/` until cleanup is run.

</details>

<details>
<summary>✅ v1.1 Interop, chat-first, plugins, constrained tools (Phases 6-11) — SHIPPED 2026-05-13</summary>

See `.planning/milestones/v1.1-ROADMAP.md` and `.planning/milestones/v1.1-phases/`.

</details>

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-05-08</summary>

See `.planning/milestones/v1.0-ROADMAP.md` and `.planning/milestones/v1.0-phases/`.

</details>

## Candidate Next-Milestone Themes

- **Dynamic graph authoring (plan-from-node)** — see Proposed Phase 18 below; primary UX for describe → graph → run (explore B).
- Developer launcher and local-folder plugin manager.
- Local Hugging Face GGUF model browser/installer with llama.cpp compatibility states.
- Release hardening: signed/reproducible single executable artifacts and platform release checks.
- Provider parity: deepen constrained tool-calling enforcement across non-Ollama hosts.
- Persistence/collaboration: durable graph edit history, interrupted-plan resume, or shared approval sessions if prioritized.
- Save graph as fixed workflow — see **Proposed Phase 19** (explore A; `.planning/notes/graph-workflow-export.md`).
- Expert team — see **Proposed Phase 20** (explore C; `.planning/notes/expert-team-architecture.md`).

## Proposed Phase 18: Dynamic Graph Authoring (plan-from-node)

**Goal:** Make intent → recursive execution graph the default, easy path: empty root → submit → edit by resubmitting nodes → run when ready.

**Requirements:** `.planning/REQUIREMENTS.md` (`PLAN-01` … `PLAN-07`)

**Design note:** `.planning/notes/node-centric-dynamic-planning.md`

**Scope (in):**

- Always seed `root-composer`; node **Submit** triggers model-driven `planNode` (not separate Plan-only heuristics for default flows).
- Child submit expands branches; parent replan with conditional dialog (pristine = silent; protected = Replace / Merge / Cancel).
- API + UI alignment with existing approval, plan budget, and `pendingPlan` flows.

**Scope (out):**

- Graph workflow export & replay (Phase 19).
- Expert team node assignment (Phase 20).
- HF installer, multi-server catalog, temperature controls in UI.
- Replacing runtime recursion in `RecursiveLanguageModel` — graph planning is authoring-time; execution-time recursion unchanged unless explicitly linked.

**Success criteria:**

- New user can open UI, type goal in root, submit, see a multi-node planned graph, edit a child and resubmit parent with merge dialog when protected, approve, and run without reading docs.
- Tests cover pristine parent replan, protected merge/replace/cancel, and planner failure visibility.

**Depends on:** v1.2 graph/composer/approval foundation (shipped).

**Suggested plans (for `$gsd-plan-phase`):**

1. Session bootstrap + submit UX (empty root, unified submit API).
2. Model-driven planner adapter + budget integration.
3. Replan gating (protected detection, Replace / Merge / Cancel).
4. UI polish + regression tests.

## Proposed Phase 19: Graph Workflow Export & Replay

**Goal:** Freeze an approved graph as **playbook** and/or **pipeline** variants; run headlessly or from UI without replan; import back for edits.

**Requirements:** `.planning/REQUIREMENTS.md` (`EXPORT-01` … `EXPORT-07`)

**Design note:** `.planning/notes/graph-workflow-export.md`

**Depends on:** Phase 18 (stable plan-from-node graphs and node metadata).

**Scope (in):**

- `kind: graph` sidecar under `.rlm/workflows/` (+ optional `rlm.config.yaml` pointer).
- Save dialog: Playbook / Pipeline / Both (default Both).
- Graph executor: topological run, literal vs `{{input}}` substitution, smart variant default + override.
- Import → `InteractiveExecutionSession`; CLI `rlm --workflow <id>` for graph kind.

**Scope (out):**

- Lossy export to agent-list `workflows.*` only.
- n8n scheduling, triggers, credentials.
- Per-node template flags beyond root (defer unless needed in v1).

**Success criteria:**

- User saves Both from UI, runs pipeline with new CLI prompt and playbook without prompt; variant shown in output.
- Import → edit one node prompt → re-export preserves topology.
- Tests: playbook literal replay, pipeline substitution, variant override, missing agent failure.

**Suggested plans (for `$gsd-plan-phase`):**

1. Graph workflow file schema + snapshot/export from session.
2. Save/import API and UI dialog.
3. `runGraphWorkflow` executor + CLI wiring + smart variant default.
4. Round-trip and failure-path tests.

## Proposed Phase 20: Expert Team & Node Assignment

**Goal:** Graph nodes run as **visible experts** (small-model presets, tool allowlists, tier maps) with planner assignment, user override, and plan-time RLM for high-complexity nodes.

**Requirements:** `.planning/REQUIREMENTS.md` (`TEAM-01` … `TEAM-08`)

**Design note:** `.planning/notes/expert-team-architecture.md`

**Depends on:** Phase 18 (planner + node metadata); Phase 19 should include expert fields in export (TEAM-08 may ship with 19 or 20).

**Scope (in):**

- Planner emits `agentId`, complexity, `runtime: single | rlm` per node.
- UI: Expert preset + custom badge when tools/tiers diverge; overrides protected for replan.
- Execution: constrained tools per node allowlist; purpose routing from expert config.
- Allowlist-only tools (no new role-specific adapters in v1).

**Scope (out):**

- Specialized tool surfaces (seed: `.planning/seeds/specialized-tool-surfaces.md`).
- UI for creating new expert presets (YAML edit OK for v1).
- Silent runtime complexity escalation.

**Success criteria:**

- Planned graph shows expert per node; user switches one node to Custom tools; approve + run respects allowlist.
- High-complexity node marked RLM at plan time runs recursive path with same expert policy; trace shows mode.
- Export/import preserves expert + custom + runtime fields.

**Suggested plans (for `$gsd-plan-phase`):**

1. Node schema + planner output (`agentId`, `runtime`, `assignmentMode`).
2. Execution binding (tools + tiers + RLM per node).
3. UI expert/custom inspector.
4. Tests + EXPORT field alignment with Phase 19.
