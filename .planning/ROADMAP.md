# Roadmap: Recursive Language Model CLI

## Milestones

- ✅ **v1.5 Dynamic Graph Authoring** — Phases 30-35 (shipped 2026-05-22; archive: `.planning/milestones/v1.5-ROADMAP.md`)
- ✅ **v1.4 Session Memory** — Phases 25-29, 29.1 (shipped 2026-05-21; archive: `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.3 Desktop Product** — Phases 21-24 (shipped 2026-05-21; archive: `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.2 Answer Quality Loops** — Phases 12-17 (shipped 2026-05-20; archive: `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.1 Interop, chat-first, plugins, constrained tools** — Phases 6-11, including inserted Phase 8.5 (shipped 2026-05-13; archive: `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-08; archive: `.planning/milestones/v1.0-ROADMAP.md`)

## Overview

v1.5 shipped graph-primary authoring: model-driven plan-from-node, protected replan UX, planner-assigned expert teams with visible overrides, a shared graph executor for topology-aware runs, lossless `kind: graph` workflow sidecars, and UI/CLI/session integration hardening.

Next milestone planning starts with `/gsd-new-milestone`.

## Phases

**Phase Numbering:**
- Phase numbers continue from v1.5 (last phase: 35).
- Next milestone picks up at phase 36.

<details>
<summary>✅ v1.5 Dynamic Graph Authoring (Phases 30-35) — SHIPPED 2026-05-22</summary>

See `.planning/milestones/v1.5-ROADMAP.md`, `.planning/milestones/v1.5-REQUIREMENTS.md`, and `.planning/milestones/v1.5-MILESTONE-AUDIT.md`.

- [x] **Phase 30: Plan-from-Node Foundation** — Model-driven child planning from any node with root-composer default and explicit failure states (5/5 plans).
- [x] **Phase 31: Protected Replan UX** — Replace/Merge/Cancel gate when protected descendants exist on parent replan (3/3 plans).
- [x] **Phase 32: Expert Team Binding** — Planner-assigned expert presets, inspector overrides, and execution-time allowlist enforcement (3/3 plans).
- [x] **Phase 33: Graph Execution Loop** — Shared graph executor walks approved topology with per-node expert binding and visible runtime modes (3/3 plans).
- [x] **Phase 34: Graph Workflow Export/Import** — Lossless `kind: graph` sidecars with playbook/pipeline variants and frozen replay (3/3 plans).
- [x] **Phase 35: Integration Hardening** — UI/CLI parity, graph-primary UX default, and session save/reopen for new fields (1/1 plan).

</details>

<details>
<summary>✅ v1.4 Session Memory (Phases 25-29, 29.1) — SHIPPED 2026-05-21</summary>

See `.planning/milestones/v1.4-ROADMAP.md`, `.planning/milestones/v1.4-REQUIREMENTS.md`, and `.planning/milestones/v1.4-MILESTONE-AUDIT.md`.

</details>

<details>
<summary>✅ v1.3 Desktop Product (Phases 21-24) — SHIPPED 2026-05-21</summary>

See `.planning/milestones/v1.3-ROADMAP.md` and `.planning/milestones/v1.3-REQUIREMENTS.md`.

</details>

## Candidate Future Themes

- Product shell convergence: guided composer for first-run/new-workflow, graph workspace as primary surface, and project/session launcher for durable resume.
- Multi-runner adapters beyond bundled Ollama: llama.cpp, vLLM, or cloud APIs.
- Release hardening: signed/reproducible artifacts, Windows/macOS package builds, GUI clean-machine smoke, and auto-update channel.
- Developer launcher and local-folder plugin manager.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 30-35 Dynamic Graph Authoring | v1.5 | 18/18 | Complete | 2026-05-22 |
| 25-29, 29.1 Session Memory | v1.4 | 6/6 | Complete | 2026-05-21 |
| 21-24 Desktop Product | v1.3 | archived | Complete | 2026-05-21 |
| 12-17 Answer Quality Loops | v1.2 | archived | Complete | 2026-05-20 |
| 6-11 Interop / plugins | v1.1 | archived | Complete | 2026-05-13 |
| 1-5 MVP | v1.0 | archived | Complete | 2026-05-08 |
