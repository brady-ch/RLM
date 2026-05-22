# Roadmap: Recursive Language Model CLI

## Milestones

- 🚧 **v1.7 Adapter & Plugin Taxonomy** — Phases 43-51 (in progress)
- ✅ **v1.6 Architecture Cleanup** — Phases 36-42 (shipped 2026-05-22; archive: `.planning/milestones/v1.6-ROADMAP.md`)
- ✅ **v1.5 Dynamic Graph Authoring** — Phases 30-35 (shipped 2026-05-22; archive: `.planning/milestones/v1.5-ROADMAP.md`)
- ✅ **v1.4 Session Memory** — Phases 25-29, 29.1 (shipped 2026-05-21; archive: `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.3 Desktop Product** — Phases 21-24 (shipped 2026-05-21; archive: `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.2 Answer Quality Loops** — Phases 12-17 (shipped 2026-05-20; archive: `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.1 Interop, chat-first, plugins, constrained tools** — Phases 6-11, including inserted Phase 8.5 (shipped 2026-05-13; archive: `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-08; archive: `.planning/milestones/v1.0-ROADMAP.md`)

## Overview

**v1.7 (in progress)** establishes a concern-first project taxonomy — clearer separation across `src/`, `tests/`, and tooling — plus first-class plugin registration, boundary enforcement, and full plugin manager UX. Work follows the strangler pattern: extract responsibilities first, rename directories second, with `npm run check` green after each phase.

**v1.6 (shipped 2026-05-22)** was a behavior-preserving architecture cleanup. Full phase narratives live under `.planning/milestones/v1.6-ROADMAP.md`.

## Phases

### 🚧 v1.7 Adapter & Plugin Taxonomy (In Progress)

**Milestone Goal:** Concern-first taxonomy across `src/` and the project; runtime/interop split; plugin manifest + builtin migration; dependency-cruiser ratchet; local and remote plugin manager (CLI + UI).

- [x] **Phase 43: Boundary Fixes** — Fix three ARCH-02 violations; introduce ExtensionHostPort; establish regression gate (1/1 plan) — 2026-05-22
- [x] **Phase 44: Runtime & Interop Split** — Move composition and MCP/skill interop to `src/runtime/` with init-order test (1/1 plan) — 2026-05-22
- [ ] **Phase 45: Application Concern Grouping** — Group `application/` by execution, graph, memory, plugins, control-server
- [ ] **Phase 46: Plugin Taxonomy & Builtin Migration** — Manifest schema, PluginLoader, builtin migration, legacy YAML compat
- [ ] **Phase 47: Concern Map, Tests Mirror & Depcruise Rules** — AGENTS.md taxonomy, mirrored tests, new path rules
- [ ] **Phase 48: Dependency-Cruiser Ratchet** — Empty baseline, warn→error severity, strict `npm run check`
- [ ] **Phase 49: Local Plugin Manager** — CLI commands, shared registry service, catalog under `~/.rlm/plugins/`
- [ ] **Phase 50: Remote Fetch** — HTTPS archive and optional git fetch-to-local with security defenses
- [ ] **Phase 51: Plugin Manager UI** — Control-server endpoints and UI panel aligned with CLI semantics

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
**Plans**: TBD

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
**Plans**: TBD

### Phase 47: Concern Map, Tests Mirror & Depcruise Rules
**Goal**: Canonical concern map is published, tests mirror stabilized layout, and dependency-cruiser rules encode the taxonomy before ratchet.
**Depends on**: Phase 46
**Requirements**: TAXN-01, TAXN-05, TAXN-06, DEPS-02
**Success Criteria** (what must be TRUE):
  1. AGENTS.md publishes a canonical concern map covering `cli`, `application`, `domain`, `ports`, `runtime`, `plugins`, `adapters`, and how `tests/`, `ui/`, and `scripts/` relate
  2. `tests/` layout mirrors stabilized `src/` concerns (e.g. `tests/runtime/`, `tests/plugins/`, `tests/application/graph/`) with shared helpers in `tests/helpers/`
  3. dependency-cruiser rules for new paths (`plugins/`, `runtime/`) forbid arcs matching the concern map (e.g. `plugins→application`, `runtime→cli`, `domain→application`)
  4. Contributor adding a cross-layer import sees a dependency-cruiser violation with a message referencing the concern map
**Plans**: TBD

### Phase 48: Dependency-Cruiser Ratchet
**Goal**: Boundary enforcement is strict — baseline empty, severity error, CI uses strict depcruise without `--ignore-known`.
**Depends on**: Phase 47
**Requirements**: DEPS-01, DEPS-03, DEPS-04
**Success Criteria** (what must be TRUE):
  1. All three v1.6 baseline violations remain fixed (not suppressed); `dependency-cruiser-baseline.json` is empty
  2. `npm run check` runs dependency-cruiser at error severity without `--ignore-known`
  3. Introducing a forbidden import (e.g. `plugins/` importing `application/`) fails CI with a clear rule name
  4. Optional `application→adapters` rule is documented with any remaining bootstrap exceptions listed in AGENTS.md
**Plans**: TBD

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
**Plans**: TBD

### Phase 50: Remote Fetch
**Goal**: Users can install plugins from remote archives or git URLs with fetch-to-local semantics and security defenses.
**Depends on**: Phase 49
**Requirements**: RMT-01, RMT-02, RMT-03, RMT-04
**Success Criteria** (what must be TRUE):
  1. User can run `rlm plugin install <https-url>` to fetch a `.tar.gz`/`.tgz` archive, validate manifest without executing plugin code, confirm, and atomically move to `~/.rlm/plugins/<id>/`
  2. Archive extraction rejects path traversal (zip-slip) and enforces a documented max archive size
  3. Optional git-based install (`git:` URL or documented equivalent) uses spawn/fetch-to-local only — no remote code execution during fetch
  4. User can run `rlm plugin doctor --fix` to quarantine invalid entries and prune stale config refs; repair never happens without explicit `--fix`
**Plans**: TBD

### Phase 51: Plugin Manager UI
**Goal**: UI plugin panel exposes the same plugin management capabilities as CLI with aligned vocabulary and trust/restart semantics.
**Depends on**: Phase 50
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Control-server exposes plugin list/install/enable/disable/uninstall/doctor endpoints backed by the same `PluginRegistryService` as CLI
  2. UI plugin panel shows installed plugins, enabled state, contributed capabilities, and doctor issues using the same vocabulary as CLI failure states
  3. UI surfaces trust/approval prompts for first load of external plugins consistent with existing allowlist behavior
  4. UI indicates when plugin changes require session/runtime restart before tools take effect
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 43 → 44 → … → 51

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 43. Boundary Fixes | v1.7 | 1/1 | Complete | 2026-05-22 |
| 44. Runtime & Interop Split | v1.7 | 1/1 | Complete   | 2026-05-22 |
| 45. Application Concern Grouping | v1.7 | 0/TBD | Not started | - |
| 46. Plugin Taxonomy & Builtin Migration | v1.7 | 0/TBD | Not started | - |
| 47. Concern Map, Tests Mirror & Depcruise Rules | v1.7 | 0/TBD | Not started | - |
| 48. Dependency-Cruiser Ratchet | v1.7 | 0/TBD | Not started | - |
| 49. Local Plugin Manager | v1.7 | 0/TBD | Not started | - |
| 50. Remote Fetch | v1.7 | 0/TBD | Not started | - |
| 51. Plugin Manager UI | v1.7 | 0/TBD | Not started | - |
| 36-42 Architecture Cleanup | v1.6 | 15/15 | Complete | 2026-05-22 |
| 30-35 Dynamic Graph Authoring | v1.5 | 18/18 | Complete | 2026-05-22 |
| 25-29, 29.1 Session Memory | v1.4 | 6/6 | Complete | 2026-05-21 |
| 21-24 Desktop Product | v1.3 | archived | Complete | 2026-05-21 |
| 12-17 Answer Quality Loops | v1.2 | archived | Complete | 2026-05-20 |
| 6-11 Interop / plugins | v1.1 | archived | Complete | 2026-05-13 |
| 1-5 MVP | v1.0 | archived | Complete | 2026-05-08 |
