# Roadmap: Recursive Language Model CLI

## Milestones

- 🚧 **v1.9 Rust Runtime Hardening** — Phases 62-71 (in progress)
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

**v1.9 (in progress)** closes v1.8 functional debt first (UI regressions, quality loop parity, resume consumer, skill interop, full CLI, PACK-03 CI), then applies v1.6/v1.7 structural patterns to the Rust workspace (application layer, handler split, file decomposition, boundary enforcement, optional crate split).

**v1.8 (shipped 2026-05-22)** replaced the Node orchestration runtime with an embedded Rust workspace while keeping the TypeScript/React UI in Tauri. Milestone audit: **tech_debt** with documented deferrals now addressed by v1.9.

## Phases

### 🚧 v1.9 Rust Runtime Hardening (In Progress)

**Milestone Goal:** Close all v1.8 partial requirements and harden `rlm-core` architecture to match the concern map enforced in TypeScript.

- [x] **Phase 62: UI Regression Fixes** — Restore pause-auto-approvals, HF download wiring, sign REG-01 UAT — 2026-05-22
- [x] **Phase 63: Quality Loop Parity** — Port full TS quality loop to Rust with golden tests — 2026-05-22
- [ ] **Phase 64: Resume Consumer + Run-State Port** — Cross-session resume loader, ARCH-01 boundary fix
- [ ] **Phase 65: Skill Interop** — Port skill runtime and register `skill` tool in Rust
- [ ] **Phase 66: CLI Full Parity** — All Node run modes and flags in `rlm-cli`
- [ ] **Phase 67: PACK-03 CI Smoke** — Headless `.deb` install smoke in release CI
- [ ] **Phase 68: Application Layer + Handler Split** — `application/` grouping and split `routes.rs`
- [ ] **Phase 69: Large File Decomposition** — Split orchestrator, session_graph, registry, config
- [ ] **Phase 70: Rust Boundary Enforcement** — AGENTS.md concern map + `check-rust-boundaries`
- [ ] **Phase 71: Optional Crate Split** — Evaluate and split `rlm-ports`/`rlm-domain` if warranted

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

## Phase Details

### Phase 62: UI Regression Fixes

**Goal:** Close Phase 61 integration regressions and sign REG-01 human UAT before deeper Rust parity work.  
**Depends on:** v1.8 shipped  
**Requirements:** REG-01, REG-02  
**Success Criteria:**
1. User can pause future auto-approvals from TopBar; control hits `/api/pause-future-auto-approvals` and session reflects state
2. User can install HF models from Model Library UI via `/api/model-library/download`
3. REG-01 human UAT checklist (`61-06-VERIFICATION.md`) operator-signed with live Ollama where applicable

### Phase 63: Quality Loop Parity

**Goal:** Rust recursive engine runs the full quality loop matching TypeScript behavior.  
**Depends on:** Phase 62  
**Requirements:** ENGN-01, ENGN-02, REG-02  
**Success Criteria:**
1. Quality-loop-enabled agent produces inspectable draft/critique/refine/gate/best-of iteration history in graph UI
2. Golden parity tests pass against Node strangler fixtures for loop metadata and budget stops
3. Session readiness JSON uses structured object shape consistent with TypeScript

### Phase 64: Resume Consumer + Run-State Port

**Goal:** User can resume interrupted graph runs after restart; domain boundary fixed via store port.  
**Depends on:** Phase 63  
**Requirements:** PERS-01, PERS-02, PERS-03, ARCH-01, REG-02  
**Success Criteria:**
1. Graph executor reads `resumeCursor` + `nodeStatuses` and skips completed nodes on entry
2. Control-server resume requires explicit user confirmation
3. TS `RunStatePersistence` writes same cursor shape as Rust
4. Integration test: partial run → restart → resume → complete
5. No `domain/` module imports concrete persistence types

### Phase 65: Skill Interop

**Goal:** Rust runtime supports configured skill loading matching Node interop.  
**Depends on:** Phase 64  
**Requirements:** PLUG-01, PLUG-02, REG-02  
**Success Criteria:**
1. `skill` tool loads skills from configured search paths with path policy enforcement
2. Init order preserved: plugins → interop → tools resolver → agent registry → models
3. Plugin doctor warns on invalid skill paths

### Phase 66: CLI Full Parity

**Goal:** Rust `rlm` binary replaces Node for all documented CLI workflows.  
**Depends on:** Phase 65  
**Requirements:** CLI-01, CLI-02, REG-02  
**Success Criteria:**
1. `plan-node`, `workflow-export`, `workflow-import` implemented (no exit-2 stubs)
2. Session/memory flags and approval/plan-only/workflow/agent config match `args.ts`
3. Parity CI covers new commands; README workflows run with `RLM_RUNTIME=rust` only

### Phase 67: PACK-03 CI Smoke

**Goal:** Release CI validates `.deb` artifacts on headless hosts.  
**Depends on:** Phase 66 (may run in parallel with Phase 65–66)  
**Requirements:** PACK-01, REG-02  
**Success Criteria:**
1. CI job installs built `.deb` and smoke-starts binary without GTK/dbus on developer machine
2. Packaging workflow documents skip behavior for unsupported hosts

### Phase 68: Application Layer + Handler Split

**Goal:** Rust module layout mirrors v1.6/v1.7 TypeScript concern grouping.  
**Depends on:** Phase 67 (Wave 1 complete)  
**Requirements:** ARCH-02, ARCH-03, REG-02  
**Success Criteria:**
1. `application/` module groups execution, graph, memory, config, bootstrap facades
2. `control_server/routes.rs` reduced to router wiring; handlers live in `handlers/` modules
3. No handler file exceeds ~400 lines; existing route integration tests pass

### Phase 69: Large File Decomposition

**Goal:** Break oversized Rust modules for maintainability without behavior change.  
**Depends on:** Phase 68  
**Requirements:** ARCH-04, REG-02  
**Success Criteria:**
1. `recursive_language_model.rs`, `session_graph.rs`, `registry_service.rs`, `persistence/config.rs` split into focused modules
2. Config split mirrors TS loader/validation/resolver separation
3. All existing Rust integration tests pass after each extraction

### Phase 70: Rust Boundary Enforcement

**Goal:** Document and enforce Rust layer boundaries like TypeScript depcruise.  
**Depends on:** Phase 69  
**Requirements:** ARCH-05, REG-02  
**Success Criteria:**
1. `AGENTS.md` includes Rust concern map with may-import columns
2. `scripts/check-rust-boundaries.sh` (or equivalent) fails CI on domain→persistence violations
3. `npm run check:rust` invokes boundary check

### Phase 71: Optional Crate Split

**Goal:** Improve compile iteration if single-crate layout remains painful after structural cleanup.  
**Depends on:** Phase 70  
**Requirements:** ARCH-06, REG-02  
**Success Criteria:**
1. Compile/test baseline measured before and after split decision
2. If split proceeds: `rlm-ports` + `rlm-domain` crates compile independently; `rlm-cli`/Tauri API unchanged
3. If split deferred: documented rationale in phase summary with trigger conditions from seed

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 62. UI Regression Fixes | v1.9 | 1/1 | Complete | 2026-05-22 |
| 63. Quality Loop Parity | v1.9 | 1/1 | Complete   | 2026-05-22 |
| 64. Resume Consumer + Run-State Port | v1.9 | 0/? | Not started | — |
| 65. Skill Interop | v1.9 | 0/? | Not started | — |
| 66. CLI Full Parity | v1.9 | 0/? | Not started | — |
| 67. PACK-03 CI Smoke | v1.9 | 0/? | Not started | — |
| 68. Application Layer + Handler Split | v1.9 | 0/? | Not started | — |
| 69. Large File Decomposition | v1.9 | 0/? | Not started | — |
| 70. Rust Boundary Enforcement | v1.9 | 0/? | Not started | — |
| 71. Optional Crate Split | v1.9 | 0/? | Not started | — |
