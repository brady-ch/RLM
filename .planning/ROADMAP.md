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

- Developer launcher and local-folder plugin manager.
- Local Hugging Face GGUF model browser/installer with llama.cpp compatibility states.
- Release hardening: signed/reproducible single executable artifacts and platform release checks.
- Provider parity: deepen constrained tool-calling enforcement across non-Ollama hosts.
- Persistence/collaboration: durable graph edit history, interrupted-plan resume, or shared approval sessions if prioritized.
