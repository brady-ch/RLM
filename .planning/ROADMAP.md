# Roadmap: Recursive Language Model CLI

## Milestones

- ✅ **v1.9 Rust Runtime Hardening** — Phases 62-71 (shipped 2026-05-22; archive: `.planning/milestones/v1.9-ROADMAP.md`)
- ✅ **v1.8 Rust Runtime Migration** — Phases 1, 52-61 (shipped 2026-05-22; archive: `.planning/milestones/v1.8-ROADMAP.md`)
- ✅ **v1.7 Adapter & Plugin Taxonomy** — Phases 43-51 (shipped 2026-05-22; archive: `.planning/milestones/v1.7-ROADMAP.md`)
- ✅ **v1.6 Architecture Cleanup** — Phases 36-42 (shipped 2026-05-22; archive: `.planning/milestones/v1.6-ROADMAP.md`)
- ✅ **v1.5 Dynamic Graph Authoring** — Phases 30-35 (shipped 2026-05-22; archive: `.planning/milestones/v1.5-ROADMAP.md`)
- ✅ **v1.4 Session Memory** — Phases 25-29, 29.1 (shipped 2026-05-21; archive: `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.3 Desktop Product** — Phases 21-24 (shipped 2026-05-21; archive: `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.2 Answer Quality Loops** — Phases 12-17 (shipped 2026-05-20; archive: `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.1 Interop, chat-first, plugins, constrained tools** — Phases 6-11 (shipped 2026-05-13; archive: `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-08; archive: `.planning/milestones/v1.0-ROADMAP.md`)

## Overview

**Next milestone:** TBD — run `/gsd-new-milestone`

**v1.9 (shipped 2026-05-22)** closed v1.8 functional debt (UI regressions, quality loop parity, resume consumer, skill interop, full CLI, PACK-03 CI) and hardened `rlm-core` architecture to match the TypeScript concern map (application layer, handler split, file decomposition, boundary enforcement, optional crate split evaluated defer). Milestone audit: **tech_debt** — REG-01 human UAT unsigned; documented deferrals in archive audit.

**v1.8 (shipped 2026-05-22)** replaced the Node orchestration runtime with an embedded Rust workspace while keeping the TypeScript/React UI in Tauri.

## Phases

<details>
<summary>✅ v1.9 Rust Runtime Hardening (Phases 62-71) — SHIPPED 2026-05-22</summary>

See `.planning/milestones/v1.9-ROADMAP.md`, `.planning/milestones/v1.9-REQUIREMENTS.md`, and `.planning/milestones/v1.9-MILESTONE-AUDIT.md`.

- [x] **Phase 62: UI Regression Fixes** — pause-auto-approvals, HF download wiring (1/1 plan) — 2026-05-22
- [x] **Phase 63: Quality Loop Parity** — full TS quality loop in Rust with golden tests (1/1 plan) — 2026-05-22
- [x] **Phase 64: Resume Consumer + Run-State Port** — cross-session resume, ARCH-01 boundary fix (1/1 plan) — 2026-05-22
- [x] **Phase 65: Skill Interop** — skill tool, path policies, doctor warnings (1/1 plan) — 2026-05-22
- [x] **Phase 66: CLI Full Parity** — all Node run modes in `rlm-cli` (1/1 plan) — 2026-05-22
- [x] **Phase 67: PACK-03 CI Smoke** — headless `.deb` install smoke in CI (2/2 plans) — 2026-05-22
- [x] **Phase 68: Application Layer + Handler Split** — `application/` grouping, handler modules (2/2 plans) — 2026-05-22
- [x] **Phase 69: Large File Decomposition** — orchestrator, session_graph, registry, config splits (5/5 plans) — 2026-05-22
- [x] **Phase 70: Rust Boundary Enforcement** — AGENTS.md concern map + `check-rust-boundaries` (2/2 plans) — 2026-05-22
- [x] **Phase 71: Optional Crate Split** — measured baseline, evaluated defer (3/3 plans) — 2026-05-22

</details>

<details>
<summary>✅ v1.8 Rust Runtime Migration (Phases 1, 52-61) — SHIPPED 2026-05-22</summary>

See `.planning/milestones/v1.8-ROADMAP.md`, `.planning/milestones/v1.8-REQUIREMENTS.md`, and `.planning/milestones/v1.8-MILESTONE-AUDIT.md`.

- [x] **Phase 1: Close v1.8 tech debt** — UI regressions, MCP client, CLI ask, resumeCursor (5/5 plans) — 2026-05-22
- [x] **Phase 52: Rust Workspace + Control Server Strangler** — 2026-05-22
- [x] **Phase 53: Persistence Ports** — 2026-05-22
- [x] **Phase 54: Recursive Engine + ExecutionController** — 2026-05-22
- [x] **Phase 55: Graph Executor + Node Routes** — 2026-05-22
- [x] **Phase 56: Vector Index + Embeddings** — 2026-05-22
- [x] **Phase 57: Model Hosts + Model Library** — 2026-05-22
- [x] **Phase 58: Built-in Plugins + MCP + Registry** — 2026-05-22
- [x] **Phase 59: Rust CLI + Parity CI** — 2026-05-22
- [x] **Phase 60: Tauri In-Process + Packaging** — 2026-05-22
- [x] **Phase 60.1: Close v1.8 milestone gaps** — 2026-05-22
- [x] **Phase 61: UI Shell Rewrite** — 2026-05-22

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 62. UI Regression Fixes | v1.9 | 1/1 | Complete | 2026-05-22 |
| 63. Quality Loop Parity | v1.9 | 1/1 | Complete | 2026-05-22 |
| 64. Resume Consumer + Run-State Port | v1.9 | 1/1 | Complete | 2026-05-22 |
| 65. Skill Interop | v1.9 | 1/1 | Complete | 2026-05-22 |
| 66. CLI Full Parity | v1.9 | 1/1 | Complete | 2026-05-22 |
| 67. PACK-03 CI Smoke | v1.9 | 2/2 | Complete | 2026-05-22 |
| 68. Application Layer + Handler Split | v1.9 | 2/2 | Complete | 2026-05-22 |
| 69. Large File Decomposition | v1.9 | 5/5 | Complete | 2026-05-22 |
| 70. Rust Boundary Enforcement | v1.9 | 2/2 | Complete | 2026-05-22 |
| 71. Optional Crate Split | v1.9 | 3/3 | Complete | 2026-05-22 |
