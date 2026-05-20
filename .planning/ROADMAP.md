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
- Save graph as fixed workflow (explore A; seed: `.planning/seeds/save-graph-as-workflow.md`).
- Expert team + per-agent constrained tool suites (explore C).

## Proposed Phase 18: Dynamic Graph Authoring (plan-from-node)

**Goal:** Make intent → recursive execution graph the default, easy path: empty root → submit → edit by resubmitting nodes → run when ready.

**Requirements:** `.planning/REQUIREMENTS.md` (`PLAN-01` … `PLAN-07`)

**Design note:** `.planning/notes/node-centric-dynamic-planning.md`

**Scope (in):**

- Always seed `root-composer`; node **Submit** triggers model-driven `planNode` (not separate Plan-only heuristics for default flows).
- Child submit expands branches; parent replan with conditional dialog (pristine = silent; protected = Replace / Merge / Cancel).
- API + UI alignment with existing approval, plan budget, and `pendingPlan` flows.

**Scope (out):**

- Workflow YAML export (follow-on seed / later phase).
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
