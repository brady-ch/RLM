# Roadmap: Recursive Language Model CLI

## Milestones

- 🚧 **v1.8 Rust Runtime Migration** — Phases 52-60 (in progress)
- ✅ **v1.7 Adapter & Plugin Taxonomy** — Phases 43-51 (shipped 2026-05-22; archive: `.planning/milestones/v1.7-ROADMAP.md`)
- ✅ **v1.6 Architecture Cleanup** — Phases 36-42 (shipped 2026-05-22; archive: `.planning/milestones/v1.6-ROADMAP.md`)
- ✅ **v1.5 Dynamic Graph Authoring** — Phases 30-35 (shipped 2026-05-22; archive: `.planning/milestones/v1.5-ROADMAP.md`)
- ✅ **v1.4 Session Memory** — Phases 25-29, 29.1 (shipped 2026-05-21; archive: `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.3 Desktop Product** — Phases 21-24 (shipped 2026-05-21; archive: `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.2 Answer Quality Loops** — Phases 12-17 (shipped 2026-05-20; archive: `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.1 Interop, chat-first, plugins, constrained tools** — Phases 6-11, including inserted Phase 8.5 (shipped 2026-05-13; archive: `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-08; archive: `.planning/milestones/v1.0-ROADMAP.md`)

## Overview

**v1.8 (in progress)** replaces the Node orchestration runtime with an embedded Rust workspace (`rlm-core`, `rlm-cli`) while keeping the TypeScript/React UI unchanged in Tauri. Migration follows a strangler fig over the frozen HTTP/SSE contract: Axum control server first, persistence and engine ports next, then graph execution, vector index, model hosts, plugins, CLI parity CI, and finally Tauri in-process packaging without bundled Node.

**v1.7 (shipped 2026-05-22)** established a concern-first project taxonomy, first-class plugin registration, strict dependency-cruiser boundaries, and full plugin manager UX (CLI + UI). Full phase narratives live under `.planning/milestones/v1.7-ROADMAP.md`.

**v1.6 (shipped 2026-05-22)** was a behavior-preserving architecture cleanup. Full phase narratives live under `.planning/milestones/v1.6-ROADMAP.md`.

## Phases

### 🚧 v1.8 Rust Runtime Migration (In Progress)

**Milestone Goal:** Desktop and CLI ship a Rust-only runtime that preserves all v1.7 workflows over the existing HTTP/SSE contract — no bundled Node.

- [x] **Phase 52: Rust Workspace + Control Server Strangler** — Cargo workspace, Axum router, static UI, golden HTTP/SSE fixtures (1/1 plan) — 2026-05-22
- [x] **Phase 53: Persistence Ports** — File stores, config YAML, dual-read `.rlm/` formats (1/1 plan) — 2026-05-22
- [x] **Phase 54: Recursive Engine + ExecutionController** — RLM orchestrator and session authority in Rust (1/1 plan) — 2026-05-22
- [x] **Phase 55: Graph Executor + Node Routes** — DAG walker, node/graph mutations, workflow sidecars (1/1 plan) — 2026-05-22
- [x] **Phase 56: Vector Index + Embeddings** — usearch ANN, Ollama embed, JSON import (1/1 plan) — 2026-05-22
- [x] **Phase 57: Model Hosts + Model Library** — Ollama adapter, catalog/search/install, HF metadata (1/1 plan) — 2026-05-22
- [x] **Phase 58: Built-in Plugins + MCP + Registry** — Rust builtins, PluginRegistryService, interop wiring (1/1 plan) — 2026-05-22
- [x] **Phase 59: Rust CLI + Parity CI** — `rlm` binary, `RLM_RUNTIME` switch, TS vs Rust fixture gate (1/1 plan) — 2026-05-22
- [x] **Phase 60: Tauri In-Process + Packaging** — No Node child, Rust-only release bundle (1/1 plan, UAT complete) — 2026-05-22

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

</details>

<details>
<summary>✅ v1.4 Session Memory (Phases 25-29, 29.1) — SHIPPED 2026-05-21</summary>

See `.planning/milestones/v1.4-ROADMAP.md`, `.planning/milestones/v1.4-REQUIREMENTS.md`, and `.planning/milestones/v1.4-MILESTONE-AUDIT.md`.

</details>

<details>
<summary>✅ v1.3 Desktop Product (Phases 21-24) — SHIPPED 2026-05-21</summary>

See `.planning/milestones/v1.3-ROADMAP.md` and `.planning/milestones/v1.3-REQUIREMENTS.md`.

</details>

## Phase Details

### Phase 52: Rust Workspace + Control Server Strangler
**Goal**: The UI HTTP/SSE contract is frozen behind a Rust Axum control server with golden fixture gates before orchestration ports begin.
**Depends on**: Phase 51 (v1.7 complete)
**Requirements**: RWRK-01, RWRK-02, RWRK-03
**Success Criteria** (what must be TRUE):
  1. Developer can build and run the Cargo workspace (`rlm-core` library + `rlm-cli` binary) with crate layout mirroring the v1.7 concern map
  2. User opening the app sees the React UI load from Rust-served static assets with the same base URL contract as today
  3. Scaffolded REST handlers and `/api/events` SSE responses match golden JSON/SSE fixtures in `tests/fixtures/control-server/`
  4. Route probe order and error vocabulary match the TypeScript control server for ported read paths
**Plans**: TBD

### Phase 53: Persistence Ports
**Goal**: All `.rlm/` on-disk formats load and save through Rust file stores with lossless migration from Node-written data.
**Depends on**: Phase 52
**Requirements**: PERS-01, PERS-02, PERS-03, PERS-04, REG-03
**Success Criteria** (what must be TRUE):
  1. User can save and reopen session bundles with the same envelope and verification semantics as v1.4/v1.7
  2. Memory scopes, episodic logs, preferences, and ACL filtering restore with explicit degraded states when stores are corrupt or missing
  3. Run-state checkpoint/resume and workflow sidecar persistence remain compatible with existing graph workflow formats
  4. Project YAML config validation errors show equivalent messages and path context as the TypeScript loader
  5. Session bundles, memory stores, preferences, run-state, and vector-index JSON written by Node open in Rust without data loss
**Plans**: TBD

### Phase 54: Recursive Engine + ExecutionController
**Goal**: Recursive agent execution and session authority run in Rust with behavioral parity to the TypeScript orchestrator.
**Depends on**: Phase 53
**Requirements**: ENGN-01, ENGN-02
**Success Criteria** (what must be TRUE):
  1. User can run recursive agent execution with depth limits, budget guards, quality loop phases, and tool rounds matching TypeScript behavior
  2. User at approval or clarification checkpoints sees the same stale/duplicate mutation handling and authoritative session control as today
  3. User can stop or cancel running execution and receives immediate feedback in SSE and CLI without silent hang
  4. Execution events stream to `/api/events` with vocabulary matching existing UI execution states
**Plans**: 1/1 complete (see `.planning/phases/54-recursive-engine-execution-controller/54-01-SUMMARY.md`)

### Phase 55: Graph Executor + Node Routes
**Goal**: Full graph execution and all node/graph API mutations required by the UI and CLI work through Rust.
**Depends on**: Phase 54
**Requirements**: GRPH-01, GRPH-02
**Success Criteria** (what must be TRUE):
  1. User can execute approved graph topology with bind-time expert resolution, descendant blocking on failure, and single-pass/RLM enforcement matching v1.5
  2. User can mutate nodes via all `/api/nodes/*` and `/api/graph/*` routes with matching status codes and error vocabulary
  3. User can export/import workflow sidecars and resume run-state checkpoints from graph workflows
  4. Plan-from-node and interactive graph execution complete end-to-end through Rust control-server routes
**Plans**: TBD

### Phase 56: Vector Index + Embeddings
**Goal**: Semantic memory retrieval uses a Rust ANN index with Ollama embeddings and visible degraded states.
**Depends on**: Phase 53
**Requirements**: VIDX-01, VIDX-02, VIDX-03
**Success Criteria** (what must be TRUE):
  1. User sees scope-filtered top-k memory hits from the ANN index instead of JSON linear scan at comparable recall
  2. Opening a session with existing `vector-index.json` imports records lazily on first open without losing vectors or metadata
  3. Session save/reopen merges vector metadata losslessly between ANN index and bundle envelope
  4. When Ollama embedding host is unavailable, UI and CLI show explicit degraded retrieval state instead of silent empty results
**Plans**: TBD

### Phase 57: Model Hosts + Model Library
**Goal**: Ollama inference and the model library panel work through Rust adapters and routes.
**Depends on**: Phase 54
**Requirements**: MDLH-01, MDLH-02, MDLH-03
**Success Criteria** (what must be TRUE):
  1. User can run agents against Ollama with streaming completions and tool-calling policy flags used by the recursive engine
  2. User can browse curated catalog, search models, track install progress, and select tiers in the model library panel via Rust routes
  3. User can search Hugging Face and download validated artifacts to local registry without a Python dependency
**Plans**: TBD
**UI hint**: yes

### Phase 58: Built-in Plugins + MCP + Registry
**Goal**: Tool rounds, plugin admin, and MCP interop run through Rust with v1.7 trust and discovery semantics.
**Depends on**: Phase 57
**Requirements**: PLUG-01, PLUG-02, PLUG-03, PLUG-04
**Success Criteria** (what must be TRUE):
  1. Built-in shell, file-write, web-search, and web-fetch tools execute through Rust ExtensionHost with the same trust and guard semantics as v1.7
  2. User can list/install/enable/disable/uninstall/doctor/inspect/validate plugins via CLI and `/api/plugins/*` with registry parity to v1.7
  3. MCP/skill interop initializes in v1.7 order (plugins → interop → tools resolver → agent registry → models)
  4. Remote HTTPS/git plugin install rejects zip-slip and oversized archives with confirm gate and doctor `--fix` repair
**Plans**: TBD
**UI hint**: yes

### Phase 59: Rust CLI + Parity CI
**Goal**: The Rust `rlm` binary replaces Node for all CLI run modes and CI gates parity before cutover.
**Depends on**: Phase 58
**Requirements**: CLI-01, CLI-02, REG-02
**Success Criteria** (what must be TRUE):
  1. User can run all `rlm` run modes (ask, ui, plan-only, workflow, session/memory flags, full `rlm plugin` surface) from the Rust binary
  2. Developer can switch `RLM_RUNTIME=node|rust` for strangler comparison during migration
  3. Combined CI stays green: `npm run check` for UI/tooling plus `check:rust` (fmt, clippy, test) for the Rust workspace
  4. Parity fixture job compares TypeScript golden responses to Rust before Node removal is allowed
**Plans**: TBD

### Phase 60: Tauri In-Process + Packaging
**Goal**: Desktop ships without bundled Node — Tauri embeds the Rust server in-process and release artifacts pass smoke.
**Depends on**: Phase 59
**Requirements**: PACK-01, PACK-02, PACK-03, REG-01
**Success Criteria** (what must be TRUE):
  1. Desktop app launches with in-process Rust control server on `127.0.0.1` — no managed Node child — and shuts down gracefully on window close
  2. Release bundle contains no bundled Node runtime; ships Rust binary, static UI assets, and documented Ollama readiness check in Rust
  3. Linux `.deb` from existing packaging scripts produces an installable artifact passing package smoke with Rust-only runtime layout
  4. User can complete graph authoring, execution, session save/reopen, model library, and plugin panel workflows when served by the Rust runtime — no intentional semantic drift except documented Rust-mode plugin limitations
**Plans**: TBD
**UI hint**: yes

### Phase 60.1: Close v1.8 milestone gaps — session routes, memory preferences, run-state wiring, verification backfill (INSERTED)

**Goal:** Close v1.8 milestone audit gaps — wire missing Rust control-server routes for session save/reopen and memory preferences, connect session_memory_bridge to handlers, port chat/clarification routes, wire or defer run-state, and backfill VERIFICATION.md for phases 53–56.
**Requirements**: REG-01, PERS-01, PERS-02, PERS-03, ENGN-02, GRPH-02, VIDX-02, RWRK-01, RWRK-02, RWRK-03, GRPH-01, VIDX-01, VIDX-03
**Depends on:** Phase 60
**Plans:** 5/5 plans complete

Plans:
- [x] 60.1-01-PLAN.md — Session memory bridge + FileMemoryStore restore API (wave 1)
- [x] 60.1-02-PLAN.md — Session save/reopen/detail + memory preference routes (wave 2)
- [x] 60.1-03-PLAN.md — Chat refine routes + clarification abort + confirm-run body fix (wave 2, parallel with 02)
- [x] 60.1-04-PLAN.md — Run-state execution wiring or explicit deferral (wave 3)
- [x] 60.1-05-PLAN.md — VERIFICATION backfill (53–56) + REQUIREMENTS sync (wave 4)

### Phase 43: Boundary Fixes
**Goal**: Layer import directions are corrected and plugin registration contracts decouple from application types — prerequisite for runtime split and taxonomy moves.
**Depends on**: Phase 42 (v1.6 complete)
**Requirements**: REG-01, REG-02, RUNT-01, RUNT-02
**Success Criteria** (what must be TRUE):
  1. Contributor running `npm run check` sees zero ARCH-02 baseline violations (domain→application, port→application, adapter→application edges eliminated)
  2. `AgentConfig` and related agent types live in domain; config schema imports from domain, not the reverse
  3. `ExtensionHostPort` interface exists in `ports/`; `ExtensionHost` implements it without `ports/` importing application modules
  4. `content-tree` policy/helpers sit with their owning concern (adapter-local or domain-pure), not orphaned in application root
  5. All existing tests pass; CLI flags, config semantics, and graph/session/memory flows behave as before
**Plans**: 1/1 complete

### Phase 44: Runtime & Interop Split
**Goal**: Composition and interop wiring live in `src/runtime/`; application no longer hosts extension-host or interop modules.
**Depends on**: Phase 43
**Requirements**: RUNT-03, RUNT-04, RUNT-05, TAXN-03
**Success Criteria** (what must be TRUE):
  1. `buildRuntimeContext`, `ExtensionHost`, and tool/model factory wiring live under `src/runtime/composition/`; `application/bootstrap/` is a thin re-export facade
  2. MCP/skill interop wiring lives under `src/runtime/interop/`; application no longer contains `extension-host`, `runtime-composition`, `interop-runtime`, or `mcp-skill-runtime`
  3. Runtime init order preserved: plugins → interop → tools resolver → agent registry → models
  4. Composition init-order unit test verifies bootstrap sequence without spawning full CLI or control-server
  5. Contributor can locate all composition and interop wiring from `src/runtime/` per concern map intent
**Plans**: 1/1 complete

### Phase 45: Application Concern Grouping
**Goal**: `application/` modules are grouped by domain concern with flat root reduced to facades.
**Depends on**: Phase 44
**Requirements**: TAXN-02
**Success Criteria** (what must be TRUE):
  1. `src/application/` contains concern folders at minimum: `execution/`, `graph/`, `memory/`, `plugins/`, and `control-server/`
  2. Former flat root files (agent-runner, workflow-runner, graph-planner, memory-manager, etc.) live under their concern folder or behind a facade re-export
  3. Contributor opening `application/` can find execution, graph, memory, and plugin-manager code by concern without scanning a flat directory
  4. Existing CLI, control-server, and session flows work unchanged after moves
**Plans**: 1/1 complete

### Phase 46: Plugin Taxonomy & Builtin Migration
**Goal**: Plugins are first-class registration packages with manifest schema, unified discovery, and built-in tools migrated to the same contract as external plugins.
**Depends on**: Phase 45
**Requirements**: PLUG-01, PLUG-02, PLUG-03, PLUG-04, PLUG-05, PLUG-06, TAXN-04
**Success Criteria** (what must be TRUE):
  1. `rlm.plugin.json` manifest is validated with Zod before any plugin `import()`; invalid manifests fail with actionable errors
  2. Category taxonomy covers shell, files, web, and interop; list/doctor output shows category for each plugin
  3. Built-in tools live in `src/plugins/builtin/` with manifest + `register(host)` using the same contract as external plugins
  4. `PluginLoader` replaces hardcoded `loadBuiltins([...])` with unified discovery: builtins → configured entries → installed catalog
  5. Legacy `extensions.load` YAML entries continue working via compatibility shim for at least one release
  6. `src/adapters/` retains infrastructure port implementations only; no new tool implementations land in `adapters/tools/`
  7. AGENTS.md documents where new tools, adapters, plugins, and runtime wiring belong after taxonomy moves
**Plans**: 1/1 complete

### Phase 47: Concern Map, Tests Mirror & Depcruise Rules
**Goal**: Canonical concern map is published, tests mirror stabilized layout, and dependency-cruiser rules encode the taxonomy before ratchet.
**Depends on**: Phase 46
**Requirements**: TAXN-01, TAXN-05, TAXN-06, DEPS-02
**Success Criteria** (what must be TRUE):
  1. AGENTS.md publishes a canonical concern map covering `cli`, `application`, `domain`, `ports`, `runtime`, `plugins`, `adapters`, and how `tests/`, `ui/`, and `scripts/` relate
  2. `tests/` layout mirrors stabilized `src/` concerns (e.g. `tests/runtime/`, `tests/plugins/`, `tests/application/graph/`) with shared helpers in `tests/helpers/`
  3. dependency-cruiser rules for new paths (`plugins/`, `runtime/`) forbid arcs matching the concern map (e.g. `plugins→application`, `runtime→cli`, `domain→application`)
  4. Contributor adding a cross-layer import sees a dependency-cruiser violation with a message referencing the concern map
**Plans**: 1/1 complete

### Phase 48: Dependency-Cruiser Ratchet
**Goal**: Boundary enforcement is strict — baseline empty, severity error, CI uses strict depcruise without `--ignore-known`.
**Depends on**: Phase 47
**Requirements**: DEPS-01, DEPS-03, DEPS-04
**Success Criteria** (what must be TRUE):
  1. All three v1.6 baseline violations remain fixed (not suppressed); `dependency-cruiser-baseline.json` is empty
  2. `npm run check` runs dependency-cruiser at error severity without `--ignore-known`
  3. Introducing a forbidden import (e.g. `plugins/` importing `application/`) fails CI with a clear rule name
  4. Optional `application→adapters` rule is documented with any remaining bootstrap exceptions listed in AGENTS.md
**Plans**: 1/1 complete

### Phase 49: Local Plugin Manager
**Goal**: Users manage plugins locally via CLI with a shared registry service backing both CLI and control-server.
**Depends on**: Phase 48
**Requirements**: MGR-01, MGR-02, MGR-03, MGR-04, MGR-05, MGR-06, MGR-07
**Success Criteria** (what must be TRUE):
  1. User can run `rlm plugin list` (with `--json`) and see installed plugins, enabled state, source (builtin/local), and contributed tool names
  2. User can run `rlm plugin install <local-path>` to copy into managed catalog (`~/.rlm/plugins/<id>`), validate manifest, and pass trust gate before code load
  3. User can run `rlm plugin enable`, `disable`, and `uninstall` without reinstalling; config stays consistent with no orphan entries after uninstall
  4. User can run `rlm plugin doctor` with non-zero exit when manifests, paths, duplicate ids, or stale config references are broken
  5. User can run `rlm plugin inspect <id>` and `rlm plugin validate <path>` for manifest-only review without booting full runtime
  6. CLI and control-server share the same `PluginRegistryService`; install/enable state cannot diverge between surfaces
  7. Install/enable/disable responses include explicit `requiresRestart: true` when runtime reload is needed — no silent partial application
**Plans**: 1/1 complete

### Phase 50: Remote Fetch
**Goal**: Users can install plugins from remote archives or git URLs with fetch-to-local semantics and security defenses.
**Depends on**: Phase 49
**Requirements**: RMT-01, RMT-02, RMT-03, RMT-04
**Success Criteria** (what must be TRUE):
  1. User can run `rlm plugin install <https-url>` to fetch a `.tar.gz`/`.tgz` archive, validate manifest without executing plugin code, confirm, and atomically move to `~/.rlm/plugins/<id>/`
  2. Archive extraction rejects path traversal (zip-slip) and enforces a documented max archive size
  3. Optional git-based install (`git:` URL or documented equivalent) uses spawn/fetch-to-local only — no remote code execution during fetch
  4. User can run `rlm plugin doctor --fix` to quarantine invalid entries and prune stale config refs; repair never happens without explicit `--fix`
**Plans**: 1/1 complete

### Phase 51: Plugin Manager UI
**Goal**: UI plugin panel exposes the same plugin management capabilities as CLI with aligned vocabulary and trust/restart semantics.
**Depends on**: Phase 50
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Control-server exposes plugin list/install/enable/disable/uninstall/doctor endpoints backed by the same `PluginRegistryService` as CLI
  2. UI plugin panel shows installed plugins, enabled state, contributed capabilities, and doctor issues using the same vocabulary as CLI failure states
  3. UI surfaces trust/approval prompts for first load of external plugins consistent with existing allowlist behavior
  4. UI indicates when plugin changes require session/runtime restart before tools take effect
**Plans**: 1/1 complete
**UI hint**: yes

## Progress

**Execution Order (v1.8):**
Phases execute in numeric order: 52 → 53 → … → 60

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 52. Rust Workspace + Control Server Strangler | v1.8 | 1/1 | Complete | 2026-05-22 |
| 53. Persistence Ports | v1.8 | 1/1 | Complete   | 2026-05-22 |
| 54. Recursive Engine + ExecutionController | v1.8 | 1/1 | Complete | 2026-05-22 |
| 55. Graph Executor + Node Routes | v1.8 | 1/1 | Complete | 2026-05-22 |
| 56. Vector Index + Embeddings | v1.8 | 1/1 | Complete | 2026-05-22 |
| 57. Model Hosts + Model Library | v1.8 | 1/1 | Complete | 2026-05-22 |
| 58. Built-in Plugins + MCP + Registry | v1.8 | 1/1 | Complete | 2026-05-22 |
| 59. Rust CLI + Parity CI | v1.8 | 1/1 | Complete   | 2026-05-22 |
| 60. Tauri In-Process + Packaging | v1.8 | 1/1 | Complete   | 2026-05-22 |
| 43. Boundary Fixes | v1.7 | 1/1 | Complete | 2026-05-22 |
| 44. Runtime & Interop Split | v1.7 | 1/1 | Complete   | 2026-05-22 |
| 45. Application Concern Grouping | v1.7 | 1/1 | Complete   | 2026-05-22 |
| 46. Plugin Taxonomy & Builtin Migration | v1.7 | 1/1 | Complete   | 2026-05-22 |
| 47. Concern Map, Tests Mirror & Depcruise Rules | v1.7 | 1/1 | Complete   | 2026-05-22 |
| 48. Dependency-Cruiser Ratchet | v1.7 | 1/1 | Complete   | 2026-05-22 |
| 49. Local Plugin Manager | v1.7 | 1/1 | Complete   | 2026-05-22 |
| 50. Remote Fetch | v1.7 | 1/1 | Complete   | 2026-05-22 |
| 51. Plugin Manager UI | v1.7 | 1/1 | Complete   | 2026-05-22 |
| 36-42 Architecture Cleanup | v1.6 | 15/15 | Complete | 2026-05-22 |
| 30-35 Dynamic Graph Authoring | v1.5 | 18/18 | Complete | 2026-05-22 |
| 25-29, 29.1 Session Memory | v1.4 | 6/6 | Complete | 2026-05-21 |
| 21-24 Desktop Product | v1.3 | archived | Complete | 2026-05-21 |
| 12-17 Answer Quality Loops | v1.2 | archived | Complete | 2026-05-20 |
| 6-11 Interop / plugins | v1.1 | archived | Complete | 2026-05-13 |
| 1-5 MVP | v1.0 | archived | Complete | 2026-05-08 |

### Phase 61: UI Shell Rewrite

**Goal:** Replace the monolithic scrollable sidebar with Sketch 002-B shell: inline prompt editing on node cards, right-click context menus for plan/graph actions, slim Run panel (approve/clarify) on node select only, and full-screen Advanced hub — frontend restructure only, same HTTP/SSE contract.

**Requirements**: `.planning/phases/61-ui-shell-rewrite/61-UI-SPEC.md`
**Depends on:** Phase 60
**Plans:** 6 plans

Plans:
- [ ] 61-01-PLAN.md — Extract shared types, API helpers, and design tokens
- [ ] 61-02-PLAN.md — AppShell + TopBar with session/SSE state and view routing
- [ ] 61-03-PLAN.md — GraphCanvas, ExecutionNodeCard (002-B), NodeContextMenu
- [ ] 61-04-PLAN.md — Slim Run panel on node select with responsive layout
- [ ] 61-05-PLAN.md — Full-screen Advanced hub with lazy domain views
- [ ] 61-06-PLAN.md — Monolith teardown, build verification, REG-01 UAT

**Wave 1** *(no dependencies)*
- 61-01

**Wave 2** *(blocked on Wave 1)*
- 61-02

**Wave 3** *(blocked on Wave 2)*
- 61-03

**Wave 4** *(blocked on Wave 2–3; 61-04 and 61-05 parallel)*
- 61-04 *(also requires 61-03)*
- 61-05

**Wave 5** *(blocked on Waves 3–4)*
- 61-06

Cross-cutting constraints:
- Workflow view shows no models/plugins/sessions/memory panels (UI-SC-01)
- Prompt editable on node card; Plan via context menu (UI-SC-02)
- Run panel visible on node select only (UI-SC-03)
- Advanced hub reachable with Back to workflow (UI-SC-04)
- Same HTTP/SSE contract — frontend restructure only
