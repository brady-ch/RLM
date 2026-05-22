# Roadmap: Recursive Language Model CLI

## Milestones

- ✅ **v1.8 Rust Runtime Migration** — Phases 52-61 (shipped 2026-05-22; archive: `.planning/milestones/v1.8-ROADMAP.md`)
- ✅ **v1.7 Adapter & Plugin Taxonomy** — Phases 43-51 (shipped 2026-05-22; archive: `.planning/milestones/v1.7-ROADMAP.md`)
- ✅ **v1.6 Architecture Cleanup** — Phases 36-42 (shipped 2026-05-22; archive: `.planning/milestones/v1.6-ROADMAP.md`)
- ✅ **v1.5 Dynamic Graph Authoring** — Phases 30-35 (shipped 2026-05-22; archive: `.planning/milestones/v1.5-ROADMAP.md`)
- ✅ **v1.4 Session Memory** — Phases 25-29, 29.1 (shipped 2026-05-21; archive: `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.3 Desktop Product** — Phases 21-24 (shipped 2026-05-21; archive: `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.2 Answer Quality Loops** — Phases 12-17 (shipped 2026-05-20; archive: `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.1 Interop, chat-first, plugins, constrained tools** — Phases 6-11, including inserted Phase 8.5 (shipped 2026-05-13; archive: `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-08; archive: `.planning/milestones/v1.0-ROADMAP.md`)

## Overview

**v1.8 (shipped 2026-05-22)** replaced the Node orchestration runtime with an embedded Rust workspace (`rlm-core`, `rlm-cli`) while keeping the TypeScript/React UI in Tauri. Migration followed a strangler fig over the frozen HTTP/SSE contract: Axum control server, persistence and engine ports, graph execution, vector index, model hosts, plugins, CLI parity CI, Tauri in-process packaging without bundled Node, gap-closure routes (Phase 60.1), and canvas-first UI shell rewrite (Phase 61). Full phase narratives live under `.planning/milestones/v1.8-ROADMAP.md`. Milestone audit: **tech_debt** (22/28 requirements satisfied with 6 partial deferrals documented).

**v1.7 (shipped 2026-05-22)** established a concern-first project taxonomy, first-class plugin registration, strict dependency-cruiser boundaries, and full plugin manager UX (CLI + UI). Full phase narratives live under `.planning/milestones/v1.7-ROADMAP.md`.

## Phases

<details>
<summary>✅ v1.8 Rust Runtime Migration (Phases 52-61) — SHIPPED 2026-05-22</summary>

See `.planning/milestones/v1.8-ROADMAP.md`, `.planning/milestones/v1.8-REQUIREMENTS.md`, and `.planning/milestones/v1.8-MILESTONE-AUDIT.md`.

- [x] **Phase 52: Rust Workspace + Control Server Strangler** — Cargo workspace, Axum router, static UI, golden HTTP/SSE fixtures (1/1 plan) — 2026-05-22
- [x] **Phase 53: Persistence Ports** — File stores, config YAML, dual-read `.rlm/` formats (1/1 plan) — 2026-05-22
- [x] **Phase 54: Recursive Engine + ExecutionController** — RLM orchestrator and session authority in Rust (1/1 plan) — 2026-05-22
- [x] **Phase 55: Graph Executor + Node Routes** — DAG walker, node/graph mutations, workflow sidecars (1/1 plan) — 2026-05-22
- [x] **Phase 56: Vector Index + Embeddings** — usearch ANN, Ollama embed, JSON import (1/1 plan) — 2026-05-22
- [x] **Phase 57: Model Hosts + Model Library** — Ollama adapter, catalog/search/install, HF metadata (1/1 plan) — 2026-05-22
- [x] **Phase 58: Built-in Plugins + MCP + Registry** — Rust builtins, PluginRegistryService, interop wiring (1/1 plan) — 2026-05-22
- [x] **Phase 59: Rust CLI + Parity CI** — `rlm` binary, `RLM_RUNTIME` switch, TS vs Rust fixture gate (1/1 plan) — 2026-05-22
- [x] **Phase 60: Tauri In-Process + Packaging** — No Node child, Rust-only release bundle (1/1 plan) — 2026-05-22
- [x] **Phase 60.1: Close v1.8 milestone gaps (INSERTED)** — Session routes, memory preferences, run-state wiring, verification backfill (5/5 plans) — 2026-05-22
- [x] **Phase 61: UI Shell Rewrite** — Canvas-first AppShell, GraphCanvas, slim Run panel, Advanced hub (6/6 plans) — 2026-05-22

</details>

<details>
<summary>✅ v1.7 Adapter & Plugin Taxonomy (Phases 43-51) — SHIPPED 2026-05-22</summary>

See `.planning/milestones/v1.7-ROADMAP.md`, `.planning/milestones/v1.7-REQUIREMENTS.md`, and `.planning/milestones/v1.7-MILESTONE-AUDIT.md`.

- [x] **Phase 43: Boundary Fixes** — Fix three ARCH-02 violations; introduce ExtensionHostPort; establish regression gate (1/1 plan) — 2026-05-22
- [x] **Phase 44: Runtime & Interop Split** — Move composition and MCP/skill interop to `src/runtime/` with init-order test (1/1 plan) — 2026-05-22
- [x] **Phase 45: Application Concern Grouping** — Group `application/` by execution, graph, memory, plugins, control-server (1/1 plan) — 2026-05-22
- [x] **Phase 46: Plugin Taxonomy & Builtin Migration** — Manifest schema, PluginLoader, builtin migration, legacy YAML compat (1/1 plan) — 2026-05-22
- [x] **Phase 47: Concern Map, Tests Mirror & Depcruise Rules** — AGENTS.md taxonomy, mirrored tests, new path rules (1/1 plan) — 2026-05-22
- [x] **Phase 48: Dependency-Cruiser Ratchet** — Empty baseline, warn→error severity, strict `npm run check` (1/1 plan) — 2026-05-22
- [x] **Phase 49: Local Plugin Manager** — CLI commands, shared registry service, catalog under `~/.rlm/plugins/` (1/1 plan) — 2026-05-22
- [x] **Phase 50: Remote Fetch** — HTTPS archive and optional git fetch-to-local with security defenses (1/1 plan) — 2026-05-22
- [x] **Phase 51: Plugin Manager UI** — Control-server endpoints and UI panel aligned with CLI semantics (1/1 plan) — 2026-05-22

</details>

<details>
<summary>✅ v1.6 Architecture Cleanup (Phases 36-42) — SHIPPED 2026-05-22</summary>

See `.planning/milestones/v1.6-ROADMAP.md`, `.planning/milestones/v1.6-REQUIREMENTS.md`, and `.planning/milestones/v1.6-MILESTONE-AUDIT.md`.

</details>

<details>
<summary>✅ v1.5 Dynamic Graph Authoring (Phases 30-35) — SHIPPED 2026-05-22</summary>

See `.planning/milestones/v1.5-ROADMAP.md`, `.planning/milestones/v1.5-REQUIREMENTS.md`, and `.planning/milestones/v1.5-MILESTONE-AUDIT.md`.

</details>

<details>
<summary>✅ v1.4 Session Memory (Phases 25-29, 29.1) — SHIPPED 2026-05-21</summary>

See `.planning/milestones/v1.4-ROADMAP.md`, `.planning/milestones/v1.4-REQUIREMENTS.md`, and `.planning/milestones/v1.4-MILESTONE-AUDIT.md`.

</details>

<details>
<summary>✅ v1.3 Desktop Product (Phases 21-24) — SHIPPED 2026-05-21</summary>

See `.planning/milestones/v1.3-ROADMAP.md` and `.planning/milestones/v1.3-REQUIREMENTS.md`.

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 52. Rust Workspace + Control Server Strangler | v1.8 | 1/1 | Complete | 2026-05-22 |
| 53. Persistence Ports | v1.8 | 1/1 | Complete | 2026-05-22 |
| 54. Recursive Engine + ExecutionController | v1.8 | 1/1 | Complete | 2026-05-22 |
| 55. Graph Executor + Node Routes | v1.8 | 1/1 | Complete | 2026-05-22 |
| 56. Vector Index + Embeddings | v1.8 | 1/1 | Complete | 2026-05-22 |
| 57. Model Hosts + Model Library | v1.8 | 1/1 | Complete | 2026-05-22 |
| 58. Built-in Plugins + MCP + Registry | v1.8 | 1/1 | Complete | 2026-05-22 |
| 59. Rust CLI + Parity CI | v1.8 | 1/1 | Complete | 2026-05-22 |
| 60. Tauri In-Process + Packaging | v1.8 | 1/1 | Complete | 2026-05-22 |
| 60.1. Close v1.8 milestone gaps | v1.8 | 5/5 | Complete | 2026-05-22 |
| 61. UI Shell Rewrite | v1.8 | 6/6 | Complete | 2026-05-22 |
| 43-51 Adapter & Plugin Taxonomy | v1.7 | 9/9 | Complete | 2026-05-22 |
| 36-42 Architecture Cleanup | v1.6 | 15/15 | Complete | 2026-05-22 |
| 30-35 Dynamic Graph Authoring | v1.5 | 18/18 | Complete | 2026-05-22 |
| 25-29, 29.1 Session Memory | v1.4 | 6/6 | Complete | 2026-05-21 |
| 21-24 Desktop Product | v1.3 | archived | Complete | 2026-05-21 |
| 12-17 Answer Quality Loops | v1.2 | archived | Complete | 2026-05-20 |
| 6-11 Interop / plugins | v1.1 | archived | Complete | 2026-05-13 |
| 1-5 MVP | v1.0 | archived | Complete | 2026-05-08 |

### Phase 1: Close v1.8 tech debt — UI regressions, MCP client, CLI parity, run-state resume

**Goal:** Close v1.8 partial requirements (REG-01, ENGN-02, MDLH-03, PLUG-03, CLI-01, PERS-03): UI regressions + REG-01 UAT, Rust MCP stdio client, Rust CLI ask/workflow, run-state checkpoint resume.
**Requirements**: REG-01, ENGN-02, MDLH-03, PLUG-03, CLI-01, PERS-03 (from `.planning/milestones/v1.8-MILESTONE-AUDIT.md`)
**Depends on:** Phase 61 (v1.8 shipped)
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 1 to break down)
