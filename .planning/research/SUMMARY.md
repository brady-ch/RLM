# Project Research Summary

**Project:** Recursive Language Model CLI  
**Domain:** Local-first plugin taxonomy, runtime/interop split, boundary enforcement  
**Milestone:** v1.7 — Adapter & Plugin Taxonomy  
**Researched:** 2026-05-22  
**Confidence:** HIGH overall — repo-verified wiring, seeds, and v1.6 audit; MEDIUM for remote-fetch security and plugin manager UX (no existing implementation)

## Executive Summary

v1.7 extends the v1.6 layered architecture rather than replacing it. The repo already has the right conceptual split — ports define contracts, adapters implement infrastructure I/O, application orchestrates use cases — but three concepts remain conflated: core infrastructure adapters, tool implementations, and registration/distribution packages. The milestone makes the third concept first-class as **plugins**, reserves `src/adapters/` for runtime infrastructure only, and moves composition/interop wiring into `src/runtime/`.

Experts in extensible CLI systems (OpenClaw, GitHub CLI extensions, VS Code, krew) converge on a small pattern: static manifest read **before** `import()`, a stable namespaced plugin id, category taxonomy, enable/disable without reinstall, and a doctor command that fails closed. RLM already has the hard parts from v1.1 — `ExtensionHost`, allowlist trust gate, YAML-first discovery, parallel registries — so v1.7 is primarily **taxonomy + distribution + boundary enforcement**, not a new orchestration framework. Stack additions are minimal: `tar` and `semver` for remote fetch and compatibility checks; everything else reuses Zod, Node built-ins, and existing dependency-cruiser.

The recommended build order is **extract responsibilities first, rename directories second** (per architecture-boundary-cleanup direction). Fix three baselined ARCH-02 violations, split runtime/interop from application, introduce `PluginLoader` + manifest schema, migrate built-ins to `plugins/builtin/`, then deliver CLI plugin manager commands before ratcheting dependency-cruiser to error severity. Remote fetch-to-local is secondary to local-folder install and must never execute code during download or validation.

Key risks: cosmetic folder moves without loader changes (taxonomy theater), parallel plugin discovery paths (YAML + manager + static builtins), UI/runtime desync if handlers bypass a shared registry service, and flag-day depcruise severity before baseline is empty. Mitigate with one canonical discovery pipeline feeding `ExtensionHost`, a shared `PluginRegistryService` for CLI and control-server, manifest-only validation until allowlist approval, and fix-then-shrink baseline before error ratchet.

## Key Findings

### Recommended Stack

v1.7 adds two runtime dependencies and extends existing tooling — no new UI framework, no plugin marketplace SDK, no sandbox VM.

**Core technologies:**
- **Zod** (`^4.4.3`, existing): `rlm.plugin.json` manifest parse + doctor validation — same dialect as project config schema
- **tar** (`^7.5.15`, new): Extract remote `.tar.gz`/`.tgz` into `~/.rlm/plugins/<id>/` with path-traversal filters
- **semver** (`^7.8.1`, new): Manifest `engines.rlm` compatibility checks in doctor
- **Node built-in `fetch` + `fs/promises`**: Download archives and local-folder copy via `fs.cp`; no axios/node-fetch
- **dependency-cruiser** (`^17.4.0`, existing): ARCH-02 error ratchet — fix 3 baseline violations, add `plugins/`/`runtime/` rules, empty baseline, then `severity: "error"`

**Module moves (no new packages):**
- `src/runtime/composition/` — `ExtensionHost`, `buildRuntimeContext`, plugin loader, tool/model factories
- `src/runtime/interop/` — MCP stdio clients, skill discovery, interop tool factories
- `src/plugins/builtin/` — first-party tool plugins with manifest + `register.ts`
- `src/plugins/external/` — loader, manifest, registry, doctor for installed plugins

**Explicitly avoid:** OpenVSX/npm marketplace SDK, remote `import()`, VM2/isolated-vm sandbox, simple-git/degit (git-on-PATH requirement), axios/node-fetch, plugin hot reload (chokidar), second boundary tool (eslint-plugin-boundaries).

### Expected Features

**Must have (table stakes):**
- **Plugin manifest schema** (`rlm.plugin.json`) — id, name, version, category, capabilities, `engines.rlm`; validated before `import()`
- **Stable plugin id + version** — durable identity for enable/disable, doctor, config references
- **Category taxonomy** — shell, files, web, interop; aligns with `plugins/builtin/{shell,files,web}/`
- **Built-in plugins use same contract as external** — migrate `extensions/tools/*.extension.ts` → `plugins/builtin/*/register.ts`
- **`plugins list`** — installed, enabled, contributed tools; `--json` for scripting
- **`plugins install <local-path>`** — copy to managed dir, manifest validate, trust gate, config update
- **`plugins enable` / `disable` / `uninstall`** — config-backed lifecycle without reinstall
- **Trust gate on first code load** — extend existing `.rlm-allowlist.json` + `ExtensionHost.loadExternal`
- **`plugins doctor`** — broken manifests, stale ids, duplicates, missing paths; non-zero exit on failure
- **YAML/config integration** — evolve `extensions.load` toward `plugins.entries.<id>` with backward compat
- **ARCH-02 dependency-cruiser completion** — fix 3 violations, ratchet warn → error
- **Contributor taxonomy docs** — AGENTS.md updated after directory moves

**Should have (differentiators):**
- **`plugins inspect`** — manifest, permissions, contributed capabilities before enable
- **`plugins validate <path>`** — author-facing CI hook; no runtime boot
- **`plugins doctor --fix`** — quarantine bad entries, prune stale config; explicit `--fix` only
- **Remote fetch-to-local** (`install git:…`, `install https://…`) — secondary to local install; no exec during fetch
- **Permission hints in manifest** — declarative network/shell/filesystem for trust decisions
- **Unified builtin + external list** — single mental model with source column
- **Runtime/interop split** — MCP/skill tools separated from adapter taxonomy

**Defer (post–v1.7):**
- Plugin marketplace, signed plugins, auto-update channel
- UI plugin manager panel (consume control-server API once CLI stable)
- WASM/subprocess sandbox for third-party plugins
- `plugins upgrade` with semver resolution
- Plugin hot reload

### Architecture Approach

v1.7 follows the two-pass rule: **extract responsibilities first, rename directories second**. `PluginManager` (application + control-server) owns install/enable/doctor UX; `PluginLoader` (runtime/composition) discovers and loads plugins into `ExtensionHost`; domain and graph execution remain unchanged. Bootstrap init order is preserved: ExtensionHost → PluginLoader (builtins + configured + installed) → interop tools → `createToolsResolver` → agent registry → models.

**Major components:**
1. **PluginManifest / ExtensionHostPort** (ports) — taxonomy types and registration interface decoupled from concrete host
2. **PluginLoader + ExtensionHost** (runtime/composition) — discover, validate manifest, dynamic import, register tools/skills/model-hosts
3. **PluginManager + control-server handlers** (application) — install/enable/list/doctor/fetch; writes catalog + YAML; no direct `import()` of plugins
4. **plugins/builtin/** — first-party registration packages containing adapter implementations
5. **dependency-cruiser rules** — enforce `plugins→application` forbidden, `runtime→cli` forbidden, empty baseline at ratchet

### Critical Pitfalls

1. **Cosmetic taxonomy move before extraction** — Renaming `extensions/` → `plugins/` while keeping hardcoded `loadBuiltins([...])` and baselined import violations. Fix `content-tree`, `AgentConfig`, and `ExtensionHostPort` direction first; one built-in category per slice with `npm run check` green.

2. **Plugin vs adapter boundary collapse** — New tools landing in `adapters/tools/` or application importing external plugin paths directly. Codify: adapters = infra only; plugins = registration/distribution; application resolves via composition.

3. **Flag-day dependency-cruiser error severity** — Flipping all rules to `error` while 3 baseline violations remain blocks CI. Fix each violation → shrink baseline → then ratchet. Goal: empty baseline, remove `--ignore-known`, switch `check` to `depcruise:strict`.

4. **Parallel plugin loading paths** — YAML `extensions.load`, static builtins, manager install dir, and interop each with different allowlist/enable semantics. One pipeline: discover manifests → validate (no execute) → resolve enabled → allowlist → import → register.

5. **Executing plugin code during fetch or validate** — `import()` in doctor/install dry-run bypasses trust gate. Manifest schema + Zod only until allowlist approval; fetch writes files, never runs entry module.

6. **Plugin manager UX diverges from runtime truth** — Control-server handlers owning filesystem separately from bootstrap. Shared `PluginRegistryService`; CLI and HTTP API call same service; return `{ requiresRestart: true }` after install/enable changes.

7. **Breaking existing extension config without migration** — v1.1 `extensions.load` projects lose tools. Compatibility shim normalizing legacy entries to plugin manifest shape; integration test with v1.1 fixture.

## Implications for Roadmap

Based on research, suggested phase structure for v1.7:

### Phase 1: Boundary Fixes + Runtime/Interop Split
**Rationale:** ARCH-02 prerequisite and composition foundation; must precede plugin taxonomy moves to avoid carrying violations into new paths.  
**Delivers:** `AgentConfig` in domain; `ExtensionHostPort` in ports; `content-tree` relocated; `src/runtime/interop/` and `src/runtime/composition/` with moved modules; bootstrap facade re-export; composition init-order test.  
**Addresses:** ARCH-02 violation fixes (table stakes), runtime/interop split (differentiator).  
**Avoids:** Cosmetic move (Pitfall 1), runtime duplication (Pitfall 8), barrel cycles (Pitfall 9).

### Phase 2: Plugin Taxonomy + Built-in Migration
**Rationale:** Manifest schema and `PluginLoader` must exist before manager UX or directory moves have meaning.  
**Delivers:** `PluginManifest` types in ports; `plugins/builtin/tools/{shell,file-write,web-search,web-fetch}/` with manifest + register; `PluginLoader` replacing hardcoded `loadBuiltins([...])`; config schema extension with `extensions.load` compat shim; deprecation of `src/extensions/tools/`.  
**Addresses:** Manifest schema, category taxonomy, built-in same contract as external, YAML integration, contributor docs.  
**Avoids:** Adapter/plugin collapse (Pitfall 2), manifest without versioning (Pitfall 10), legacy YAML break (Pitfall 7), new layer scope blindness (Pitfall 13).

### Phase 3: Dependency-Cruiser Ratchet
**Rationale:** Enforcement wave after violations fixed and new directories exist; prevents taxonomy decay.  
**Delivers:** Rules for `plugins→application`, `plugins→cli`, `runtime→cli`, `builtin→external-loader`; severity `error`; empty baseline; `check` uses `depcruise:strict`; optional `no-application-to-adapters` once imports centralized.  
**Addresses:** ARCH-02 completion (table stakes).  
**Avoids:** Flag-day severity (Pitfall 3), baseline deleted without fixes.

### Phase 4: Local Plugin Manager UX
**Rationale:** Depends on Phase 2 loader; local flows must be stable before remote fetch.  
**Delivers:** `PluginManager` service; `rlm plugin list|install|enable|disable|uninstall|doctor|inspect|validate`; catalog under `.rlm/plugins/`; control-server `handlers/plugins.ts`; CLI + bootstrap integration tests; single enablement store.  
**Addresses:** list, install, enable/disable, uninstall, doctor, inspect, validate, trust gate extension.  
**Avoids:** Parallel loaders (Pitfall 4), manager/runtime desync (Pitfall 5), execute on validate (Pitfall 6), enablement split stores (Pitfall 11), Windows path regression (Pitfall 15), doctor false OK (Pitfall 16).

### Phase 5: Remote Fetch + Enhancements
**Rationale:** Secondary per seed trigger condition — only after local install/doctor stable.  
**Delivers:** `plugins install <url>` via fetch+tar (primary) or optional git spawn; staging → manifest validate → user confirm → atomic move to `~/.rlm/plugins/<id>/`; `doctor --fix`; permission hints in manifest.  
**Uses:** tar, semver, Node fetch; same manifest/trust/enable pipeline as local.  
**Avoids:** Remote execution (Pitfall 12), npm lifecycle scripts, import-before-approval.

### Phase Ordering Rationale

- **Wave 1 before Wave 2:** Port types and runtime split unblock `PluginLoader` without import-direction churn mid-migration.
- **Wave 2 before Wave 4:** Manager install paths require manifest schema and unified discovery; cosmetic moves without loader are worthless.
- **Wave 3 after Wave 1–2:** Ratchet only when baseline empty and new path rules cover `plugins/` and `runtime/`.
- **Wave 5 last:** Remote fetch security (TLS, checksum, zip slip, size limits) needs threat-model spike; local flows prove registry merge strategy first.
- **Interop registration order preserved:** builtins → external plugins → interop tools → `createToolsResolver` — same as v1.6.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Remote fetch):** TLS, checksum, size limits, zip slip — plan-phase security spike before implementation
- **Phase 4 (UI integration):** UI-SPEC if control-server plugin panel ships in v1.7; CLI-first MVP can skip
- **Phase 3 (`no-application-to-adapters`):** Enumerate legitimate bootstrap exceptions before rule lands

Phases with standard patterns (skip research-phase):
- **Phase 1 (Runtime split):** Files and init order verified in live `build-runtime-context.ts`
- **Phase 2 (Manifest schema):** Align with OpenClaw/VS Code fields only where useful; Zod already project standard
- **Phase 4 (CLI commands):** OpenClaw/gh/krew command set well documented; adapt to RLM scope

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Repo-verified deps; tar/semver versions confirmed via npm; only remote transport is new code |
| Features | HIGH | RLM v1.1 extension host + v1.6 bootstrap ground truth; ecosystem patterns MEDIUM adaptation |
| Architecture | HIGH | Live `src/` layout, baseline violations enumerated, init order verified |
| Pitfalls | HIGH | Repo-specific wiring + v1.6 audit ARCH-02 deferral; remote fetch security MEDIUM |

**Overall confidence:** HIGH

### Gaps to Address

- **Remote fetch security model:** Plan-phase spike for TLS pinning, checksum strategy, max archive size, zip-slip defenses before Phase 5.
- **Config migration path:** Decide `extensions.load` → `plugins.enabled` shim vs one-release dual-read; validate with v1.1 fixture project during Phase 2 planning.
- **Enablement store authority:** Pick project-local vs user-global default for enable/disable; document override for desktop/Tauri.
- **UI plugin panel scope:** Confirm CLI-only MVP for v1.7 or schedule UI-SPEC phase if control-server panel is in scope.
- **Tool implementation location during migration:** Built-in tool classes may temporarily stay in `adapters/tools/` while plugins own registration — document transition in AGENTS.md.

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` — v1.7 milestone scope, plugin vs adapter decision
- `.planning/notes/architecture-boundary-cleanup-direction.md` — two-pass cleanup, target directories
- `.planning/seeds/first-class-plugin-taxonomy-for-future-tools.md` — category layout, constraints
- `.planning/seeds/remote-plugin-fetch-to-local-folder.md` — fetch scope, no remote execution
- `.planning/milestones/v1.6-MILESTONE-AUDIT.md` — ARCH-02 deferred, 359 tests baseline
- Repo: `package.json`, `.dependency-cruiser.js`, `dependency-cruiser-baseline.json`, `extension-host.ts`, `build-runtime-context.ts`, `AGENTS.md`

### Secondary (MEDIUM confidence)
- [dependency-cruiser CLI](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md) — baseline, `--ignore-known`, ratchet strategy
- [dependency-cruiser rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) — `severity: "error"`
- [OpenClaw plugin manifest](https://docs.openclaw.ai/plugins/manifest) — static manifest before code load; doctor/fix patterns
- [OpenClaw CLI plugins](https://docs.openclaw.ai/cli/plugins) — install/enable/disable/list/doctor command set
- [VS Code extension manifest](https://code.visualstudio.com/api/references/extension-manifest) — categories, contributes metadata
- [GitHub CLI extensions](https://cli.github.com/manual/gh_extension) — install/list/remove patterns
- [krew developer guide](https://github.com/kubernetes-sigs/krew/blob/master/docs/DEVELOPER_GUIDE.md) — manifest + archive install
- npm registry — `tar@^7.5.15`, `semver@^7.8.1` version verification (2026-05-22)

### Tertiary (LOW confidence)
- KickJS / plugin architecture articles — adapter wraps legacy; plugin is distribution bundle (conceptual only)

---
*Research completed: 2026-05-22*  
*Milestone: v1.7 Adapter & Plugin Taxonomy*  
*Ready for roadmap: yes*
