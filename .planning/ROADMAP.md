# Roadmap: Recursive Language Model CLI

## Milestones

- 🚧 **v1.10 v1.9 Debt Closure** — Phases 72-76 (planning)
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

**Current milestone:** v1.10 v1.9 Debt Closure — Phases 72-76. Close all documented v1.9 tech debt: REG-01 human UAT sign-off, UI resume wiring, TS resume cursor parity, skill interop depth, packaging in default test gate, and architecture/meta hygiene.

**v1.9 (shipped 2026-05-22)** closed v1.8 functional debt (UI regressions, quality loop parity, resume consumer, skill interop, full CLI, PACK-03 CI) and hardened `rlm-core` architecture to match the TypeScript concern map (application layer, handler split, file decomposition, boundary enforcement, optional crate split evaluated defer). Milestone audit: **tech_debt** — REG-01 human UAT unsigned; documented deferrals drive v1.10 scope.

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

### 🚧 v1.10 v1.9 Debt Closure (Phases 72-76)

**Milestone Goal:** Close all documented v1.9 tech debt so verification, resume UX, skill interop, packaging, and architecture deferrals are resolved or explicitly ratcheted.

- [ ] **Phase 72: Human UAT Sign-off** — REG-01: plan 72-01 executed; automated scope of plan 72-02 done — browser checklist and verification ratchet (Task 2) still awaiting operator (`72-UAT.md`, `72-VERIFICATION.md` remain `human_needed` / checklist `pending`)
- [x] **Phase 73: UI Resume Control** — Wire resume button to POST /api/chat/resume-run with confirm gate + HTTP integration test (RESU-01, RESU-02) (completed 2026-05-23)
- [x] **Phase 74: TS Resume Cursor Parity** — Graph executor persistResumeCursor at node transitions (PERS-04) (completed 2026-05-23)
- [ ] **Phase 75: Skill Interop Depth** — SKILL_PARSE_ERROR lifecycle events; ManifestSkillLoader async load (PLUG-04, PLUG-05)
- [ ] **Phase 76: Packaging & Architecture Hygiene** — test:packaging in npm test; 71-DECISION refresh; boundary debt; meta cleanup (PACK-04, ARCH-07, ARCH-08, META-01)

## Phase Details

### Phase 72: Human UAT Sign-off
**Goal**: Operator completes documented human UAT on the Rust-served UI and Phase 62 verification reflects passed status
**Depends on**: Phase 71 (v1.9 complete)
**Requirements**: REG-01
**Success Criteria** (what must be TRUE):
  1. Operator completes Phase 61 human UAT checklist (`61-06-VERIFICATION.md`) on Rust-served UI with live Ollama where applicable
  2. All checklist items are signed with evidence recorded (screenshots, notes, or equivalent)
  3. Phase 62 verification updated from `human_needed` to passed
**Plans**: 2 plans

Plans:
- [x] 72-01-PLAN.md — UAT checklist template + targeted automated preflight
- [ ] 72-02-PLAN.md — Operator human UAT sign-off + verification ratchet (Task 2 ratchet awaits operator-signed `72-UAT.md`)

**Wave 1** *(autonomous)*
- 72-01 — checklist template, runbook, targeted preflight (build:ui, lint, cargo check, approval contract test)

**Wave 2** *(blocked on Wave 1; operator checkpoint)*
- 72-02 — operator UAT on Rust-served UI; update 61-06, 61, 62, 72 verification + REG-01 Complete

**UI hint**: yes

### Phase 73: UI Resume Control
**Goal**: Users can resume interrupted runs from the UI with an explicit confirm gate and automated HTTP coverage
**Depends on**: Phase 72
**Requirements**: RESU-01, RESU-02
**Success Criteria** (what must be TRUE):
  1. User sees a resume control when an interrupted run has persisted run state
  2. User must explicitly confirm before resume proceeds (no silent resume)
  3. After confirmation, UI calls `POST /api/chat/resume-run` with `{ confirm: true }` and session reflects resumed execution state
  4. HTTP integration test rejects resume without confirm, accepts with confirm, and executor skips completed nodes
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 73-01-PLAN.md — Session snapshot runState.resumable signal (REST + SSE)
- [x] 73-02-PLAN.md — HTTP integration tests for resume-run confirm gate + skip completed nodes
- [x] 73-03-PLAN.md — TopBar resume button with GraphActionModal confirm → POST resume-run

### Phase 74: TS Resume Cursor Parity
**Goal**: Node runtime persists resume cursor at transitions with the same shape as Rust
**Depends on**: Phase 73
**Requirements**: PERS-04
**Success Criteria** (what must be TRUE):
  1. TypeScript graph executor invokes `persistResumeCursor` at each node transition
  2. Node runtime cursor shape matches Rust `RunStateStorePort` expectations
  3. Resume after partial Node execution skips completed nodes using the persisted cursor
**Plans**: 2 plans

Plans:
- [x] 74-01-PLAN.md — Graph executor run-state writes at node transitions
- [x] 74-02-PLAN.md — Resume flag + loadResumeState + skip-completed test

**Wave 1** *(autonomous)*
- 74-01 — persistNodeStatus + persistResumeCursor mirroring Rust executor

**Wave 2** *(depends 74-01)*
- 74-02 — resume consumption + targeted graph-executor-resume test

### Phase 75: Skill Interop Depth
**Goal**: Skill load/parse failures surface as structured lifecycle events with working async declarative loader
**Depends on**: Phase 74
**Requirements**: PLUG-04, PLUG-05
**Success Criteria** (what must be TRUE):
  1. When skill parse fails, execution lifecycle emits structured `SKILL_PARSE_ERROR` events (not warning strings only)
  2. Declarative skill paths load asynchronously via `ManifestSkillLoader.load()` (stub behavior removed)
  3. Doctor/status surfaces reflect skill load failures with structured error context
**Plans**: 2 plans

Plans:
- [ ] 75-01-PLAN.md — RuntimeEvent module + SKILL_PARSE_ERROR lifecycle emission
- [ ] 75-02-PLAN.md — ManifestSkillLoader async load + doctor/runtime merge

**Wave 1** *(autonomous)*
- 75-01 — PLUG-04 structured parse error events

**Wave 2** *(depends 75-01)*
- 75-02 — PLUG-05 async manifest loader + doctor context

### Phase 76: Packaging & Architecture Hygiene
**Goal**: Default test gate includes packaging smoke; architecture docs, baselines, and milestone meta artifacts are accurate
**Depends on**: Phase 75
**Requirements**: PACK-04, ARCH-07, ARCH-08, META-01
**Success Criteria** (what must be TRUE):
  1. Running `npm test` includes `test:packaging` (deb-smoke-lib unit tests in the developer loop)
  2. `71-DECISION.md` accurately reflects Phase 70 prerequisites; `measure-rust-compile-baseline.sh` preserves cargo exit status
  3. Transitional boundary arcs either reduced or documented with ratchet plan in AGENTS.md; default `check:rust:boundaries` behavior unchanged unless arcs eliminated
  4. Stale v1.9 wave todos (`rust-functional-debt-wave1`, `rust-structural-architecture-wave2`) archived or cancelled; `66-01-SUMMARY.md` frontmatter includes `requirements-completed`
**Plans**: 3 plans

Plans:
- [ ] 76-01-PLAN.md — Chain test:packaging into npm test (PACK-04)
- [ ] 76-02-PLAN.md — 71-DECISION refresh + baseline script guard + AGENTS ratchet (ARCH-07, ARCH-08)
- [ ] 76-03-PLAN.md — Archive wave todos + 66-01-SUMMARY frontmatter (META-01)

**Wave 1** *(autonomous; parallel)*
- 76-01 — PACK-04 packaging in npm test
- 76-02 — ARCH-07 + ARCH-08 docs and boundary ratchet
- 76-03 — META-01 todo archive + summary frontmatter

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
| 72. Human UAT Sign-off | v1.10 | 1/2 | Blocked — operator UAT | — |
| 73. UI Resume Control | v1.10 | 3/3 | Complete   | 2026-05-23 |
| 74. TS Resume Cursor Parity | v1.10 | 2/2 | Complete   | 2026-05-23 |
| 75. Skill Interop Depth | v1.10 | 0/2 | Not started | - |
| 76. Packaging & Architecture Hygiene | v1.10 | 0/3 | Not started | - |
