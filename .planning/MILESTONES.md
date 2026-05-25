# Milestones

## v1.19 UI Product Simplification (Shipped: 2026-05-25)

**Phases completed:** 8 phases (121–128), 12 plans  
**Requirements:** 37/37 satisfied at code/static level (from VERIFICATION must-haves; no REQUIREMENTS.md at close)  
**Audit status:** tech_debt accepted — `.planning/milestones/v1.19-MILESTONE-AUDIT.md`  
**Known deferred items at close:** 8 (see STATE.md Deferred Items)

**Key accomplishments:**

- Complete UI surface cut list scoring 26 audit rows with Keep/Demote/Delete verdicts and Phase 122–127 owner assignments
- Deleted RefineGraphPanel and QualityLoopInspector; reordered Advanced tabs with Models and Sessions first
- Thin TopBar, canvas-first default view, Run panel on node select only with approve/clarify actions
- Monolithic styles.css split into five concern modules with dead CSS removed
- AppShell slimmed to 132 lines via workflow hooks; domain fetches moved into Advanced view mounts
- NodeInspector cut from 453 to 318 LOC; GraphWorkflowPanel collapsed
- React.lazy splits Advanced hub — main JS 522.60 kB → 480.34 kB (−8.1%)
- Automated UAT preflight passed (36/36 static tests); operator browser UAT documented as human_needed

**Archive:** `.planning/milestones/v1.19-ROADMAP.md`, `.planning/milestones/v1.19-MILESTONE-AUDIT.md`

---

## v1.18 Node Runtime Retirement (Shipped: 2026-05-24)

**Phases completed:** 8 phases (113–120), 24 plans  
**Requirements:** 33/33 satisfied (from PLAN/SUMMARY frontmatter; no REQUIREMENTS.md at close)  
**Audit status:** tech_debt accepted — `.planning/milestones/v1.18-MILESTONE-AUDIT.md`  
**Known deferred items at close:** 6 (see STATE.md Deferred Items)

**Key accomplishments:**

- Entire TypeScript runtime tree (`src/`) deleted; Rust `crates/rlm-core` is sole orchestration layer
- `npm rlm` dispatches exclusively to Rust CLI; Tauri embeds Axum control server in-process
- Vite dev proxy targets Rust APIs; `check:parity` runs Rust golden fixtures only
- npm toolchain Rust-only: `npm run check` = UI lint/format + `check:rust`; tsconfig/depcruise removed
- Constrained Ollama tool envelope (`useToolEnvelope`) with JSON Schema format path wired through config → adapter → tool_round_loop

**Archive:** `.planning/milestones/v1.18-ROADMAP.md`, `.planning/milestones/v1.18-REQUIREMENTS.md`, `.planning/milestones/v1.18-MILESTONE-AUDIT.md`

---

## v1.17 Rust Infrastructure Layer (Shipped: 2026-05-24)

**Phases completed:** 16 phases (97–112), 20 plans  
**Requirements:** 73/75 satisfied (2 partial: PLUG-106-04, PLUG-107-05)  
**Audit status:** tech_debt accepted — `.planning/milestones/v1.17-MILESTONE-AUDIT.md`  
**Known deferred items at close:** 7 (see STATE.md Deferred Items)

**Key accomplishments:**

- Config loaders moved to `persistence/config/`; `application/config` deleted; boundary baseline ratcheted
- Mirrored test trees for persistence/adapters/plugins — 16 `#[path]` stubs; zero inline tests in source
- Module splits: memory_store (scope/episodic/audit), run_state_store (persist/mutation), session_store (persist/verify), ollama_language_model (request/response)
- Ports consolidation: `ToolExecutionResult`, `AgentProfile`, `PluginRegistryConfig` at composition boundary
- Empty `rust-boundary-baseline.json`; strict boundary checks pass; 60/60 lib unit tests pass

**Archive:** `.planning/milestones/v1.17-ROADMAP.md`, `.planning/milestones/v1.17-MILESTONE-AUDIT.md`

---

## v1.16 Rust Application Memory & Config (Shipped: 2026-05-24)

**Phases completed:** 5 phases (92–96), 5 plans  
**Requirements:** Application inline-test zero target achieved  
**Audit status:** passed — `.planning/v1.16-MILESTONE-AUDIT.md`

**Key accomplishments:**

- Split `ram_guard.rs` into probe/budget/eligibility/ollama modules with facade re-exports
- Extracted memory block inline tests (session bridge, semantic index, resolver)
- Extracted config loader tests — zero inline test bodies in `src/application/`
- 60/60 lib unit tests pass

**Archive:** `.planning/milestones/v1.16-ROADMAP.md`

---

## v1.15 Rust Application Layer Architecture (Shipped: 2026-05-24)

**Phases completed:** 1 phase (91), 1 plan  
**Requirements:** 5/5 (ARCH-91-01–05; line count 342 vs ~300 target — acceptable)

**Key accomplishments:**

- Split graph executor into `execution_order.rs`, `run_state_sync.rs`, slim `executor.rs`
- Mirrored `tests/application/graph/` with resume unit test coverage
- Established application-layer `#[path]` test pattern from Phase 90

**Archive:** `.planning/milestones/v1.15-ROADMAP.md`

---

## v1.14 Rust Architecture & Test Layout (Shipped: 2026-05-23)

**Phases completed:** 1 phase (90), 1 plan  
**Requirements:** 5/6 (ARCH-90-01–05 complete; ARCH-90-06 partial)  
**Audit status:** passed — `.planning/v1.14-MILESTONE-AUDIT.md`  
**Known deferred items at close:** 5 (see STATE.md Deferred Items)

**Key accomplishments:**

- Extracted all five `domain/recursion/` inline test modules to `crates/rlm-core/tests/domain/recursion/`
- Established `#[path]` stub pattern for mirrored tests with private access
- 18 domain recursion unit tests pass; flat integration tests unchanged

**Archive:** `.planning/milestones/v1.14-ROADMAP.md`, `.planning/milestones/v1.14-REQUIREMENTS.md`

---

## v1.13 Runtime Safety & WSL Hardening (Shipped: 2026-05-24)

**Phases completed:** 4 phases (86–89), 4 plans  
**Requirements:** 11/11 (MEM-01–06, SAFE-01–04, REG-03)  
**Audit status:** no formal milestone audit; REG-03 operator signed 2026-05-23 (item 7 WSL SKIP D-05)  
**Known deferred items at close:** 3 backlog todos (see STATE.md Deferred Items)

**Key accomplishments:**

- RAM guard completion — live Ollama `/api/ps`, config validation, WSL auto cap, TypeScript parity
- Execution concurrency — single-run mutex (409), `keep_alive: 0` ratchet, stop-triggered model unload
- Memory visibility — live `resourceGuard` on session poll/SSE, workflow overview budget panel, WSL runbook
- Agent-safe verification — adaptive RAM gates, `test:reg03:preflight`, sequential verify profiles
- REG-03 operator sign-off — items 1–6 PASS on native Linux; WSL stability item SKIP

**Archive:** `.planning/milestones/v1.13-ROADMAP.md`, `.planning/milestones/v1.13-REQUIREMENTS.md`

---

## v1.12 UI Canvas Visual Polish (Shipped: 2026-05-23)

**Phases completed:** 4 phases (82–85), 4 plans  
**Audit status:** implementation complete — 10/11 requirements; REG-02 visual UAT checklist archived unsigned

**Key accomplishments:**

- Theme system — light/dark/system toggle, FOUC prevention, semantic tokens
- High-contrast graph edges and neutral dot-grid canvas
- Light node cards with status chips; Radix context menu (Variant B preserved)
- Initial RAM guardrails (`ram_guard.rs`) and workflow overview/run-control fixes
- REG-02 checklist at `.planning/milestones/v1.12-phases/85-operator-visual-uat/85-UAT.md`

**Archive:** `.planning/milestones/v1.12-phases/`  
**Requirements:** `.planning/REQUIREMENTS.md` (v1.12 section in git history)

---

## v1.11 UI Product Hardening (Shipped: 2026-05-23)

**Phases completed:** 5 phases (77–81), 5 plans  
**Audit status:** complete — 13/13 requirements including REG-01 operator browser UAT

**Key accomplishments:**

- Shell architecture — `legacy/panels.tsx` removed; domain panels in `advanced/*`; workflow vs Advanced boundaries enforced
- Interaction polish — canvas reliability, tier assignment, run/stop cancellation, UI server lifecycle
- First-run launcher — guided composer and session picker on pristine graph
- Workflow overview panel, model RAM guards, plan edge wiring, Ollama keep_alive
- REG-01 operator sign-off via `81-UAT.md`

**Archive:** `.planning/milestones/v1.11-phases/`  
**Requirements:** `.planning/REQUIREMENTS.md` (v1.11 section in git history)

---

## v1.10 v1.9 Debt Closure (Shipped: 2026-05-23)

**Phases completed:** 5 phases (72–76), 12 plans, 26 tasks  
**Audit status:** tech_debt — 9/10 requirements satisfied; REG-01 human UAT unsigned (accepted at close, same pattern as v1.9)  
**Known deferred items at close:** 4 open artifacts acknowledged (see STATE.md Deferred Items)

**Key accomplishments:**

- Merged 10-item REG-01 checklist and targeted preflight green for Rust-served UI operator UAT
- Automated live-server smoke tests recorded; operator browser sign-off still required for REG-01 closure
- Server-computed `runState.resumable` on GET /api/session and SSE initial snapshot for UI resume visibility
- HTTP integration coverage for resume-run confirm gate and skip-completed-nodes via QueueModel
- TopBar resume button gated by runState.resumable with GraphActionModal confirm before POST
- TypeScript graph executor now persists node status and playbook resume cursor at running/completed/failed transitions when runState is wired.
- Graph executor loads persisted resume cursor and skips completed nodes on resume:true, verified by a targeted test with exactly one model invocation.
- Structured SKILL_PARSE_ERROR lifecycle events in Rust SkillRuntime with warn/error severity parity to TypeScript
- ManifestSkillLoader.load() discovers declarative skill paths, merges them into runtime search paths, and doctor reports load failures
- Default npm test now chains deb-smoke-lib unit tests after dist tests via test:packaging.
- 71-DECISION reflects Phase 70 complete; AGENTS documents all 7 transitional Rust boundary arcs with ratchet removal conditions.
- 66-01-SUMMARY frontmatter restored; v1.9 wave todos archived as cancelled under todos/done.

### Known Gaps (tech debt — accepted at close)

- **REG-01 partial:** Automated preflight and HTTP smoke PASS; operator browser checklist unsigned (`72-UAT.md` items 2–10, `72-VERIFICATION.md` human_needed)
- **PLUG-04 partial:** Production bootstrap uses `NoopRuntimeEventSink` — parse-error events not observable via `/api/events` in live runs
- **Nyquist:** No `*-VERIFICATION.md` artifacts for phases 73–76 (NYQT-01 future)
- **Boundary baseline:** 7 transitional arcs documented with ratchet plan; strict mode opt-in only

**Archive:** `.planning/milestones/v1.10-ROADMAP.md`  
**Requirements:** `.planning/milestones/v1.10-REQUIREMENTS.md`  
**Audit:** `.planning/milestones/v1.10-MILESTONE-AUDIT.md`

---

## v1.9 Rust Runtime Hardening (Shipped: 2026-05-22)

**Phases completed:** 10 phases (62–71), 19 plans, 42 tasks  
**Audit status:** tech_debt — 17/18 requirements satisfied; REG-01 human UAT unsigned  
**Known deferred items at close:** 5 open artifacts acknowledged (see STATE.md Deferred Items)

**Key accomplishments:**

- UI regression fixes — pause-auto-approvals and HF download wiring restored for Phase 61 shell
- Full Rust quality loop parity with TypeScript — draft/critique/refine/gate/best-of, golden tests
- Cross-session resume via RunStateStorePort, cursor replay, confirm gate, integration test
- Rust skill interop — discovery, path policies, `skill` tool, doctor warnings
- Full Rust CLI parity — plan-node, workflow export/import, session/memory flags
- PACK-03 CI smoke — headless `.deb` install on ubuntu-latest with xvfb
- Rust `application/` layer mirroring TS concern layout; control-server handler split (11 modules)
- Large-file decomposition — config, registry, session_graph, recursive_language_model
- Rust boundary enforcement — AGENTS.md concern map, `check-rust-boundaries`, npm check:rust wiring
- ARCH-06 evaluated defer — 7s clean build, 8s lib tests; no rlm-ports/rlm-domain extraction

### Known Gaps (tech debt — accepted at close)

- **REG-01 partial:** Automated wiring verified; human UAT checklist unsigned (`61-06-VERIFICATION.md`)
- **UI resume:** Backend `/api/chat/resume-run` complete; no UI consumer wired
- **TS cursor writes:** `persistResumeCursor` not invoked from TS graph executor
- **Nyquist:** No `*-VALIDATION.md` artifacts for phases 62–71
- **Boundary baseline:** 6 transitional arcs baselined; strict mode opt-in only

**Archive:** `.planning/milestones/v1.9-ROADMAP.md`  
**Requirements:** `.planning/milestones/v1.9-REQUIREMENTS.md`  
**Audit:** `.planning/milestones/v1.9-MILESTONE-AUDIT.md`

---

## v1.8 Rust Runtime Migration (Shipped: 2026-05-22)

**Phases completed:** 12 phases (1, 52–61), 23 plans  
**Audit status:** tech_debt — Phase 1 post-ship closure 6/6 areas; prior audit 22/28 requirements  
**Known deferred items at close:** see STATE.md Deferred Items

**Key accomplishments:**

- **Phase 1 (2026-05-22):** Closed v1.8 tech debt — UI regressions (pause control, HF download, graph modals), REG-01 UAT, Rust MCP stdio client, `rlm ask`, run-state resumeCursor

- Rust workspace (`rlm-core`, `rlm-cli`) with Axum control server preserving HTTP/SSE contract and golden fixture gates
- Persistence ports: lossless `.rlm/` dual-read, session save/reopen, memory preferences, YAML config validation
- Recursive engine + ExecutionController, GraphExecutor, and full node/graph API routes in Rust
- usearch ANN vector index with Ollama embeddings; model library and Ollama adapter parity
- Rust plugin system (builtins, registry service, remote fetch security); CLI parity CI with `RLM_RUNTIME` strangler
- Tauri in-process Rust server; release bundle without bundled Node
- Phase 60.1 gap closure: session routes, chat refine, clarification abort, run-state wiring
- Phase 61 UI shell rewrite: AppShell, GraphCanvas, slim Run panel, Advanced hub (canvas-first)

### Known Gaps (tech debt — updated after Phase 1 closure)

- **CLI-01 partial:** Full workflow CLI on Rust deferred (ask path shipped)
- **PLUG-03 partial:** MCP stdio client shipped; skill interop depth deferred
- **PERS-03 partial:** resumeCursor persisted; cross-session consumer deferred (`PERS-03-GAP.md`)
- **REG-01:** Phase 1 operator-signed; Phase 61 human UAT items with live Ollama skipped
- **PACK-03:** `.deb` smoke deferred on CI hosts without GTK/dbus

**Archive:** `.planning/milestones/v1.8-ROADMAP.md`  
**Requirements:** `.planning/milestones/v1.8-REQUIREMENTS.md`  
**Audit:** `.planning/milestones/v1.8-MILESTONE-AUDIT.md`

---

## v1.7 Adapter & Plugin Taxonomy (Shipped: 2026-05-22)

**Phases completed:** 9 phases, 9 plans, 29 tasks  
**Known deferred items at close:** 3 (see STATE.md Deferred Items)

**Key accomplishments:**

- ARCH-02 boundary fixes and `ExtensionHostPort`; composition/interop wiring under `src/runtime/`
- Application concern grouping; unified plugin manifest schema and builtin migration
- Canonical concern map, mirrored tests, strict dependency-cruiser enforcement
- Shared `PluginRegistryService` for CLI and control-server; remote fetch-to-local install
- UI plugin panel with CLI-aligned vocabulary and restart semantics

**Archive:** `.planning/milestones/v1.7-ROADMAP.md`  
**Requirements:** `.planning/milestones/v1.7-REQUIREMENTS.md`  
**Audit:** `.planning/milestones/v1.7-MILESTONE-AUDIT.md`

---

## v1.6 Architecture Cleanup (Shipped: 2026-05-22)

**Phases completed:** 7 phases, 15 plans, 9 tasks  
**Known deferred items at close:** 3 (see STATE.md Deferred Items — pending `.planning/todos/pending/` items acknowledged at milestone close)

**Key accomplishments:**

- ESLint 10 flat config with typescript-eslint and Prettier 3 for `src/`, `tests/`, and `ui/src/`; eslint-config-prettier alignment; expanded `npm run check`.
- dependency-cruiser AGENTS.md layer rules at WARN with checked-in baseline; incremental ratchet path for remaining violations (`ARCH-02`).
- `application/config/` modules for schema, defaults, loader, validation, and runtime resolution; stable `project-config` public façade and focused unit tests.
- `buildRuntimeContext()` bootstrap; slim `src/index.ts`; `cli/run-modes/*` dispatch over a built `RuntimeContext`.
- Adapters grouped under `adapters/tools/`, `adapters/persistence/`, `adapters/models/` with aligned extension shims.
- `domain/recursion/` concern modules (budget guard, tool rounds, quality loop, execution-graph sync, prompt utilities) with orchestrator retaining top-level flow.
- Control-server handlers colocated by surface; `startControlServer` fed from bootstrap (`buildStartControlServerInput`); endpoint contracts preserved.
- Tests reorganized under `tests/domain/recursion/` with `tests/helpers/`; `AGENTS.md` contributor map updated.

**Archive:** `.planning/milestones/v1.6-ROADMAP.md`  
**Requirements:** `.planning/milestones/v1.6-REQUIREMENTS.md`  
**Audit:** `.planning/milestones/v1.6-MILESTONE-AUDIT.md`

---

## v1.5 Dynamic Graph Authoring (Shipped: 2026-05-22)

**Phases completed:** 6 phases, 18 plans, 12 tasks  
**Known deferred items at close:** 4 (see STATE.md Deferred Items)

**Key accomplishments:**

- Shared GraphExecutor with topological ordering, bind-time expert resolution, single-pass/RLM runtime enforcement, and descendant blocking on failure.
- UI confirm-run now delegates to GraphExecutor with config-loaded agent registry instead of root-only selectAgent/runConfiguredAgent.
- Canvas node cards show live execution status, active-node highlight, expert/runtime metadata, and truncated failure reasons during interactive graph runs.
- CLI parity, session v1.5 metadata, and graph-primary UX hardening across UI, CLI, and saved sessions.

**Archive:** `.planning/milestones/v1.5-ROADMAP.md`  
**Requirements:** `.planning/milestones/v1.5-REQUIREMENTS.md`  
**Audit:** `.planning/milestones/v1.5-MILESTONE-AUDIT.md`

---

## v1.4 Session Memory (Shipped: 2026-05-21)

**Phases completed:** 6 phases, 6 plans, 0 tasks  
**Known deferred items at close:** 1 (see STATE.md Deferred Items)

**Key accomplishments:**

- Added durable session snapshot store with restore verification and CLI/API/UI save/reopen controls.
- Added structured memory scopes, episodic continuity, ACL audit records, and bounded context packets.
- Added memory preference persistence plus CLI/API/UI inspection and edit controls.
- Added local semantic retrieval with scoped vector hits and visible degraded index states.
- Verified integrated memory flows and no-silent-loss degraded states end-to-end.
- Closed session save/reopen memory binding gap: live memory, vector index, and runId rebind on restore.

**Archive:** `.planning/milestones/v1.4-ROADMAP.md`  
**Audit:** `.planning/milestones/v1.4-MILESTONE-AUDIT.md`

---

## v1.3 Desktop Product (Shipped: 2026-05-21)

**Phases completed:** 4 phases, 4 plans, 0 tasks

**Key accomplishments:**

- Added runner adapter and sampling cascade metadata across config, providers, nodes, CLI render, and UI.
- Added an in-app model library with curated Ollama catalog, Hugging Face compatibility search, install progress, and tier selection.
- Added desktop release staging with bundled Node runtime, launch shims, UI assets, Ollama readiness helper, and package smoke.
- Added Tauri shell configuration and native runtime lifecycle management for packaged `rlm ui`.
- Produced a Linux `.deb` with `npm run tauri:build` and verified package smoke plus 149/149 tests.

**Archive:** `.planning/milestones/v1.3-ROADMAP.md`  
**Audit:** `.planning/milestones/v1.3-MILESTONE-AUDIT.md`

---

## v1.2 Answer Quality Loops (Shipped: 2026-05-20)

**Status:** completed (see `.planning/milestones/v1.2-MILESTONE-AUDIT.md`)  
**Completed:** 2026-05-20  
**Phases:** 12-17 (phase artifacts remain under `.planning/phases/` until cleanup; roadmap snapshot: `milestones/v1.2-ROADMAP.md`)

**Phases completed:** 6 phases, 9 plans

**Key accomplishments:**

- Added bounded answer-quality loops as collapsed top-level graph nodes with inspectable internal draft, critique, refine, gate, and best-of-progress history
- Added visible adaptive rubrics and structured evaluator parsing with explicit degraded or failed loop states
- Implemented refinement cycles and best-of-progress final selection instead of blindly returning the last iteration
- Added phase-specific model routing and overrides for draft, critique, refine, gate, and best-of-progress
- Exposed loop metadata and manual accept/stop controls across UI, API, CLI, JSON, trace, and run-state surfaces
- Hardened regression coverage for bounded execution, stale metadata invalidation, strict failures, and observability

---

## v1.1 Interop, chat-first, plugins, constrained tools (Shipped: 2026-05-13)

**Status:** completed (see `.planning/milestones/v1.1-MILESTONE-AUDIT.md`)
**Completed:** 2026-05-13
**Phases:** 6-11, including inserted Phase 8.5 (archived under `.planning/milestones/v1.1-phases/`; roadmap snapshot: `milestones/v1.1-ROADMAP.md`)

**Phases completed:** 7 phases, 13 plans, 12 tasks

**Key accomplishments:**

- Typed extension contracts, trust-gated extension loading, and backward-compatible YAML config parsing for plugins
- Built-in tools now load through extension shims, and third-party tool registration is covered by integration tests
- Added MCP + skill interoperability policy configuration and runtime orchestration while keeping non-MCP defaults behavior-compatible
- Implemented shared MCP+skill lifecycle events with deterministic identity/ordering and validated outage escalation/recovery semantics

---

## v1.0 — MVP

- **Status:** completed (see `.planning/STATE.md`, `.planning/v1.0-MILESTONE-AUDIT.md`)
- **Completed:** 2026-05-08
- **Phases:** 1–5 (archived under `.planning/milestones/v1.0-phases/`; roadmap snapshot: `milestones/v1.0-ROADMAP.md`)
