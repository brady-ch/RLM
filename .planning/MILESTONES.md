# Milestones

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
