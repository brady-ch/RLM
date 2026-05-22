# Feature Landscape: v1.7 Adapter & Plugin Taxonomy

**Domain:** Local recursive LM CLI — plugin registration, distribution, and layer-boundary enforcement  
**Milestone:** v1.7 — Adapter & Plugin Taxonomy  
**Researched:** 2026-05-22  
**Confidence:** HIGH for RLM baseline (v1.1 extension host, v1.6 bootstrap/adapters, project seeds); MEDIUM for ecosystem UX patterns (OpenClaw, VS Code, gh/krew verified via official docs; adapted to RLM scope)

## How This Domain Typically Works

### Plugin vs adapter boundary

Mature extensible systems separate three concepts:

| Concept | Role | RLM mapping today |
|---------|------|-------------------|
| **Port** | Stable contract (`ToolPort`, `LanguageModelPort`) | `src/ports/` |
| **Adapter** | Concrete implementation of a port (I/O, format parsing) | `src/adapters/tools|persistence|models/` |
| **Plugin** | Registration/distribution package that wires one or more adapters + metadata + permissions | `ExtensionHost` + `src/extensions/tools/*.extension.ts` shims |

A plugin **contains** adapters but is broader: manifest, category, enablement, trust, and config schema. Adapters stay infrastructure-shaped; plugins stay operator-facing. This matches the v1.7 direction in `architecture-boundary-cleanup-direction.md` and avoids `adapters/` becoming a mixed grab bag of model hosts, persistence, and tool implementations.

**Enforcement pattern:** Static layer rules (dependency-cruiser / ESLint) plus directory taxonomy. `src/plugins/` holds registration packages; `src/adapters/` holds port implementations plugins may import; `application` resolves configured capabilities through composition, not direct adapter imports (ARCH-02 deferred from v1.6).

### Plugin taxonomy

Taxonomy answers: *what kind of capability is this, and where does it live?*

Common pattern across VS Code, OpenClaw, and krew:

1. **Stable plugin id** — unique, namespaced (`rlm-builtin-shell`, `@author/my-toolpack`).
2. **Category labels** — filter/discover in list UX (`shell`, `files`, `web`, `interop`, `model-host`, `skill-loader`).
3. **Static manifest** — JSON/YAML read **before** `import()` so validation, doctor, and config UI do not execute plugin code (OpenClaw `openclaw.plugin.json`; VS Code `package.json` contributes + categories).
4. **Capability metadata** — declares contributed tool names, permission hints, config schema, compatibility (`engines.rlm`).

RLM already has parallel registries (tools, skill loaders, model hosts) behind `ExtensionHost` (v1.1 D-05). v1.7 adds **directory + manifest taxonomy** so built-ins and externals share the same discovery story.

### Plugin manager UX

CLI developer tools converge on a small command set:

| Command | Purpose | Ecosystem reference |
|---------|---------|---------------------|
| **list** | Installed plugins, version, enabled state, contributed capabilities | `gh extension list`, `openclaw plugins list` |
| **install** | Copy/link plugin into managed local folder; validate manifest; optionally prompt trust | `gh extension install`, krew `--manifest --archive` |
| **enable / disable** | Toggle without deleting files; preserve config | OpenClaw `plugins enable/disable` |
| **uninstall / remove** | Delete installed copy; clean config references | `gh extension remove` |
| **inspect** | Show manifest, paths, permissions, contributed tools | `openclaw plugins inspect` |
| **doctor** | Diagnostics: broken manifests, stale config ids, duplicate tool names, missing deps, allowlist drift | `openclaw plugins doctor`, `openclaw doctor --fix` |
| **validate** (author) | Check manifest + layout without loading runtime | `claude plugin validate` |

**Install flow (table stakes):**

```
install source → resolve to local folder (~/.rlm/plugins/<id> or project ./extensions/)
              → read manifest (no code exec)
              → validate schema + engines + duplicate ids
              → trust gate (allowlist / interactive approve)
              → write plugins registry + update rlm.config.yaml entries
              → enable (optional flag)
```

**Remote fetch (RLM-specific, secondary):** Download archive or git ref into the same local layout, then run the identical manifest/trust/enable path. No marketplace, no remote execution (per `remote-plugin-fetch-to-local-folder.md` seed).

### Adapter boundary enforcement

Two complementary mechanisms:

1. **Directory taxonomy** — `src/plugins/builtin/*` for first-party registration packages; `src/adapters/*` for port implementations; `src/runtime/interop/` for MCP/skill wiring (v1.7 runtime/interop split).
2. **dependency-cruiser ratchet** — v1.6 established warn-severity rules (`domain→ports`, no `ports→application`, etc.). v1.7 completes ARCH-02: ratchet known violations to **error**, add rules as needed (`application→adapters` only via bootstrap/composition; `plugins→adapters` allowed; `adapters→plugins` forbidden).

Static enforcement prevents taxonomy from decaying under new tool additions.

---

## Table Stakes

Features users and contributors expect. Missing any of these makes v1.7 feel incomplete relative to the milestone goal and prior v1.1 extension investment.

| Feature | Why expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Plugin manifest schema** | Operators and doctor need metadata without executing code | MED | `rlm.plugin.json` (or equivalent) at plugin root: `id`, `name`, `version`, `category`, `contributes`, `configSchema`, `engines.rlm` |
| **Stable plugin id + version** | Enable/disable, doctor, and config reference a durable identity | LOW | Id distinct from contributed tool names; version for upgrade/doctor messaging |
| **Category taxonomy** | Built-in tools grouped by concern (shell, files, web); externals discoverable | MED | Aligns with seed layout `src/plugins/builtin/{shell,files,web}/`; extensible enum |
| **Built-in plugins use same contract as external** | v1.1 D-06 promise; no special-case loader forever | MED | Migrate `src/extensions/tools/*.extension.ts` → `src/plugins/builtin/*/register.ts`; bootstrap calls unified discovery |
| **`plugins list`** | See what is installed, enabled, and where it lives | LOW | `--json` for scripting; show contributed tool/skill/model-host names |
| **`plugins install <local-path>`** | Primary install path per seeds and v1.1 folder story | MED | Copy or symlink into managed dir; validate manifest; reuse existing allowlist/trust gate |
| **`plugins enable` / `plugins disable`** | Toggle without reinstall; preserve operator config | LOW | Config entries stay; runtime skips disabled plugins in bootstrap |
| **`plugins uninstall`** | Remove plugin files and stale config references | MED | Doctor should not leave orphan `extensions.load` entries |
| **Trust gate on first code load** | Product constraint: no silent execution of new code | LOW | **Already built** via `ExtensionHost.loadExternal` + `.rlm-allowlist.json`; extend to plugin-manager install path |
| **`plugins doctor`** | Surface broken installs, stale ids, duplicate registrations, manifest errors | HIGH | Non-zero exit when issues found; align vocabulary with CLI/UI failure states |
| **Manifest validation before `import()`** | Industry standard (OpenClaw blocks config if manifest invalid) | MED | Install and runtime startup fail closed with actionable errors |
| **YAML/config integration** | v1.1 YAML-first discovery (D-01) | MED | Evolve `extensions.load` toward `plugins.entries.<id>` or compatible shim; preserve backward compat for existing projects |
| **Single registration path in bootstrap** | v1.6 BOOT-05 — no duplicate wiring | LOW | **Already built** in `buildRuntimeContext()`; plugin manager writes config consumed by same pipeline |
| **dependency-cruiser ARCH-02 completion** | v1.6 deferred ratchet; milestone explicitly includes boundary enforcement | MED | Warn → error on known violations; fix `ports/extension-port.ts` → application import direction |
| **Contributor-visible taxonomy docs** | AGENTS.md must say where new tools vs adapters go | LOW | Update after directory moves |

---

## Differentiators

Not universally expected in a local CLI, but high value for RLM's graph-first, observable, local-first product. These justify v1.7 as more than a folder shuffle.

| Feature | Value proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **`plugins inspect <id>`** | Deep manifest + effective permissions + contributed capabilities before enable | LOW | Helps operators audit tool surface before graph execution |
| **`plugins doctor --fix`** | Quarantine invalid entries, remove stale config refs, suggest allowlist repairs | HIGH | OpenClaw pattern: disable bad entry, preserve others; explicit `--fix`, never silent |
| **`plugins validate <path>`** | Author-facing CI hook for third-party plugin repos | LOW | No runtime boot; catches wrong manifest path early (lesson from Claude plugin validate) |
| **Capability metadata for agent binding** | Graph expert tool allowlists (v1.5) can reference plugin-declared tool sets | MED | Manifest `contributes.tools[]` feeds list/doctor and optional YAML shorthand |
| **Permission hints in manifest** | Declarative `permissions: [network, shell, filesystem-write]` for doctor/UI review | MED | Does not replace runtime guards (`GuardedShellTool`); aids trust decisions |
| **Remote fetch-to-local** (`install git:…`, `install https://…`) | Install from URL without building a marketplace | HIGH | **Secondary** to local-folder install; fetched artifact becomes local plugin; no exec during fetch |
| **Deterministic install location** | `~/.rlm/plugins/<id>` default; project-local override documented | LOW | Matches seed; simplifies doctor and desktop packaging |
| **Runtime/interop split** | MCP/skill tools separated from adapter taxonomy | MED | Clarifies `runtime/interop/` vs `plugins/`; reduces adapter folder creep |
| **Ratcheted dep-cruiser + plugin path rules** | New rules e.g. `adapters` must not import `plugins`; composition-only `application→adapters` | MED | Makes taxonomy enforceable, not conventional |
| **Unified builtin + external list output** | One `plugins list` shows `@rlm/builtin-shell` and user plugins with source column | LOW | Reinforces single mental model |
| **Config schema validation without boot** | JSON Schema in manifest for plugin-specific settings | MED | Enables future UI settings panel; doctor validates config against schema |

---

## Anti-Features

Explicitly out of scope or harmful for v1.7. Several were considered in seeds or peer products and rejected for RLM.

| Anti-feature | Why avoid | What to do instead |
|--------------|-----------|-------------------|
| **Plugin marketplace / registry UI** | Scope explosion; conflicts with local-first | Remote fetch to local folder only; no curated store in v1.7 |
| **Remote code execution during install/fetch** | Trust and reproducibility risk | Download + unpack + manifest validate only; load on explicit enable/approve |
| **Silent auto-update of plugins** | Violates no-silent-failures product value | `plugins upgrade` as explicit future command; doctor reports available updates only |
| **npm global install as primary path** | Breaks project-local and desktop bundled layouts | Managed `~/.rlm/plugins` or project `./extensions/`; npm spec optional convenience |
| **Plugins replacing core CLI commands** | gh explicitly forbids overriding core commands | Plugins register tools/skills/model hosts only |
| **Collapsing adapters into plugins without taxonomy** | Recreates v1.6 flat `adapters/` grab bag | Plugins register; adapters implement ports under `adapters/` |
| **Cosmetic directory move before responsibility extraction** | v1.6/v1.7 direction: extract then rename | Builtin migration follows clear register modules |
| **In-process sandbox / WASM isolation** | High cost; Node CLI trust model is allowlist + guarded tools today | Document trust model; defer sandbox to future milestone |
| **Enable-by-default for external plugins** | Surprises operators | External disabled until install + approve + enable; builtins may default enabled |
| **Duplicate tool registration without error** | Silent override causes graph/debug confusion | **Already errors** in `ExtensionHost`; doctor should preflight duplicates |
| **Doctor that auto-fixes without `--fix`** | Hides destructive changes | Report by default; repair only with explicit flag |
| **Breaking YAML config without migration shim** | Breaks existing v1.1 projects | Support `extensions.load` during transition or one-release compat layer |
| **UI-only plugin manager (no CLI)** | Desktop/CI must manage plugins headlessly | CLI commands first; UI surfaces can consume same API later |

---

## Feature Dependencies

```
v1.6 bootstrap (buildRuntimeContext) + ExtensionHost
    └── Plugin manifest schema + static validator
            ├── Built-in taxonomy migration (plugins/builtin/)
            ├── plugins list / inspect
            ├── plugins install (local path)
            │       └── Trust gate + allowlist (existing ExtensionHost)
            ├── plugins enable / disable / uninstall
            │       └── Config writer (extensions → plugins entries)
            └── plugins doctor
                    └── Manifest validator + registry scan + bootstrap dry-check

plugins install (local) stable
    └── Remote fetch-to-local (git/url/archive)
            └── Same manifest/trust/enable pipeline

Plugin taxonomy directories defined
    └── dependency-cruiser ARCH-02 ratchet (new path rules + fix violations)

Runtime/interop split (MCP, skill tools)
    └── Optional: interop as plugin category metadata
            (can parallelize with plugin manager if bootstrap order preserved)
```

### Dependency on existing extension host

| Existing capability | v1.7 reuse |
|---------------------|------------|
| `ExtensionHost` parallel registries (tools, skillLoaders, modelHosts) | Plugin `register(host)` entry unchanged |
| `loadBuiltins()` / `loadExternal()` | Plugin manager populates paths/config that bootstrap loads |
| `.rlm-allowlist.json` SHA-256 path keys | Install/approve flows call `preApprove` or equivalent |
| `extensions.load` in `rlm.config.yaml` | Evolve to plugin entries; manager CLI writes this |
| `createToolsResolver` + agent tool allowlists | Contributed tool names from manifest feed doctor/list |
| `buildRuntimeContext()` init order | Plugin enable/disable must not reorder extensions → interop → resolver |

**Critical path:** Manifest schema + local install + list + enable/disable + doctor (local only) form the MVP. Remote fetch, `--fix` doctor, and full ARCH-02 error severity can follow once local flows are stable (per remote-fetch seed trigger condition).

---

## MVP Recommendation

### Prioritize (v1.7 core)

1. **Plugin manifest + category taxonomy** — static schema, builtin categories (shell, files, web).
2. **Built-in migration to `plugins/builtin/`** — same `register(host)` contract, unified discovery.
3. **`rlm plugins list`** — enabled state, id, version, category, contributed tools.
4. **`rlm plugins install <path>`** — local folder, manifest validate, trust gate, config update.
5. **`rlm plugins enable` / `disable` / `uninstall`** — config-backed lifecycle.
6. **`rlm plugins doctor`** — manifest errors, stale config, duplicates, missing paths; non-zero exit on failure.
7. **ARCH-02 dependency-cruiser ratchet** — error severity on triaged violations + plugin/adapter path rules.

### Add after core (still v1.7 if capacity)

- **`plugins inspect`** and **`plugins validate`** (author tooling).
- **`plugins doctor --fix`** — quarantine bad entries, prune stale config.
- **Remote fetch-to-local** (`git:`, `https://` archive) into `~/.rlm/plugins/<id>`.
- **Permission hints** and config schema in manifest.
- **Runtime/interop directory split** with interop category in taxonomy.

### Defer (post–v1.7)

- Plugin marketplace, signed plugins, auto-update channel.
- UI plugin manager panel (consume control-server API once CLI stable).
- WASM/subprocess sandbox for third-party plugins.
- `plugins upgrade` with semver resolution.

---

## Complexity Summary

| Area | Overall effort | Risk |
|------|----------------|------|
| Manifest + taxonomy | Medium | Schema churn if rushed; lock minimal fields first |
| Builtin migration | Medium | Behavior regression if bootstrap order breaks |
| CLI plugin manager (local) | Medium–High | Many commands but shared install core |
| Doctor | High | Must align with product error vocabulary; avoid false positives |
| Remote fetch | High | Security, partial downloads, offline doctor states |
| ARCH-02 dep-cruiser | Medium | Fix import direction in ports/application without feature creep |

---

## Sources

| Source | Confidence | Used for |
|--------|------------|----------|
| `.planning/PROJECT.md` (v1.7 milestone) | HIGH | Scope, target features, decisions |
| `.planning/notes/architecture-boundary-cleanup-direction.md` | HIGH | Plugin vs adapter definitions, directory target |
| `.planning/seeds/first-class-plugin-taxonomy-for-future-tools.md` | HIGH | Category layout, constraints |
| `.planning/seeds/remote-plugin-fetch-to-local-folder.md` | HIGH | Remote fetch scope boundaries |
| `.planning/milestones/v1.6-REQUIREMENTS.md` (ARCH-02 deferred) | HIGH | Boundary enforcement completion |
| `src/application/extension-host.ts`, `build-runtime-context.ts` | HIGH | Existing capabilities and init order |
| `.planning/milestones/v1.1-phases/06-extension-and-plugin-foundation/` | HIGH | Trust model, YAML-first, parallel registries |
| [OpenClaw plugin manifest](https://docs.openclaw.ai/plugins/manifest) | MEDIUM | Static manifest before code load; doctor/fix patterns |
| [OpenClaw CLI plugins](https://docs.openclaw.ai/cli/plugins) | MEDIUM | install/enable/disable/list/doctor command set |
| [VS Code extension manifest](https://code.visualstudio.com/api/references/extension-manifest) | MEDIUM | categories, contributes, capabilities metadata |
| [GitHub CLI extensions](https://cli.github.com/manual/gh_extension) | MEDIUM | install/list/remove; local `.` install; no enable/disable |
| [krew developer guide](https://github.com/kubernetes-sigs/krew/blob/master/docs/DEVELOPER_GUIDE.md) | MEDIUM | Manifest + local `--manifest --archive` install |
| KickJS / plugin architecture articles | LOW | Adapter wraps legacy; plugin is distribution bundle |

---
*Feature research for: v1.7 Adapter & Plugin Taxonomy — plugin manager and boundary enforcement*  
*Researched: 2026-05-22*
