# Roadmap: Recursive Language Model CLI

## Milestones

- 📋 **Next milestone** — requirements and phase plan TBD (start with `/gsd-new-milestone`)
- ✅ **v1.6 Architecture Cleanup** — Phases 36-42 (shipped 2026-05-22; archive: `.planning/milestones/v1.6-ROADMAP.md`)
- ✅ **v1.5 Dynamic Graph Authoring** — Phases 30-35 (shipped 2026-05-22; archive: `.planning/milestones/v1.5-ROADMAP.md`)
- ✅ **v1.4 Session Memory** — Phases 25-29, 29.1 (shipped 2026-05-21; archive: `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.3 Desktop Product** — Phases 21-24 (shipped 2026-05-21; archive: `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.2 Answer Quality Loops** — Phases 12-17 (shipped 2026-05-20; archive: `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.1 Interop, chat-first, plugins, constrained tools** — Phases 6-11, including inserted Phase 8.5 (shipped 2026-05-13; archive: `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-08; archive: `.planning/milestones/v1.0-ROADMAP.md`)

## Overview

**v1.6 (shipped 2026-05-22)** was a behavior-preserving architecture cleanup: ESLint/Prettier/dependency-cruiser guardrails and expanded `npm run check`; focused `application/config/` modules behind a stable facade; `buildRuntimeContext()` bootstrap with slim `src/index.ts` and `cli/run-modes/*`; adapters grouped under `adapters/tools|persistence|models/`; `domain/recursion/` concern modules with orchestrator retaining flow; control-server handlers colocated by surface; tests reorganized under `tests/domain/recursion/` with shared helpers and an updated `AGENTS.md`.

Full phase narratives, plans, progress table snapshot, and **archived REQUIREMENTS traceability** live under `.planning/milestones/v1.6-ROADMAP.md` and `.planning/milestones/v1.6-REQUIREMENTS.md`.

**Next cycle:** Capture product goals and phase breakdown for **v1.7+** via `/gsd-new-milestone` before editing this roadmap’s active section.

## Phases

<details>
<summary>✅ v1.6 Architecture Cleanup (Phases 36-42) — SHIPPED 2026-05-22</summary>

See `.planning/milestones/v1.6-ROADMAP.md`, `.planning/milestones/v1.6-REQUIREMENTS.md`, and `.planning/milestones/v1.6-MILESTONE-AUDIT.md`.

- [x] **Phase 36: Dev Tooling Guardrails** — ESLint, Prettier, dependency-cruiser baselines and expanded `npm run check` (2/2 plans) — 2026-05-22
- [x] **Phase 37: Config Layer Split** — Focused `application/config/` modules with barrel facade and unit tests (3/3 plans) — 2026-05-22
- [x] **Phase 38: Runtime Bootstrap** — `RuntimeContext`, `buildRuntimeContext()`, slim `index.ts`, and `cli/run-modes/*` (2/2 plans) — 2026-05-22
- [x] **Phase 39: Adapters & Tools Taxonomy** — Tools, persistence, and model adapters grouped by concern (1/1 plan) — 2026-05-22
- [x] **Phase 40: Domain Engine Decomposition** — `domain/recursion/` concern modules; orchestrator retains top-level recursion flow (5/5 plans) — 2026-05-22
- [x] **Phase 41: Control-Server Boundary** — Handler modules with bootstrap-injected dependencies; transport-only routes (1/1 plan) — 2026-05-22
- [x] **Phase 42: Test Restructure & Docs** — Subsystem-aligned tests, shared helpers, updated `AGENTS.md` contributor map (1/1 plan) — 2026-05-22

</details>

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

### Next milestone (not started)

_Phases for the next shipped version will be listed here after `/gsd-new-milestone`._

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 36. Dev Tooling Guardrails | v1.6 | 2/2 | Complete | 2026-05-22 |
| 37. Config Layer Split | v1.6 | 3/3 | Complete | 2026-05-22 |
| 38. Runtime Bootstrap | v1.6 | 2/2 | Complete | 2026-05-22 |
| 39. Adapters & Tools Taxonomy | v1.6 | 1/1 | Complete | 2026-05-22 |
| 40. Domain Engine Decomposition | v1.6 | 5/5 | Complete | 2026-05-22 |
| 41. Control-Server Boundary | v1.6 | 1/1 | Complete | 2026-05-22 |
| 42. Test Restructure & Docs | v1.6 | 1/1 | Complete | 2026-05-22 |
| 30-35 Dynamic Graph Authoring | v1.5 | 18/18 | Complete | 2026-05-22 |
| 25-29, 29.1 Session Memory | v1.4 | 6/6 | Complete | 2026-05-21 |
| 21-24 Desktop Product | v1.3 | archived | Complete | 2026-05-21 |
| 12-17 Answer Quality Loops | v1.2 | archived | Complete | 2026-05-20 |
| 6-11 Interop / plugins | v1.1 | archived | Complete | 2026-05-13 |
| 1-5 MVP | v1.0 | archived | Complete | 2026-05-08 |
