# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-22  
**Milestone:** v1.7 — Adapter & Plugin Taxonomy  
**Core Value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## v1.7 Requirements

### Regression Gate

- [ ] **REG-01**: All existing tests pass after each extraction phase; no intentional behavior changes to CLI flags, config semantics, control-server API, or graph/session/memory flows unless explicitly required by plugin manager UX.
- [ ] **REG-02**: `npm run check` remains the CI gate and stays green throughout the milestone.

### Concern Taxonomy (src + project)

- [x] **TAXN-01**: Publish a canonical concern map in `AGENTS.md` covering `src/` top-level areas (`cli`, `application`, `domain`, `ports`, `runtime`, `plugins`, `adapters`) and how `tests/`, `ui/`, and `scripts/` relate to each concern.
- [x] **TAXN-02**: `src/application/` groups modules by concern — at minimum `execution/`, `graph/`, `memory/`, `plugins/` (manager), and `control-server/` — with flat root files reduced to facades or moved behind concern folders.
- [x] **TAXN-03**: `src/runtime/` owns composition and interop wiring (`composition/`, `interop/`); `application/` no longer hosts `extension-host`, `runtime-composition`, `interop-runtime`, or `mcp-skill-runtime` after extraction.
- [x] **TAXN-04**: `src/plugins/` owns registration/distribution packages; `src/adapters/` retains infrastructure port implementations only (persistence, model hosts, tracing) — no new tool implementations land in `adapters/tools/` after migration.
- [x] **TAXN-05**: `tests/` layout mirrors the stabilized `src/` concern map (e.g. `tests/runtime/`, `tests/plugins/`, `tests/application/graph/`) with shared helpers remaining in `tests/helpers/`.
- [x] **TAXN-06**: dependency-cruiser rules encode the concern taxonomy (forbidden arcs for `plugins→application`, `runtime→cli`, `domain→application`, etc.) and are documented alongside `AGENTS.md`.

### Runtime & Boundary Fixes

- [ ] **RUNT-01**: Fix three ARCH-02 baseline violations — `domain/agents.ts` import direction, `ports/extension-port.ts` coupling to application, and `content-tree` policy colocated with its owning concern (not orphaned in application root).
- [ ] **RUNT-02**: Introduce `ExtensionHostPort` (or equivalent) in `ports/` so plugin registration contracts do not import application types.
- [x] **RUNT-03**: Move `buildRuntimeContext`, `ExtensionHost`, and tool/model factory wiring to `src/runtime/composition/`; bootstrap becomes a thin re-export facade.
- [x] **RUNT-04**: Move MCP/skill interop wiring to `src/runtime/interop/` with preserved init order: plugins → interop → tools resolver → agent registry → models.
- [x] **RUNT-05**: Composition init-order test verifies bootstrap sequence without full CLI or control-server spawn.

### Plugin Taxonomy

- [x] **PLUG-01**: `rlm.plugin.json` manifest schema (id, name, version, category, contributes, `engines.rlm`) validated with Zod **before** any plugin `import()`.
- [x] **PLUG-02**: Category taxonomy covers at least `shell`, `files`, `web`, and `interop`; extensible for future categories without breaking list/doctor output.
- [x] **PLUG-03**: Built-in tools migrate from `src/extensions/tools/` to `src/plugins/builtin/` with manifest + `register(host)` using the same contract as external plugins.
- [x] **PLUG-04**: `PluginLoader` replaces hardcoded `loadBuiltins([...])` with unified discovery: builtins → configured entries → installed catalog.
- [x] **PLUG-05**: Legacy `extensions.load` YAML entries continue working via a compatibility shim normalized to plugin manifest shape for at least one release.
- [x] **PLUG-06**: Contributor guidance documents where new tools, adapters, plugins, and runtime wiring belong after taxonomy moves.

### Dependency-Cruiser Enforcement

- [ ] **DEPS-01**: All three baseline violations from v1.6 are fixed (not suppressed); `dependency-cruiser-baseline.json` shrinks toward empty.
- [x] **DEPS-02**: Rules for new paths (`plugins/`, `runtime/`) land before directory moves complete; forbidden import arcs match the concern map.
- [ ] **DEPS-03**: dependency-cruiser severity ratchets from `warn` to `error` only when baseline is empty; `npm run check` uses strict depcruise without `--ignore-known`.
- [ ] **DEPS-04**: Optional follow-on rule: `application→adapters` imports centralized through runtime composition/bootstrap only (documented exceptions if any remain).

### Local Plugin Manager

- [ ] **MGR-01**: User can run `rlm plugin list` to see installed plugins, enabled state, source (builtin/local), and contributed tool names (`--json` supported).
- [ ] **MGR-02**: User can run `rlm plugin install <local-path>` to copy a plugin into the managed catalog (`~/.rlm/plugins/<id>` default), validate manifest, and apply trust gate before code load.
- [ ] **MGR-03**: User can run `rlm plugin enable`, `disable`, and `uninstall` without reinstalling; config references stay consistent (no orphan entries after uninstall).
- [ ] **MGR-04**: User can run `rlm plugin doctor` with non-zero exit when manifests, paths, duplicate ids, or stale config references are broken.
- [ ] **MGR-05**: User can run `rlm plugin inspect <id>` and `rlm plugin validate <path>` for manifest-only review without booting the full runtime.
- [ ] **MGR-06**: `PluginRegistryService` (or equivalent) is shared by CLI and control-server so install/enable state cannot diverge between surfaces.
- [ ] **MGR-07**: Install/enable/disable changes return explicit `{ requiresRestart: true }` (or equivalent) when runtime reload is required — no silent partial application.

### Remote Fetch

- [ ] **RMT-01**: User can run `rlm plugin install <https-url>` to fetch an archive (`.tar.gz`/`.tgz`) into a staging dir, validate manifest without executing plugin code, confirm, then atomically move to `~/.rlm/plugins/<id>/`.
- [ ] **RMT-02**: Archive extraction rejects path traversal (zip-slip defenses) and enforces a documented max archive size.
- [ ] **RMT-03**: Optional git-based install (`git:` URL or documented equivalent) uses spawn/fetch-to-local only — no remote code execution during fetch.
- [ ] **RMT-04**: `rlm plugin doctor --fix` can quarantine invalid entries and prune stale config refs with explicit `--fix` (never silent auto-repair).

### Plugin Manager UI

- [ ] **UI-01**: Control-server exposes plugin list/install/enable/disable/uninstall/doctor endpoints backed by the same `PluginRegistryService` as CLI.
- [ ] **UI-02**: UI plugin panel shows installed plugins, enabled state, contributed capabilities, and doctor issues with the same vocabulary as CLI failure states.
- [ ] **UI-03**: UI surfaces trust/approval prompts for first load of external plugins consistent with existing allowlist behavior.
- [ ] **UI-04**: UI indicates when plugin changes require session/runtime restart before tools take effect.

## Future Requirements

### Architecture (Deferred)

- **ARCH-01**: Deep split of `execution-controller.ts` — high approval/plan regression risk; defer until measured need post-v1.7 taxonomy.
- **ARCH-03**: AST codemod pipeline for repeated cross-module moves — only if manual extraction becomes routine.

### Product (Deferred from Prior Milestones)

- **SHELL-01**: Guided composer for first-run/new-workflow entry.
- **SHELL-02**: Graph workspace as primary product surface with project/session launcher.
- **PLAT-01**: Multi-runner adapters (llama.cpp, vLLM, cloud APIs) beyond bundled Ollama.
- **PLAT-02**: Release hardening (signed artifacts, Windows/macOS packages, auto-update channel).

### Plugin Ecosystem (Deferred)

- **PLUG-07**: Plugin marketplace or signed plugin channel.
- **PLUG-08**: Plugin hot reload without process restart.
- **PLUG-09**: WASM/subprocess sandbox for third-party plugins.
- **PLUG-10**: `plugins upgrade` with semver resolution.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-runner model adapters | User scoped v1.7 to structural/plugin taxonomy, not runner expansion |
| Product shell / guided composer | Separate future milestone (SHELL-01/02) |
| Remote plugin execution or marketplace | Conflicts with local-first, no-remote-exec constraint |
| Silent auto-updates for plugins | Conflicts with explicit trust/approval requirement |
| npm-global-as-primary install path | Managed local catalog is the supported model |
| Behavior changes to graph/session/memory semantics | v1.7 is taxonomy + plugin distribution unless required for manager UX |
| Big-bang rename of every `application/` file in one phase | Strangler extraction only; one concern per phase |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REG-01 | Phase 43 | Pending |
| REG-02 | Phase 43 | Pending |
| TAXN-01 | Phase 47 | Complete |
| TAXN-02 | Phase 45 | Complete |
| TAXN-03 | Phase 44 | Complete |
| TAXN-04 | Phase 46 | Complete |
| TAXN-05 | Phase 47 | Complete |
| TAXN-06 | Phase 47 | Complete |
| RUNT-01 | Phase 43 | Pending |
| RUNT-02 | Phase 43 | Pending |
| RUNT-03 | Phase 44 | Complete |
| RUNT-04 | Phase 44 | Complete |
| RUNT-05 | Phase 44 | Complete |
| PLUG-01 | Phase 46 | Complete |
| PLUG-02 | Phase 46 | Complete |
| PLUG-03 | Phase 46 | Complete |
| PLUG-04 | Phase 46 | Complete |
| PLUG-05 | Phase 46 | Complete |
| PLUG-06 | Phase 46 | Complete |
| DEPS-01 | Phase 48 | Pending |
| DEPS-02 | Phase 47 | Complete |
| DEPS-03 | Phase 48 | Pending |
| DEPS-04 | Phase 48 | Pending |
| MGR-01 | Phase 49 | Pending |
| MGR-02 | Phase 49 | Pending |
| MGR-03 | Phase 49 | Pending |
| MGR-04 | Phase 49 | Pending |
| MGR-05 | Phase 49 | Pending |
| MGR-06 | Phase 49 | Pending |
| MGR-07 | Phase 49 | Pending |
| RMT-01 | Phase 50 | Pending |
| RMT-02 | Phase 50 | Pending |
| RMT-03 | Phase 50 | Pending |
| RMT-04 | Phase 50 | Pending |
| UI-01 | Phase 51 | Pending |
| UI-02 | Phase 51 | Pending |
| UI-03 | Phase 51 | Pending |
| UI-04 | Phase 51 | Pending |

**Coverage:**
- v1.7 requirements: 38 total
- Mapped to phases: 38/38 ✓
- Unmapped: 0

---
*Requirements defined: 2026-05-22*  
*Last updated: 2026-05-22 after v1.7 scoping (concern taxonomy + plugin manager)*
