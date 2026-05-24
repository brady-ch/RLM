# Roadmap: Recursive Language Model CLI

## Milestones

- 📋 **v1.23 Documentation & Architecture Audit** — Phase 145 (planned; starts after v1.22)
- 📋 **v1.22 Agent Primitives** — Phases 141–144 (planned; starts after v1.21)
- 📋 **v1.21 Inference Expansion** — Phases 136–140 (planned; starts after v1.20)
- 📋 **v1.20 Product Desktop & Run Outcome** — Phases 129–135 (planned; starts after v1.19)
- 📋 **v1.19 UI Product Simplification** — Phases 121–128 (planned; starts after v1.18)
- 📋 **v1.18 Node Runtime Retirement** — Phases 113–120 (planned; starts after v1.17)
- ✅ **v1.17 Rust Infrastructure Layer** — Phases 97–112 (shipped 2026-05-24)
- ✅ **v1.16 Rust Application Memory & Config** — Phases 92–96 (shipped 2026-05-24)
- ✅ **v1.15 Rust Application Layer Architecture** — Phase 91 (shipped 2026-05-24)
- ✅ **v1.14 Rust Architecture & Test Layout** — Phase 90 (shipped 2026-05-23)
- ✅ **v1.13 Runtime Safety & WSL Hardening** — Phases 86-89 (shipped 2026-05-24)

## Overview

**Current milestone:** v1.18 Node Runtime Retirement — delete TypeScript runtime layers; Rust-only orchestration and CLI.

**Milestone Goal:** Inventory TS-only paths, flip default runtime to Rust, delete Node control server/CLI/application/domain/adapters/plugins, and harden constrained Ollama tool envelope.

## Phases

<details>
<summary>✅ v1.17 Rust Infrastructure Layer (Phases 97–112) — SHIPPED 2026-05-24</summary>

**Persistence block**
- [x] Phase 97: Persistence Config Facade
- [x] Phase 98: Persistence Util Test Extraction
- [x] Phase 99: File Vector Index Test Extraction
- [x] Phase 100: ANN Vector Index Architecture & Test Extraction
- [x] Phase 101: Run State Store Architecture & Test Extraction
- [x] Phase 102: Session Store Architecture & Test Extraction
- [x] Phase 103: Memory Store Architecture & Test Extraction

**Adapters block**
- [x] Phase 104: Ollama Embedding Test Extraction
- [x] Phase 105: Ollama Language Model Architecture & Test Extraction

**Plugins block**
- [x] Phase 106: Tool Result Type Ports Consolidation
- [x] Phase 107: Plugin Runtime & Registry Boundary Cleanup
- [x] Phase 108: Plugin Manifest Test Extraction
- [x] Phase 109: Plugin Remote Fetch Test Extraction
- [x] Phase 110: Builtin Write File Test Extraction
- [x] Phase 111: Builtin Shell Test Extraction
- [x] Phase 112: Builtin Web Tools Test Extraction

Full details: `.planning/milestones/v1.17-ROADMAP.md`

</details>

### v1.18 Node Runtime Retirement (Phases 113–120)

**Depends on:** v1.17 complete (Phase 112)

- [x] **Phase 113: Node Runtime Retirement Audit and Cutover Gates** (2026-05-24)
- [x] **Phase 114: Control Server and UI Bootstrap Removal** (2026-05-24)
- [x] **Phase 115: CLI Entry and Runtime Composition Removal** (2026-05-24)
- [x] **Phase 116: Application Layer Removal**
- [x] **Phase 117: Domain and Ports Removal** (2026-05-24)
- [x] **Phase 118: Adapters, Plugins, and TS Tests Removal** (2026-05-24)
- [ ] **Phase 119: npm Toolchain and CI Rust-Only Cleanup**
- [ ] **Phase 120: Constrained Ollama Tool Envelope (Rust)**

**Reference:** `.planning/notes/rust-only-runtime-migration-decisions.md`

### v1.19 UI Product Simplification (Phases 121–128)

**Depends on:** v1.18 complete (Phase 120)

- [ ] **Phase 121: UI Vision Audit and Cut List**
- [ ] **Phase 122: Advanced Hub Pruning**
- [ ] **Phase 123: Workflow View Simplification**
- [ ] **Phase 124: Styles and Token Consolidation**
- [ ] **Phase 125: AppShell State Decomposition**
- [ ] **Phase 126: Node Inspector and Settings Slim Down**
- [ ] **Phase 127: Lazy Routes and Bundle Lightening**
- [ ] **Phase 128: UI Simplification UAT and Sign Off**

**Reference:** `.planning/notes/ui-product-simplification-decisions.md`

### v1.21 Inference Expansion (Phases 136–140)

**Depends on:** v1.20 complete (Phase 135)

**Seeds:** `managed-llama-cpp-runtime`, `multi-runner-adapters`

- [ ] **Phase 136: HF GGUF Install UX Hardening** — Stable browse/install/doctor; registry records tagged with `runnerKind`
- [ ] **Phase 137: Managed llama.cpp Process Supervisor** — Start/stop/restart, crash detection, idle unload, port selection, readiness
- [ ] **Phase 138: llama.cpp LanguageModelPort Adapter** — OpenAI-compatible HTTP to supervised server; constrained tool flags
- [ ] **Phase 139: Multi-Runner Registry and Cloud API Adapters** — Cloud APIs + vLLM optional; uniform sampling cascade
- [ ] **Phase 140: Inference Milestone UAT** — GPU backend matrix smoke, install size doc, runner parity verification

**Reference:** `.planning/seeds/managed-llama-cpp-runtime.md`, `.planning/seeds/multi-runner-adapters.md`

### v1.22 Agent Primitives (Phases 141–144)

**Depends on:** v1.21 complete (Phase 140)

**Seeds:** `loop-controller-structured-artifacts-and-implementation`, `specialized-tool-surfaces`

- [ ] **Phase 141: Loop Controller — Structured Artifact Refinement** — Schema-valid outputs, pluggable gate policies, audit trail
- [ ] **Phase 142: Loop Controller — Implementation Refinement** — Draft/critique/refine cycle with explicit completion gates
- [ ] **Phase 143: Specialized Tool Surfaces — Failure Audit** — Expert-team regression fixtures; role failure measurement
- [ ] **Phase 144: Specialized Tool Surfaces — Role Wrappers** — Built-in role-specific tools (`web_fetch_docs`, `grep_repo`, etc.)

**Reference:** `.planning/seeds/loop-controller-structured-artifacts-and-implementation.md`, `.planning/seeds/specialized-tool-surfaces.md`

### v1.23 Documentation & Architecture Audit (Phase 145)

**Depends on:** v1.22 complete (Phase 144)

- [ ] **Phase 145: Documentation and Architecture Audit** — Refresh AGENTS.md, PROJECT.md, research docs; codebase boundary eval; seed backlog review

**Reference:** `.planning/notes/seed-backlog-resolution-2026-05-24.md`

### v1.20 Product Desktop & Run Outcome (Phases 129–135)

**Depends on:** v1.19 complete (Phase 128)

**Result slice**
- [ ] **Phase 129: Node Output Capture** — Persist model answers on `ExecutionGraphNode.output`; stop discarding executor results
- [ ] **Phase 130: Live Node Output UI** — Run panel shows `node.output` as nodes complete
- [ ] **Phase 131: End-of-Run Synthesis Engine** — Terminal detection, LLM synthesis, SSE stream to UI
- [ ] **Phase 132: Outcome Panel & Streaming Final Answer** — Outcome panel on completion; partial-failure banner

**Productization slice**
- [ ] **Phase 133: Artifact Tracking & Diff Preview** — Register file writes; run-start snapshot; snippet/diff in Outcome panel
- [ ] **Phase 134: Desktop Folder Launcher & Project Switcher** — Tauri folder picker, recent projects, in-app switcher
- [ ] **Phase 135: Desktop Packaging & Bundled Plugins** — End-user install (.deb/.dmg/.exe); no npm; builtins bundled

**Reference:** `.planning/notes/product-run-outcome-spec.md`, `.planning/notes/product-desktop-productization-decisions.md`

## Phase Details

_v1.17 phases 97–112 archived — see `.planning/milestones/v1.17-ROADMAP.md`_

<details>
<summary>✅ v1.16 Rust Application Memory & Config (Phases 92–96) — SHIPPED 2026-05-24</summary>

- [x] **Phase 92: Rust RAM Guard Architecture & Test Extraction** — completed 2026-05-24
- [x] **Phase 93: Rust Session Memory Bridge Test Extraction** — completed 2026-05-24
- [x] **Phase 94: Rust Semantic Memory Index Test Extraction** — completed 2026-05-24
- [x] **Phase 95: Rust Memory Resolver Test Extraction** — completed 2026-05-24
- [x] **Phase 96: Rust Config Loader Test Extraction** — completed 2026-05-24

Full details: `.planning/milestones/v1.16-ROADMAP.md`

</details>

<details>
<summary>✅ v1.15 Rust Application Layer Architecture (Phase 91) — SHIPPED 2026-05-24</summary>

- [x] **Phase 91: Rust Graph Executor Architecture & Test Extraction** — completed 2026-05-24

Full details: `.planning/milestones/v1.15-ROADMAP.md`

</details>

<details>
<summary>✅ v1.14 Rust Architecture & Test Layout (Phase 90) — SHIPPED 2026-05-23</summary>

- [x] **Phase 90: Rust Domain Layer Architecture & Test Extraction** — completed 2026-05-23

</details>

### Phase 113: Node Runtime Retirement Audit and Cutover Gates

**Goal:** Inventory TS-only paths; define per-layer verification gates; flip default runtime to Rust
**Depends on:** Phase 112
**Plans:** 3/3 plans complete
**Success Criteria:**
1. TS-only path inventory documented with deletion order
2. Default `npm rlm` dispatches to Rust binary (`RLM_RUNTIME=rust` or equivalent)
3. Per-phase verification gates written in migration note
4. Rust golden fixtures identified as sole HTTP contract gate post-114

Plans:
**Wave 1**
- [x] 113-01-PLAN.md — TS-only path inventory audit (src/, tests/, scripts, CI)
- [x] 113-02-PLAN.md — Flip default runtime to Rust + package.json bin alignment

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 113-03-PLAN.md — Per-phase verification gates and HTTP contract policy

### Phase 114: Control Server and UI Bootstrap Removal

**Goal:** Delete TypeScript control server; Rust Axum server is sole HTTP transport for UI
**Depends on:** Phase 113
**Plans:** 3/3 plans complete

Plans:
- [x] 114-01-PLAN.md — Retire TS parity scripts; narrow check:parity to Rust golden fixtures
- [x] 114-02-PLAN.md — Delete TS control-server and ui bootstrap; clean consumers
- [x] 114-03-PLAN.md — Vite dev proxy to Rust; run Phase 114 verification gates (completed 2026-05-24)

**Success Criteria:**
1. `src/application/control-server/` deleted
2. `RLM_UI_DIST=ui/dist cargo run -p rlm-cli -- ui` serves all UI API routes
3. `cargo test -p rlm-core control_server_matches_golden_fixtures` passes
4. Parity scripts no longer boot TS server

### Phase 115: CLI Entry and Runtime Composition Removal ✅

**Goal:** Delete Node CLI entry and runtime composition; Rust `rlm-cli` is sole CLI
**Depends on:** Phase 114
**Plans:** 3/3 plans complete
**Verification:** `115-VERIFICATION.md` — passed (Tauri interactive dev smoke deferred to UAT)
**Success Criteria:**
1. `src/index.ts`, `src/cli/`, `src/runtime/` deleted
2. `npm rlm ask` invokes Rust CLI end-to-end
3. Tauri launches Rust server without Node child process
4. All shipped subcommands available via `rlm-cli`

Plans:
- [x] 115-01-PLAN.md — Rust-only rlm-runtime dispatcher + package.json Node script removal
- [x] 115-02-PLAN.md — Delete src/index.ts, src/cli/, src/runtime/, tests/runtime/
- [x] 115-03-PLAN.md — Prune cli-dependent tests, verification gates, Tauri smoke checkpoint

### Phase 116: Application Layer Removal

**Goal:** Delete `src/application/` after Rust application layer confirmed complete
**Depends on:** Phase 115
**Plans:** 3/3 plans complete
**Success Criteria:**
1. `src/application/` deleted
2. `tests/application/` deleted
3. Ask, UI, graph workflow paths work via Rust only
4. No remaining imports from deleted application modules

Plans:
- [x] 116-01-PLAN.md — Delete src/application/ tree and update AGENTS.md
- [x] 116-02-PLAN.md — Delete tests/application/ and update agent-safe-verify light profile
- [x] 116-03-PLAN.md — Prune orphaned application imports and run Phase 116 gates (completed 2026-05-24)

### Phase 117: Domain and Ports Removal

**Goal:** Delete TS domain orchestrator and port interfaces; Rust is canonical
**Depends on:** Phase 116
**Success Criteria:**
1. `src/domain/` and `src/ports/` deleted
2. `tests/domain/` deleted
3. No imports from deleted paths in `ui/` or `scripts/`

**Plans:** 3/3 plans complete

Plans:
- [x] 117-01-PLAN.md — Delete src/domain/ and src/ports/ trees; update AGENTS.md
- [x] 117-02-PLAN.md — Delete tests/domain/ mirrored test tree
- [x] 117-03-PLAN.md — Prune domain/ports orphans and run Phase 117 gates (completed 2026-05-24)

### Phase 118: Adapters, Plugins, and TS Tests Removal

**Goal:** Delete remaining TS infrastructure and mirrored runtime tests
**Depends on:** Phase 117
**Success Criteria:**
1. `src/adapters/`, `src/plugins/` deleted
2. TS runtime test trees deleted (`tests/adapters/`, `tests/plugins/`, `tests/runtime/`, TS integration)
3. Entire `src/` directory absent
4. `cargo test -p rlm-core` passes

**Plans:** 3/3 plans complete

Plans:
- [x] 118-01-PLAN.md — Delete src/adapters/ and src/plugins/ trees; update AGENTS.md
- [x] 118-02-PLAN.md — Delete mirrored TS adapter/plugin/runtime test trees
- [x] 118-03-PLAN.md — Prune orphans, remove src/, and run Phase 118 gates (completed 2026-05-24)

### Phase 119: npm Toolchain and CI Rust-Only Cleanup

**Goal:** Strip Node runtime from package.json and CI; keep Vite/UI build toolchain
**Depends on:** Phase 118
**Success Criteria:**
1. No `bin.rlm` pointing at `dist/src/index.js`
2. LangChain/runtime deps removed; UI deps retained
3. `npm run check` = UI lint/format + `npm run check:rust`
4. AGENTS.md updated for Rust-only runtime architecture

**Plans:** 3 plans

Plans:
- [ ] 119-01-PLAN.md — Remove runtime deps; rewrite check/lint/format scripts
- [ ] 119-02-PLAN.md — Delete tsconfig/depcruise; UI-only eslint and test runner
- [ ] 119-03-PLAN.md — Update AGENTS.md; run Phase 119 gates

### Phase 120: Constrained Ollama Tool Envelope (Rust)

**Goal:** Post-cutover tool-call hardening via Ollama JSON-schema envelope (Option A from research doc)
**Depends on:** Phase 119
**Success Criteria:**
1. `response_format` on `LanguageModelCompleteOptions`
2. Envelope builder from registered tool schemas with closed name enum
3. Ollama adapter uses `format` not `tools` when envelope mode enabled
4. Config-gated; existing two-phase path unchanged when off
5. Tests cover valid envelope parse and unknown-tool rejection

**Plans:** 3 plans

Plans:
- [ ] 120-01-PLAN.md — Port response_format + envelope builder (TDD)
- [ ] 120-02-PLAN.md — Ollama adapter format-only envelope path
- [ ] 120-03-PLAN.md — Config gate + tool_round_loop wiring + integration tests

### Phase 121: UI Vision Audit and Cut List

**Goal:** Score every UI surface against product vision; produce keep/demote/delete cut list for Phases 122–127
**Depends on:** Phase 120
**Success Criteria:**
1. Every component under `ui/src/` mapped to a verdict
2. Chat refine, quality loop, NodeInspector, WorkflowOverview explicitly scored
3. Cut list committed; Phases 122–127 derive tasks from it

### Phase 122: Advanced Hub Pruning

**Goal:** Execute cut list on Advanced hub — remove deleted surfaces, collapse demoted panels
**Depends on:** Phase 121
**Success Criteria:**
1. All "delete" verdicts removed from codebase
2. Advanced landing simplified; essential tabs first (Models, Sessions)
3. `npm run build:ui` passes

### Phase 123: Workflow View Simplification

**Goal:** Trim workflow chrome to locked shell model — thin top bar, canvas, Run panel on select only
**Depends on:** Phase 122
**Success Criteria:**
1. No domain panels (models/plugins/sessions/memory) on workflow view
2. TopBar limited to status, run/stop, Advanced entry
3. Run panel: approve/clarify only — no edit fields
4. First-run launcher → guided composer → graph path intact

### Phase 124: Styles and Token Consolidation

**Goal:** Split monolithic `styles.css`; remove dead CSS; align tokens to canvas-first polish
**Depends on:** Phase 123
**Success Criteria:**
1. CSS split by concern or reduced to module imports
2. Dead rules from deleted components removed
3. Canvas dot grid and light card visual unchanged
4. `npm run build:ui` passes

### Phase 125: AppShell State Decomposition

**Goal:** Move domain state/fetches out of AppShell into Advanced views
**Depends on:** Phase 124
**Success Criteria:**
1. AppShell under ~200 lines
2. No model/plugin/memory fetch on workflow view mount
3. Session/graph refresh still works on workflow view

### Phase 126: Node Inspector and Settings Slim Down

**Goal:** Execute cut list on Settings/NodeInspector; prompt edit stays on node card only
**Depends on:** Phase 125
**Success Criteria:**
1. NodeInspector reduced per cut list
2. No duplicate prompt editing in Run panel or inspector
3. Core plan/run/approve path unchanged

### Phase 127: Lazy Routes and Bundle Lightening

**Goal:** Code-split Advanced hub; measure and reduce bundle size
**Depends on:** Phase 126
**Success Criteria:**
1. Advanced routes lazy-loaded via `React.lazy`
2. Before/after bundle size documented
3. Workflow-first load skips Advanced chunks until navigated

### Phase 128: UI Simplification UAT and Sign Off

**Goal:** Operator UAT on Rust-only stack; milestone sign-off
**Depends on:** Phase 127
**Success Criteria:**
1. UAT checklist covers first-run → graph → run → Advanced → save/reopen
2. First-run to successful run under 5 minutes (operator verified)
3. VERIFICATION.md signed

### Phase 129: Node Output Capture

**Goal:** Persist per-node model output in session snapshot; extend Rust + TS types
**Depends on:** Phase 128
**Success Criteria:**
1. `ExecutionGraphNode.output` field added to domain types and snapshot JSON
2. Graph executor captures RLM `answer` and single-pass model response into `output`
3. `approvalReason` no longer misused for success paths
4. `cargo test -p rlm-core` passes

### Phase 130: Live Node Output UI

**Goal:** Show node output in run panel when user selects a completed node during run
**Depends on:** Phase 129
**Success Criteria:**
1. Run panel renders `node.output` for completed nodes
2. Output updates live via existing session refresh/SSE
3. `npm run build:ui` passes

### Phase 131: End-of-Run Synthesis Engine

**Goal:** After graph run, synthesize terminal node outputs into one final answer; stream via SSE
**Depends on:** Phase 129
**Success Criteria:**
1. Terminal node detection (leaf nodes with no dependents)
2. Synthesis LLM call with partial-failure awareness
3. `runResult.synthesisStatus` + `runResult.finalAnswer` on snapshot
4. SSE or session endpoint streams synthesis tokens
5. Best-effort synthesis when some nodes failed

### Phase 132: Outcome Panel & Streaming Final Answer

**Goal:** Outcome panel on run completion — streamed final answer, status strip, partial-failure banner
**Depends on:** Phases 130, 131
**Success Criteria:**
1. Outcome panel replaces/enhances WorkflowOverview when run terminal
2. Final answer streams token-by-token during synthesis
3. Copy button; link to source nodes on graph
4. Partial failure callouts with node links

### Phase 133: Artifact Tracking & Diff Preview

**Goal:** Track files written/modified during run; show snippet/diff in Outcome panel
**Depends on:** Phase 132
**Success Criteria:**
1. Run-start snapshot of project folder (or tool-registered paths)
2. `write_file` and similar tools register artifacts on `runResult.artifacts`
3. Text files show snippet; modified files show unified diff
4. Artifacts scoped to selected project folder

### Phase 134: Desktop Folder Launcher & Project Switcher

**Goal:** Tauri folder picker at launch; recent projects; in-app project switcher
**Depends on:** Phase 132
**Success Criteria:**
1. Cold start shows folder picker before workflow UI
2. Recent projects persisted and selectable
3. Top-bar switcher changes `project_root` without app restart
4. All runs scoped to selected folder

### Phase 135: Desktop Packaging & Bundled Plugins

**Goal:** End-user installable desktop app; bundled builtins; no npm for users
**Depends on:** Phase 134
**Success Criteria:**
1. `.deb`/platform installer builds in CI
2. Fresh install launches without Node/npm
3. Builtin plugins bundled; external install path documented in UI
4. REG-style UAT: install → pick folder → run → see Outcome panel result

### Phase 136: HF GGUF Install UX Hardening

**Goal:** Stable HF GGUF browse/install/doctor flows; registry records ready for runner binding
**Depends on:** Phase 135
**Success Criteria:**
1. Model library UI covers search, install progress, failure states, and doctor for HF GGUF entries
2. Registry records include `runnerKind` and local artifact path metadata
3. Install size and RAM suitability surfaced before download
4. `cargo test -p rlm-core` model_library tests pass

### Phase 137: Managed llama.cpp Process Supervisor

**Goal:** Supervised llama.cpp child process with lifecycle management
**Depends on:** Phase 136
**Success Criteria:**
1. Start, stop, restart, crash detection, and idle unload implemented
2. Port selection and readiness checks with visible status in UI/API
3. Log capture available for operator diagnostics
4. Platform GPU backend selection documented (CUDA/Metal/Vulkan matrix)

### Phase 138: llama.cpp LanguageModelPort Adapter

**Goal:** Route agent completions through supervised llama.cpp server
**Depends on:** Phase 137
**Success Criteria:**
1. `LanguageModelPort` adapter targets supervised llama.cpp OpenAI-compatible endpoint
2. `constrainedToolCalling` and degraded-mode flags honored
3. Model library entries bind GGUF registry records to running supervisor instance
4. Integration tests cover readiness failure and recovery paths

### Phase 139: Multi-Runner Registry and Cloud API Adapters

**Goal:** Extend runner registry beyond Ollama and llama.cpp
**Depends on:** Phase 138
**Success Criteria:**
1. Cloud API adapters (OpenAI/Anthropic/OpenRouter) wired via HTTP adapter pattern
2. Optional vLLM adapter behind advanced settings
3. Sampling cascade (global → model → node) applies uniformly; unsupported params surfaced in UI
4. `runnerKind` + `runnerModelId` metadata on model library entries

### Phase 140: Inference Milestone UAT

**Goal:** Operator sign-off on inference expansion milestone
**Depends on:** Phase 139
**Success Criteria:**
1. UAT: HF install → llama.cpp supervise → complete via adapter → cloud API fallback
2. GPU backend smoke tests documented per platform
3. Install size and test matrix documented (Ollama + llama.cpp coexistence decision recorded)
4. VERIFICATION.md signed

### Phase 141: Loop Controller — Structured Artifact Refinement

**Goal:** Extend loop primitive for schema-valid structured outputs
**Depends on:** Phase 140
**Success Criteria:**
1. Loop cycles improve schema-valid artifacts until validation passes or cap reached
2. Pluggable gate policies combine model judgment with deterministic schema validation
3. Append-only iteration history, stop reason, and best-of-progress selection preserved
4. Phase-specific model overrides (draft/critique/refine/gate) supported

### Phase 142: Loop Controller — Implementation Refinement

**Goal:** Code-change refinement loop with explicit completion gates
**Depends on:** Phase 141
**Success Criteria:**
1. Draft → critique → refine cycle for implementation changes
2. Completion gates require explicit pass criteria (tests, lint, or operator accept)
3. Audit trail matches answer-quality loop model
4. `cargo test -p rlm-core` loop parity tests pass

### Phase 143: Specialized Tool Surfaces — Failure Audit

**Goal:** Measure expert-team tool failures before adding role-specific surfaces
**Depends on:** Phase 142
**Success Criteria:**
1. Regression fixtures for small-model constrained calling per expert role
2. Documented failure modes: schema errors, wrong tool selection, argument parse failures
3. Go/no-go criteria for Phase 144 wrappers defined from fixture results
4. Allowlist tightening alone evaluated as alternative

### Phase 144: Specialized Tool Surfaces — Role Wrappers

**Goal:** Role-specific built-in tool surfaces where audit proves need
**Depends on:** Phase 143
**Success Criteria:**
1. At least one role wrapper shipped (e.g. `web_fetch_docs` or `grep_repo`) behind allowlist
2. Thin wrappers over shared core adapters; no forked execution stacks
3. Reduced tool-round count or parse failures in regression fixtures vs baseline
4. New tools map to `agents.*.tools` allowlists

### Phase 145: Documentation and Architecture Audit

**Goal:** Refresh project docs and evaluate codebase against current architecture
**Depends on:** Phase 144
**Success Criteria:**
1. AGENTS.md, PROJECT.md, and `.planning/research/ARCHITECTURE.md` updated for post-v1.22 state
2. Boundary rules re-evaluated (`depcruise`, `check-rust-boundaries`); stale baseline entries removed
3. Seed backlog reviewed — archived seeds confirmed, active seeds have trigger conditions
4. Codebase eval report: dead code, doc drift, and deferred-debt items catalogued with disposition

---
*Roadmap updated: 2026-05-24 — v1.17 Rust Infrastructure Layer shipped*
