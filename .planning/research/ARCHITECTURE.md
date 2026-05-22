# Architecture Patterns

**Domain:** Local recursive LM CLI + control-server UI — plugin taxonomy, runtime/interop split, boundary enforcement  
**Milestone:** v1.7 — Adapter & Plugin Taxonomy  
**Researched:** 2026-05-22  
**Confidence:** HIGH (grounded in live `src/` layout post-v1.6, `architecture-boundary-cleanup-direction.md`, dependency-cruiser baseline, and bootstrap composition code)

## Executive Summary

v1.7 extends the v1.6 layered architecture rather than replacing it. The repo already has the right conceptual split — ports define contracts, adapters implement I/O, application orchestrates use cases, domain holds recursion policy — but **three concepts are conflated today**: (1) core infrastructure adapters (persistence, model hosts), (2) tool implementations (`adapters/tools/*`), and (3) registration/distribution packages (`extensions/tools/*.extension.ts` + `ExtensionHost`). v1.7 makes that third concept first-class as **plugins**, reserves `src/adapters/` for runtime infrastructure only, and moves composition/interop wiring out of overloaded `application/` modules into `src/runtime/`.

Integration follows the two-pass rule from `architecture-boundary-cleanup-direction.md`: **extract responsibilities first, rename directories second**. Boundary enforcement (ARCH-02) runs in parallel with extractions — fix the three baseline violations, then ratchet dependency-cruiser from `warn` to `error`. The plugin manager is an **application + control-server surface** over a **runtime plugin loader**; it does not execute remote code or replace `ExtensionHost`.

Primary data flow is unchanged at the domain boundary: CLI/UI → `buildRuntimeContext()` → application runners → `RecursiveLanguageModel` → ports → adapters. What changes is **where** plugins are discovered, **how** manifests describe capabilities, and **which modules** may import which layers.

---

## Recommended Architecture

### System Overview (Post-v1.7 Target)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Entry & I/O                                                                │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐  │
│  │ index.ts    │  │ cli/run-modes│  │ ui/ + control-server handlers    │  │
│  │ (thin)      │  │ + plugin CLI │  │ + plugin manager API             │  │
│  └──────┬──────┘  └──────────────┘  └──────────────┬───────────────────┘  │
├─────────┴────────────────────────────────────────────┴──────────────────────┤
│  Application orchestration (src/application/)                               │
│  ┌────────────────┐ ┌─────────────────┐ ┌────────────────────────────────┐  │
│  │ execution-*    │ │ graph-planner/  │ │ plugin-manager *               │  │
│  │ agent-runner   │ │ executor        │ │ (install/enable/list/doctor) │  │
│  │ workflow-runner│ │ control-server  │ │ config merge for plugins.load  │  │
│  └────────┬───────┘ └────────┬────────┘ └───────────────┬────────────────┘  │
├───────────┴────────────────────┴─────────────────────────┴──────────────────┤
│  Runtime layer (src/runtime/) * NEW                                         │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ composition/                │  │ interop/                             │  │
│  │ build-runtime-context       │  │ mcp-skill-runtime, interop-runtime   │  │
│  │ extension-host, plugin-loader│ │ skill/MCP tool factories             │  │
│  │ runtime-composition (tools/  │  └──────────────────────────────────────┘  │
│  │   model factories)          │                                            │
│  └──────────────┬──────────────┘                                            │
├─────────────────┴──────────────────────────────────────────────────────────┤
│  Plugins (src/plugins/) * NEW          │  Domain (src/domain/)               │
│  ┌─────────────────────────────┐     │  recursion policy, agent profiles   │
│  │ builtin/<category>/<id>/    │     │  (AgentConfig types moved here)     │
│  │ manifest + register()       │     └─────────────────────────────────────┘
│  └─────────────────────────────┘                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│  Ports (src/ports/)              │  Adapters (src/adapters/) — infra only  │
│  ToolPort, ExtensionHostPort *,  │  persistence/, models/, tracing/        │
│  PluginManifest *, PluginLoaderPort *│  (tool impls live in plugins)       │
└──────────────────────────────────┴──────────────────────────────────────────┘

* = new or substantially moved in v1.7
```

### Layer Definitions (v1.7 Contract)

| Concept | Owns | Does not own |
|---------|------|--------------|
| **Port** | Interface contracts (`ToolPort`, store ports, `ExtensionHostPort`, `PluginManifest`) | Registration, filesystem, HTTP |
| **Adapter** | Core runtime infrastructure I/O (file stores, Ollama/HTTP model hosts, trace sinks) | Plugin manifests, agent YAML resolution |
| **Plugin** | Registration package: manifest + `register(host)` + bundled adapter(s) + capability metadata | Session/graph policy, recursion |
| **Runtime** | Composition root wiring: discover plugins, build interop tools, populate `ExtensionHost`, produce `RuntimeContext` | Business use cases (plan, approve, execute) |
| **Application** | Use cases, plugin manager UX, config merge, control-server transport | MCP stdio protocol, allowlist file I/O details |
| **Domain** | Recursion policy, shared config shapes used by domain (`AgentConfig`, agent profiles) | Extension loading, tool I/O |

---

## Component Boundaries

| Component | Layer | Responsibility | Communicates with |
|-----------|-------|----------------|-------------------|
| `PluginManifest` / taxonomy types | Ports | Category, capabilities, permissions, version schema | Config validation, plugin loader |
| `ExtensionHostPort` | Ports | Tool/skill/model-host registration API (interface only) | `ExtensionHost` impl, plugin `register()` |
| `ExtensionHost` | Runtime/composition | In-memory registries, duplicate detection, external load + allowlist | Plugin loader, interop registration |
| `PluginLoader` | Runtime/composition | Discover builtin + configured + installed plugins; invoke `register()` | ExtensionHost, `.rlm/plugins/` catalog |
| `buildRuntimeContext` | Runtime/composition | Ordered init: plugins → interop → tools resolver → registry → models | Application runners via `RuntimeContext` |
| `buildInteropRuntime` | Runtime/interop | MCP client lifecycle, skill discovery, `McpSkillRuntime` events | ExtensionHost, ResourceCleanup |
| `PluginManager` | Application | Install/enable/disable/list/doctor; remote fetch-to-local; config patch | Filesystem, config loader, control-server |
| `plugins/builtin/*` | Plugins | First-party tool plugins (shell, file-write, web-search, web-fetch) | Adapters (tool impl), ExtensionHost |
| `.rlm/plugins/` | Data (project-local) | Installed third-party plugin folders + enablement state | PluginManager, PluginLoader |
| `adapters/persistence|models` | Adapters | Stores, embeddings, language models | Bootstrap/runtime composition only |
| `dependency-cruiser` rules | Build | Layer forbidden arcs; baseline ratchet ARCH-02 | CI `depcruise:ci` |

---

## Patterns to Follow

### Pattern 1: Plugin as Registration Package (Not Adapter)

**What:** A plugin exports `register(host: ExtensionHostPort)` and optionally a manifest; it **contains** adapters but is not synonymous with a single `ToolPort`.  
**When:** Any distributable tool/skill/model-host bundle — builtin or third-party.  
**Example (target shape):**

```typescript
// src/plugins/builtin/tools/web-fetch/manifest.ts
export const manifest: PluginManifest = {
  id: "rlm.builtin.web-fetch",
  category: "tools",
  capabilities: [{ kind: "tool", name: "web_fetch" }],
  permissions: ["network"],
};

// src/plugins/builtin/tools/web-fetch/index.ts
export function register(host: ExtensionHostPort): void {
  host.tools.register(new WebFetchTool());
}
```

**Trade-offs:** (+) Clear install/distribution unit; (+) taxonomy metadata; (−) More files than today's one-line extension shims.

### Pattern 2: Runtime/Interop Split

**What:** Move `interop-runtime.ts`, `mcp-skill-runtime.ts`, and interop portions of `build-runtime-context.ts` to `src/runtime/interop/`; keep composition in `src/runtime/composition/`.  
**When:** Modules mix MCP stdio protocol, skill path scanning, and agent registry wiring.  
**Trade-offs:** (+) Application stops owning transport protocols; (+) interop testable in isolation; (−) import path migration across bootstrap callers.

**Init contract (preserve v1.6 order):**

```
1. ExtensionHost constructed
2. McpSkillRuntime + event sinks
3. PluginLoader.loadBuiltins() + loadConfigured() + loadInstalled()
4. buildInteropRuntime() → interop ToolPort[]
5. Register interop tools on ExtensionHost
6. createToolsResolver(projectConfig, extensionHost, interopTools)
7. Agent registry, model factory, execution control, shutdown
```

### Pattern 3: Bootstrap Facade Re-export

**What:** Keep `application/bootstrap/` as a thin public facade re-exporting `runtime/composition/build-runtime-context`.  
**When:** ~15 call sites import `buildRuntimeContext` from bootstrap today.  
**Trade-offs:** (+) No flag-day import churn for CLI/control-server; (−) Temporary indirection until docs/AGENTS.md migrate.

### Pattern 4: Boundary Violation Fixes Before Ratchet

**What:** Eliminate three baseline violations, shrink baseline to `[]`, set rule severity to `error`.  
**Fixes (verified in repo):**

| Violation | Fix |
|-----------|-----|
| `domain/agents.ts` → `application/project-config` (`AgentConfig`) | Move `AgentConfig` (and related agent config types) to `domain/types.ts` or `domain/agent-config.ts`; config module imports from domain |
| `ports/extension-port.ts` → `application/extension-host` | Define `ExtensionHostPort` interface in ports; `ExtensionHost` class implements it in runtime/composition |
| `adapters/tools/web-fetch-tool.ts` → `application/content-tree` | Move `content-tree` helpers to `adapters/tools/content-tree.ts` or `domain/content-analysis.ts` (pure functions, no application imports) |

**Additional hardening (not in baseline but violates AGENTS.md intent):** Route application adapter imports through `bootstrap/adapters.ts` only — extend depcruise with `no-application-to-adapters` once `agent-runner`, `runtime-composition`, and control-server types stop deep-linking `adapters/index.js`.

### Pattern 5: Plugin Manager as Config + Catalog Authority

**What:** `PluginManager` writes to `.rlm/plugins/<id>/` and updates `rlm.config.yaml` `extensions.load` (or successor `plugins.enabled` block). Runtime reads catalog on next `buildRuntimeContext`.  
**When:** Install, enable, disable, doctor, remote fetch-to-local.  
**Trade-offs:** (+) No hot-reload complexity in v1.7; (+) explicit config diff; (−) Requires restart or session rebuild to pick up changes (document in UX).

---

## Data Flow

### Runtime Startup (Plugin Load Path)

```
CLI/UI start
    ↓
loadProjectConfig (application/config)
    ↓
buildRuntimeContext (runtime/composition)
    ↓
PluginLoader
    ├─ scan src/plugins/builtin/** (compile-time bundled)
    ├─ read .rlm/plugins/catalog.json (installed, enable flags)
    └─ merge extensions.load from YAML (legacy + explicit paths)
    ↓
For each enabled plugin: validate manifest → dynamic import → register(host)
    ↓
buildInteropRuntime (runtime/interop)
    ├─ createSkillTool(McpSkillRuntime)
    └─ createMcpTools(servers) + cleanup.track(child processes)
    ↓
extensionHost.tools.register(each interop tool)
    ↓
createToolsResolver → createAgentRegistry → createModelFactory
    ↓
RuntimeContext returned to run mode / control-server
    ↓
runConfiguredAgent / GraphExecutor → RecursiveLanguageModel → ToolPort.execute
```

### Plugin Install Flow (Manager UX)

```
User: plugin install <local-path|remote-url>  (CLI or POST /api/plugins/install)
    ↓
PluginManager
    ├─ fetch (if remote) → temp dir → verify checksum/size
    ├─ validate PluginManifest (schema, permissions, capability names)
    ├─ doctor: manifest present, register export, adapter deps, allowlist hint
    └─ copy to .rlm/plugins/<plugin-id>/
    ↓
Update catalog + patch project config (extensions.load or plugins.enabled)
    ↓
Response: success + restart hint (no silent apply to running ExtensionHost)
    ↓
Next buildRuntimeContext picks up plugin via PluginLoader
```

### State Ownership

| State | Owner | v1.7 change |
|-------|-------|-------------|
| Tool registry (runtime) | `ExtensionHost` | Unchanged; populated by PluginLoader + interop |
| Plugin install metadata | `.rlm/plugins/catalog.json` + YAML config | **NEW** — manager writes, loader reads |
| Allowlist hashes | `.rlm-allowlist.json` (config-adjacent) | Keep; manager may pre-approve on install |
| MCP/skill interop events | `McpSkillRuntime` | Move to `runtime/interop/` |
| Agent tool bindings | `createToolsResolver` + YAML `agents.*.tools` | Unchanged semantics; manifest validates tool names |
| Execution graph / approvals | `InteractiveExecutionSession` | Unchanged |

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | v1.7 notes |
|----------|---------------|------------|
| `application/bootstrap` ↔ `runtime/composition` | Re-export `buildRuntimeContext` | Facade during migration |
| `PluginManager` ↔ `application/config` | Read/write YAML fragments | New config fields for plugin taxonomy; preserve validation path context |
| `PluginManager` ↔ control-server | HTTP handlers in `handlers/plugins.ts` | Transport only; delegate to manager |
| `PluginLoader` ↔ `ExtensionHost` | `register()` calls | Replaces inline `loadBuiltins([...])` array in bootstrap |
| `PluginLoader` ↔ ports | Manifest schema, `ExtensionHostPort` | No import of application modules |
| `runtime/interop` ↔ `ResourceCleanup` | MCP child process track/close | Preserve cleanup callback contract from v1.6 |
| `plugins/builtin` ↔ `adapters/tools` | Tool classes imported by plugin index | Tool **implementations** may stay in adapters temporarily; plugin owns registration |
| `dependency-cruiser` ↔ CI | `depcruise:ci --ignore-known baseline` | Ratchet: fix 3 → empty baseline → severity `error` |

### External Services (Unchanged)

| Service | Integration | v1.7 touch |
|---------|-------------|------------|
| Ollama / HTTP models | `adapters/models` via `createModelFactory` | Stay infrastructure adapters |
| MCP servers | `runtime/interop` stdio clients | Module move only |
| Remote plugin URLs | PluginManager fetch-to-local | **NEW** — download only; execution stays local |
| Skill search paths | `interop.skills.searchPaths` in config | Unchanged |

---

## New vs Modified Components

### New Components

| Component | Path | Responsibility |
|-----------|------|----------------|
| `ExtensionHostPort` | `ports/extension-host-port.ts` | Registration interface decoupled from concrete host |
| `PluginManifest` types | `ports/plugin-port.ts` | Taxonomy: id, category, capabilities, permissions, version |
| `PluginLoader` | `runtime/composition/plugin-loader.ts` | Discover/load builtin + installed + configured plugins |
| `buildInteropRuntime` | `runtime/interop/build-interop-runtime.ts` | MCP + skill tool factory bundle |
| `McpSkillRuntime` (relocated) | `runtime/interop/mcp-skill-runtime.ts` | Interop event sequencing (moved from application) |
| `interop-runtime` (relocated) | `runtime/interop/interop-runtime.ts` | MCP stdio client, skill tool (moved from application) |
| `buildRuntimeContext` (relocated) | `runtime/composition/build-runtime-context.ts` | Composition root (moved from application/bootstrap) |
| `ExtensionHost` (relocated) | `runtime/composition/extension-host.ts` | Registry impl (moved from application) |
| Builtin plugins | `plugins/builtin/tools/*` | Manifest + register per built-in tool |
| `PluginManager` | `application/plugin-manager.ts` | Install/enable/list/doctor/fetch |
| Plugin catalog | `.rlm/plugins/catalog.json` | Installed plugin records (runtime data, not src) |
| Control-server plugin routes | `control-server/handlers/plugins.ts` | HTTP surface for manager UX |
| CLI plugin commands | `cli/run-modes/plugin-admin.ts` | `rlm plugin install|list|doctor|...` |
| Depcruise rule | `.dependency-cruiser.js` | Optional `no-application-to-adapters`; severity `error` |
| Tests | `tests/runtime/composition/`, `tests/application/plugin-manager/` | Loader order, manifest validation, manager I/O |

### Modified Components

| Component | Change | Risk |
|-----------|--------|------|
| `application/bootstrap/build-runtime-context.ts` | Thin re-export or delete after move | Low with facade |
| `application/bootstrap/types.ts` | Import paths from runtime/composition | Low |
| `application/runtime-composition.ts` | Move to `runtime/composition/`; model factory may stay co-located | Low |
| `src/extensions/tools/*.extension.ts` | Deprecated; replaced by `plugins/builtin` | Medium — update tests referencing paths |
| `application/config/schema.ts` | Add `plugins` block (category, capabilities) alongside `extensions` | Medium — backward compat |
| `domain/agents.ts` | Import `AgentConfig` from domain, not application | Low |
| `adapters/tools/web-fetch-tool.ts` | Import content-tree from colocated module | Low |
| `ports/extension-port.ts` | Type-only port surface; no application imports | Low |
| `agent-runner.ts`, `control-server/types.ts` | Route adapter types through bootstrap barrel | Medium — depcruise cleanup |
| `AGENTS.md` | Document runtime/, plugins/, manager | Low |
| `dependency-cruiser-baseline.json` | Shrink to `[]` after fixes | Low |

### Explicitly Unchanged (Defer)

| Component | Reason |
|-----------|--------|
| `execution-controller.ts` | Session authority; unrelated to plugin taxonomy |
| `graph-planner.ts`, `graph-executor.ts` | Consume `RuntimeContext.toolsFor`; no plugin awareness needed |
| `domain/recursive-language-model.ts` | Tool execution via `ToolPort` only |
| `ui/src/*` feature logic | Server exposes plugin API; UI consumes endpoints incrementally |
| Remote plugin execution / marketplace | Out of scope per PROJECT.md — fetch-to-local only |

---

## Suggested Build Order

Order follows **responsibility extraction → taxonomy → manager → enforcement**, keeping `npm run check` green after each wave. Critical path: boundary fixes → runtime split → plugin taxonomy → manager → depcruise ratchet.

### Wave 1 — Boundary Violation Fixes (ARCH-02 Prerequisite)

1. Move `AgentConfig` (+ related types) to `domain/agent-config.ts`; update config schema imports.
2. Introduce `ExtensionHostPort` in ports; make `ExtensionHost` implement it; fix `extension-port.ts` import direction.
3. Relocate `content-tree` analysis next to `web-fetch-tool` (adapter-local or domain-pure).
4. Remove fixed entries from `dependency-cruiser-baseline.json`; verify `depcruise:ci` passes.
5. **Depends on:** nothing. **Blocks:** ratchet to error, plugin port definitions.

### Wave 2 — Runtime/Interop Split

1. Create `src/runtime/interop/` — move `mcp-skill-runtime.ts`, `interop-runtime.ts` (+ tests).
2. Extract `buildInteropRuntime()` with same MCP cleanup + skill tool contract.
3. Create `src/runtime/composition/` — move `extension-host.ts`, `runtime-composition.ts`.
4. Move `build-runtime-context.ts` body; leave `application/bootstrap/` as re-export facade.
5. Add composition unit test: plugin/interop registration order, cleanup hooks.
6. **Depends on:** Wave 1 port types. **Blocks:** plugin loader integration.

### Wave 3 — Plugin Taxonomy + Builtin Migration

1. Define `PluginManifest`, categories (`tools`, `skills`, `model-hosts`), capability metadata in ports.
2. Create `plugins/builtin/tools/{shell,file-write,web-search,web-fetch}/` with manifest + register.
3. Implement `PluginLoader`: builtins scan, manifest validation, replace hardcoded `loadBuiltins([...])`.
4. Deprecate `src/extensions/tools/` (delete after parity tests).
5. Extend config schema: optional `plugins.enabled` / manifest references; keep `extensions.load` compat.
6. **Depends on:** Wave 2 `ExtensionHost` location. **Blocks:** manager install paths.

### Wave 4 — Plugin Manager UX

1. Implement `PluginManager` (local-folder install, enable/disable, list, doctor).
2. Add remote fetch-to-local (download, verify, install as local folder — no remote execution).
3. Persist catalog under `.rlm/plugins/`; patch YAML on enable/disable.
4. CLI `plugin-admin` run mode; control-server `handlers/plugins.ts`.
5. Integration tests: install → config update → next `buildRuntimeContext` sees tools.
6. **Depends on:** Wave 3 loader + manifest. **Parallel-safe with:** Wave 5 doc updates.

### Wave 5 — Dependency-Cruiser Ratchet + Application→Adapter Cleanup

1. Set forbidden rule severity to `error` in `.dependency-cruiser.js`.
2. Add `no-application-to-adapters` (or tighten existing rules) once imports centralized in bootstrap.
3. Fix remaining application deep-links (`agent-runner`, `runtime-composition` model adapters → runtime/composition).
4. Remove `--ignore-known` from CI when baseline empty (or keep empty baseline file).
5. Update AGENTS.md contributor map.
6. **Depends on:** Waves 1–4 stable. **Last** enforcement wave.

### Build Order Diagram

```
Wave 1 (boundary fixes) ──→ Wave 5 (depcruise error + app→adapter cleanup)
         │
         └──→ Wave 2 (runtime/interop split)
                    │
                    └──→ Wave 3 (plugin taxonomy + builtins)
                               │
                               └──→ Wave 4 (plugin manager UX)
```

**Parallelization:** Waves 2 and 1 can overlap only on non-conflicting files; prefer sequential 1→2 to avoid port type churn. Wave 4 should not start until `PluginLoader` replaces hardcoded builtins.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Cosmetic Plugin Folder Move Without Loader

**What:** Rename `extensions/` → `plugins/` but keep hardcoded `loadBuiltins([...])` in bootstrap.  
**Why bad:** Taxonomy is theater; manager cannot discover or validate plugins.  
**Instead:** Introduce `PluginLoader` + manifest schema first, then move directories.

### Anti-Pattern 2: Plugin Manager Hot-Reloading ExtensionHost

**What:** Mutate in-memory registries when user clicks Enable in UI.  
**Why bad:** Running sessions hold stale tool references; cleanup/MCP lifecycle races.  
**Instead:** Persist enablement; require rebuild of `RuntimeContext` or explicit session restart.

### Anti-Pattern 3: Adapters Directory as Plugin Dump

**What:** Keep adding tool implementations under `adapters/tools/` for third-party contributions.  
**Why bad:** Recreates the grab-bag v1.7 is eliminating; blurs infra vs distributable tools.  
**Instead:** Third-party tools ship as plugins under `.rlm/plugins/`; adapters hold infra only.

### Anti-Pattern 4: Ratcheting Depcruise Before Fixing Baseline

**What:** Flip severity to `error` while three known violations remain.  
**Why bad:** CI blocks all progress; team bypasses with `--ignore-known` permanently.  
**Instead:** Fix three violations (Wave 1), empty baseline, then ratchet (Wave 5).

### Anti-Pattern 5: Interop in Application After Split

**What:** Add new MCP features to `application/interop-runtime.ts` during migration.  
**Why bad:** Perpetuates overloaded application layer.  
**Instead:** All new interop code lands in `runtime/interop/`; application calls facades only.

### Anti-Pattern 6: Remote Plugin Execution

**What:** Fetch and `import()` directly from URL each run.  
**Why bad:** Supply-chain risk; conflicts with local-first, auditable allowlist model.  
**Instead:** Fetch-to-local folder, manifest + allowlist, then load from disk.

---

## Scalability Considerations

| Concern | At project-local (v1.7) | At 50+ plugins | At multi-package future |
|---------|-------------------------|----------------|-------------------------|
| Plugin discovery | Scan builtins + `.rlm/plugins/` | Cache catalog; lazy import on enable | Package-per-plugin workspace |
| Tool name collisions | `registerUnique` throws at load | Doctor command validates before enable | Namespace prefix in manifest (`publisher.tool`) |
| MCP process count | Configured servers × 1 process | Same; interop runtime owns lifecycle | Optional connection pooling — out of v1.7 |
| Config size | `extensions.load` list | Catalog file + enabled ids in YAML | Dedicated plugins lockfile |
| CI boundary checks | `src/` only | Add `plugins/` path rules when third-party tree grows | dependency-cruiser tags per package |

### Scaling Priorities

1. **First bottleneck:** Hardcoded builtin list in `build-runtime-context.ts` — blocks manager and taxonomy.
2. **Second bottleneck:** Application-owned interop — MCP changes risk composition order regressions.
3. **Third bottleneck:** Three depcruise violations — block enforcement and encode wrong direction for new code.

---

## Research Flags for Roadmap Phases

| Phase topic | Deeper research? | Reason |
|-------------|------------------|--------|
| Plugin manifest schema | Maybe | Align with VS Code/Cursor extension fields only where useful; avoid over-spec |
| Remote fetch security | Yes | TLS, checksum, size limits, zip slip — plan-phase spike before Wave 4 |
| Config migration `extensions` → `plugins` | Unlikely | Barrel compat sufficient for v1.7 |
| UI plugin manager screens | Yes | UI-SPEC in phase if not CLI-only MVP |
| `no-application-to-adapters` scope | Maybe | Enumerate legitimate bootstrap exceptions before rule lands |
| Hot-reload plugins | Defer | Explicitly out of v1.7; document restart semantics |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Layer integration model | HIGH | Matches shipped v1.6 layout + boundary direction note |
| Runtime/interop split targets | HIGH | Files and init order verified in `build-runtime-context.ts` |
| Baseline violation fixes | HIGH | Three edges enumerated in `dependency-cruiser-baseline.json` |
| Plugin manager data flow | MEDIUM | No existing manager code; aligned with PROJECT.md decisions |
| Remote fetch security | MEDIUM | Requires phase-specific threat model |
| Final directory names | MEDIUM | `runtime/` and `plugins/` from direction note; may adjust during execution |

---

## Sources

- `.planning/PROJECT.md` — v1.7 milestone goals, key decisions
- `.planning/notes/architecture-boundary-cleanup-direction.md` — two-pass cleanup, target directories
- `.planning/milestones/v1.6-MILESTONE-AUDIT.md` — ARCH-02 deferred items, 359 tests baseline
- `src/application/bootstrap/build-runtime-context.ts` — current composition + extension/interop order
- `src/application/extension-host.ts` — registry + external load + allowlist
- `src/application/interop-runtime.ts`, `mcp-skill-runtime.ts` — interop candidates for split
- `src/extensions/tools/*.extension.ts` — current builtin registration shims
- `src/ports/extension-port.ts` — port/application violation
- `src/domain/agents.ts` — domain/application type violation
- `src/adapters/tools/web-fetch-tool.ts` — adapter/application violation
- `.dependency-cruiser.js`, `dependency-cruiser-baseline.json` — three known violations
- `AGENTS.md` — v1.6 contributor map (pre-v1.7)

---
*Architecture research for: v1.7 Adapter & Plugin Taxonomy*  
*Researched: 2026-05-22*
