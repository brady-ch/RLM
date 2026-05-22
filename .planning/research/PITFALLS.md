# Domain Pitfalls

**Domain:** Adding plugin taxonomy, plugin manager UX, runtime/interop split, and dependency-cruiser enforcement to an existing TypeScript agentic CLI + control-server UI  
**Milestone:** v1.7 — Adapter & Plugin Taxonomy  
**Researched:** 2026-05-22  
**Confidence:** HIGH for repo-specific pitfalls (live wiring in `build-runtime-context.ts`, `extension-host.ts`, `dependency-cruiser-baseline.json`, v1.6 audit ARCH-02); MEDIUM for ecosystem plugin patterns (Node.js dynamic import, manifest loaders — verified against Node.js docs and v1.1 extension research)

## Critical Pitfalls

Mistakes that cause rewrites or major regressions when extending the existing system.

### Pitfall 1: Cosmetic Taxonomy Move Before Responsibility Extraction

**What goes wrong:**
Built-in tools are moved from `src/adapters/tools/` + `src/extensions/tools/` to `src/plugins/builtin/` in one directory shuffle. `WebFetchTool` still imports `application/content-tree.ts` (today’s baselined `no-adapters-to-application` violation). `buildRuntimeContext()` still statically imports four extension modules. The milestone looks “done” on paper but layering debt, init order, and adapter/plugin confusion remain.

**Why it happens:**
Folder renames feel like quick wins and satisfy taxonomy diagrams. The architecture-boundary-cleanup direction explicitly says **responsibility extraction first, directory taxonomy second** — teams skip step one under milestone pressure.

**Consequences:**
- New `plugins/` tree still violates the same dependency edges under new paths
- Reviewers cannot tell plugin boundary from adapter boundary
- Follow-on plugin manager work loads from three homes (`adapters/`, `extensions/`, `plugins/`)

**Prevention:**
Extract shared policy (`content-tree`, tool guard helpers) to domain or a neutral `application/` helper **before** moving files. Move one built-in plugin category per slice with `npm run check` green. Delete old paths only when imports and tests point exclusively at the new home.

**Detection:**
- Diff is mostly `git mv` with unchanged import graphs
- `depcruise:ci` baseline count unchanged or grows
- Grep shows tool implementations still under `src/adapters/tools/`

**Phase to address:** Phase 1 — Runtime/interop split and policy extraction (before plugin taxonomy moves)

---

### Pitfall 2: Plugin vs Adapter Boundary Collapse

**What goes wrong:**
New tools land in `src/adapters/tools/` “because that’s where the others are,” or external plugins ship adapter classes that application code imports directly. `adapters/` becomes a mixed grab bag of Ollama hosts, file stores, tracing, and tool implementations — the exact failure mode the v1.7 milestone exists to prevent.

**Why it happens:**
Today’s layout still has **dual homes**: implementations in `adapters/tools/`, registration shims in `extensions/tools/`, wired inline in `buildRuntimeContext()`. Without an enforced rule, contributors follow the nearest precedent.

**Consequences:**
- Plugin manager installs packages that core code treats as first-party adapters
- Dependency-cruiser rules cannot distinguish infrastructure from capability
- External plugin API docs contradict repo layout

**Prevention:**
Codify the decision table from PROJECT.md and architecture-boundary notes:
- **Port** — contract (`ToolPort`, `LanguageModelPort`)
- **Adapter** — core runtime infrastructure implementation (models, persistence, tracing)
- **Plugin** — registration/distribution package (manifest + `register(host)` + optional adapters)
- **Application** — resolves configured capabilities; never imports external plugin modules by path

Add a depcruise rule: `adapters/tools` must not gain new files after taxonomy lands; new capabilities go through `plugins/`.

**Detection:**
- PR adds files under `src/adapters/tools/`
- Application handlers import from `~/.rlm/plugins/...` instead of registry lookup
- Plugin manifest missing while tool class merged into adapters

**Phase to address:** Phase 2 — First-class plugin taxonomy and built-in migration

---

### Pitfall 3: Flag-Day Dependency-Cruiser Error Severity

**What goes wrong:**
All forbidden rules flip from `warn` to `error` while three baselined violations remain (`domain/agents.ts` → `project-config`, `ports/extension-port.ts` → `extension-host`, `web-fetch-tool` → `content-tree`). CI blocks every PR until a large fix lands, or developers `--no-verify` / delete the baseline without fixing root causes.

**Why it happens:**
ARCH-02 deferred from v1.6 with explicit “ratchet toward error” intent. Teams interpret that as “flip severity in `.dependency-cruiser.js`” instead of **fix violation → shrink baseline → then ratchet**.

**Consequences:**
- Milestone stalls on layering fixes unrelated to plugin UX
- Baseline file removed, hiding regressions (worse than warn + baseline)
- Type-only imports mistaken as “harmless” while blocking error severity

**Prevention:**
Per violation: (1) fix import direction, (2) regenerate baseline with one fewer entry, (3) only then consider rule-level error for that edge class. For `extension-port.ts`, introduce a **registration callback type** in `ports/` that does not import `ExtensionHost` (e.g. `ExtensionRegistrar` interface with structural typing). For `domain/agents.ts`, move `AgentConfig` to `domain/types.ts` or `application/config/types.ts` consumed by domain as a type-only boundary. For `web-fetch-tool`, move `content-tree` to domain or shared application utility **before** plugin move.

Keep `--ignore-known dependency-cruiser-baseline.json` until baseline is empty; then remove ignore-known and set severity `error`.

**Detection:**
- PR changes rule severity with unchanged baseline file
- Baseline deleted in same PR as plugin features
- New violations appear but CI still green (baseline masking)

**Phase to address:** Phase 1–2 — Fix each ARCH-02 edge; Phase 3 — Ratchet to error when baseline empty

---

### Pitfall 4: Parallel Plugin Loading Paths

**What goes wrong:**
The product ends up with **YAML `extensions.load`** (v1.1 `ExtensionHost.loadExternal`), **static built-in registration** in `buildRuntimeContext()`, **plugin manager install dir** (`~/.rlm/plugins/<id>/`), and **interop tools** registered separately — each with different allowlist, enable/disable, and error vocabulary. Users install via `rlm plugin install` but agents still require manual YAML edits; or plugins load twice under different names.

**Why it happens:**
Plugin manager is added as a new subsystem instead of becoming the **single discovery surface** that feeds `ExtensionHost`. Existing config paths are left for “backward compat” without a merge strategy.

**Consequences:**
- CLI `doctor` reports healthy while UI session missing tools
- Duplicate tool registration or silent override (partially mitigated today by `registerUnique` throw)
- Remote-fetched plugins use different layout than local-folder plugins

**Prevention:**
One pipeline documented and tested:

```
discover manifests (builtin dir + user plugin dir + optional YAML legacy)
  → validate manifest (no execute)
  → resolve enabled set (config + persisted enablement)
  → allowlist / approval gate
  → dynamic import entry
  → ExtensionHost.register
```

YAML `extensions.load` should migrate to manifest references or be implemented as a thin alias that writes/reads the same plugin registry store — not a second loader.

**Detection:**
- `extensionHost.loadExternal` and new `PluginLoader.load` both called from bootstrap
- Install path not reflected in agent tool resolution
- Two allowlist files (`.rlm-allowlist.json` vs plugin store)

**Phase to address:** Phase 4 — Local plugin manager UX (design registry merge before UI)

---

### Pitfall 5: Plugin Manager UX Diverges from Runtime Truth

**What goes wrong:**
Control-server routes expose plugin list/install state that is **not** the same object graph `buildRuntimeContext()` uses. UI shows “enabled” while runtime never loaded the plugin; or install succeeds but requires full process restart with no indication. Desktop Tauri shell and headless CI take different code paths.

**Why it happens:**
v1.6 deliberately kept `ExtensionHost` construction in bootstrap, not in route handlers — but plugin manager tempts handlers to own filesystem and spawn subprocesses. UI is built before CLI parity (no `ui/` references to plugins today).

**Consequences:**
- Violates “no silent failures” — UI state lies
- `rlm ui` vs `rlm agent` tool sets diverge
- Plugin operations work in TTY CLI but fail in control-server JSON API

**Prevention:**
Introduce an application-layer `PluginRegistryService` (or extend bootstrap context) that owns disk layout + enablement + validation. Control-server handlers and CLI subcommands call the **same service**; neither dynamically imports plugins except through bootstrap refresh policy (explicit restart or documented hot-reload scope). Return structured errors aligned with existing ERRO vocabulary.

**Detection:**
- `control-server/handlers/` imports `node:fs` for plugin dirs directly
- UI tests pass while bootstrap integration test never loads installed plugin
- Install API returns 200 but `toolsFor("default")` unchanged without restart notice

**Phase to address:** Phase 4 — Local plugin manager UX; Phase 5 — Remote fetch (same service)

---

### Pitfall 6: Executing Plugin Code During Fetch or Validate

**What goes wrong:**
Remote fetch or `plugin doctor` runs `import()` on the entry file to “see if it loads.” Malicious or broken packages execute top-level side effects (network calls, filesystem writes) before user approval — violating the seed constraint: **do not execute code during fetch or validation**.

**Why it happens:**
Dynamic languages encourage “just import it” validation. Developers reuse `ExtensionHost.loadExternal` for verification.

**Consequences:**
- Supply-chain attack surface during `plugin install`
- Doctor crashes on missing dependency at import time instead of reporting manifest issues
- Approval gate bypassed for “inspect only” flows

**Prevention:**
Validate **manifest schema only** (JSON/YAML + Zod): id, version, entry path, capabilities, permissions, core compatibility. Optionally parse entry with `node --check` or acorn/typescript transpile **without execution**. Run `import()` only after allowlist approval on explicit enable/load, same as v1.1 extension host. Remote fetch: download → hash → unpack to staging → manifest validate → user review → atomic move to `~/.rlm/plugins/<id>/`.

**Detection:**
- `doctor` or `install --dry-run` appears in strace/node debug to load entry module
- Fetch from URL followed immediately by tool registration in same command
- Tests use real extension import for manifest validation

**Phase to address:** Phase 4 — Local manager; Phase 5 — Remote fetch (staging semantics)

---

### Pitfall 7: Breaking Existing Extension Config Without Migration

**What goes wrong:**
Projects with `extensions.load` entries in `rlm.config.yaml` (v1.1 path) stop loading after plugin taxonomy ships. Users see agents lose tools with generic “extension not found” errors.

**Why it happens:**
New manifest format replaces `{ path, agents }` entries without a compatibility shim or migration command.

**Consequences:**
- Breaks “Compatibility: preserve existing CLI workflows” constraint
- Support burden on early adopters who already use external extensions

**Prevention:**
Support legacy YAML entries for at least one milestone via adapter that normalizes to plugin manifest shape. Add `rlm plugin migrate` or config-loader warning with actionable fix. Integration test: fixture project with v1.1 extension layout still runs.

**Detection:**
- `ExtensionRegistryEntry` removed from config schema without deprecation
- No test loads `./extensions/my-tool.js` from config dir
- CHANGELOG says “update all configs” with no shim

**Phase to address:** Phase 2 — Taxonomy; Phase 4 — Manager UX

---

## Moderate Pitfalls

### Pitfall 8: Runtime/Interop Split That Duplicates Composition

**What goes wrong:**
Extracting `src/runtime/composition/` and `src/runtime/interop/` copies `buildRuntimeContext()` logic into new modules but leaves the old bootstrap imports — or splits MCP/skill wiring so CLI loads interop tools twice. `mcp-skill-runtime.ts` and `interop-runtime.ts` become rival entrypoints.

**Why it happens:**
Architecture diagram shows new folders; extractors create parallel builders instead of **moving** ownership.

**Prevention:**
Single exported `buildRuntimeContext()` remains the composition root. Interop module exports `createInteropTools()` and `McpSkillRuntime` factory only; bootstrap calls them once. Deprecate direct imports from old paths via re-exports for one phase, then delete.

**Phase to address:** Phase 1 — Runtime/interop split

---

### Pitfall 9: Fixing Layer Violations by Introducing Barrel Cycles

**What goes wrong:**
To fix `ports/extension-port.ts` importing `ExtensionHost`, a `src/application/index.ts` barrel re-exports everything and ports import from it — creating `ports → application → ports` cycles or hidden runtime coupling.

**Prevention:**
Define minimal callback types in `ports/plugin-port.ts` (registration surface as interface). `ExtensionHost` implements it in application. No barrel files crossing layers.

**Phase to address:** Phase 1 — ARCH-02 fixes; Phase 3 — Cruiser ratchet

---

### Pitfall 10: Manifest Schema Without Versioning and Capability Taxonomy

**What goes wrong:**
Plugin manifests list tool names as flat strings with no categories (`filesystem`, `network`, `shell`), no `apiVersion`, and no permission declarations. Doctor cannot advise; UI cannot group; future sandboxing requires breaking manifest changes.

**Prevention:**
Ship `manifestVersion: 1` with typed capability blocks aligned to seed taxonomy (`tools`, optional `modelHosts`, `skillLoaders`). Document additive-only evolution. Validate unknown fields warn, not strip silently.

**Phase to address:** Phase 2 — Plugin taxonomy

---

### Pitfall 11: Enable/Disable Semantics Split Across Stores

**What goes wrong:**
Enablement lives in `rlm.config.yaml`, a JSON state file under `~/.rlm/`, and in-memory session — they desync. Disabling a plugin in UI leaves YAML `extensions.load` entry active for CLI.

**Prevention:**
One authoritative enablement store (project-local or user-global — pick one default, document override). Config references plugins by id; enablement is data, not duplicate path lists.

**Phase to address:** Phase 4 — Local plugin manager

---

### Pitfall 12: Remote Fetch Treated as Remote Execution

**What goes wrong:**
`rlm plugin install <url>` clones a repo and runs `npm install && npm run build` inside the plugin, executing arbitrary install scripts. Or plugin loads directly from `/tmp` without moving to installed layout.

**Prevention:**
Fetch to staging → verify checksum/size → manifest validate → user confirm → copy to `~/.rlm/plugins/<plugin-id>/` → same enable flow as local folder. No `npm install` in v1.7 unless explicitly scoped with user consent and sandbox discussion deferred.

**Phase to address:** Phase 5 — Remote fetch (after local flows stable per seed trigger)

---

### Pitfall 13: Dependency-Cruiser Scope Blindness for New Layers

**What goes wrong:**
New `src/plugins/` and `src/runtime/` paths have no forbidden rules; plugins import `application/execution-controller` or `domain/recursive-language-model` directly. Baseline ignore-known hides new violations because developers regenerate baseline mechanically.

**Prevention:**
Add rules when folders are created:
- `plugins → application` forbidden (except via host callback at load time)
- `plugins → domain` forbidden
- `runtime/composition` may import application; `runtime/interop` may not import control-server

Review baseline diffs in PR checklist — baseline may only shrink unless justified.

**Phase to address:** Phase 2 — Taxonomy; Phase 3 — Cruiser ratchet

---

## Minor Pitfalls

### Pitfall 14: Tool Name Collisions Across Builtin, Interop, and External Plugins

**What goes wrong:**
MCP server registers `web_search` while built-in plugin uses the same name; error is thrown at load time (good) but UI shows cryptic startup failure for entire session.

**Prevention:**
Manifest validation at discover time checks collisions against builtin + interop reserved names; doctor reports conflicts before runtime bootstrap.

**Phase to address:** Phase 4 — Doctor command

---

### Pitfall 15: Windows Path Regression in Plugin Manager

**What goes wrong:**
Local-folder install works on POSIX but fails on Windows/WSL edge cases because plugin paths skip `pathToFileURL()` — already solved in v1.1 `ExtensionHost` but reintroduced in new loader.

**Prevention:**
Reuse `ExtensionHost` path resolution helpers; one test with mocked Windows absolute paths.

**Phase to address:** Phase 4 — Local manager

---

### Pitfall 16: Doctor Command False Confidence

**What goes wrong:**
`rlm plugin doctor` prints “OK” when manifest parses but entry file missing, core version incompatible, or allowlist not satisfied for CI mode.

**Prevention:**
Doctor checks: manifest schema, entry exists, semver core compatibility, permissions summary, allowlist status, collision scan, optional “dry load” separated from validate-only mode.

**Phase to address:** Phase 4 — Local manager

---

## Phase-Specific Warnings

| Phase topic | Likely pitfall | Mitigation |
|-------------|----------------|------------|
| Runtime/interop split | Init order drift (v1.6 Pitfall 2 recurrence) | Keep single `buildRuntimeContext()`; add composition test for tool load order |
| ARCH-02 fixes | Type-only imports left on wrong layer | Move shared types to domain or config types module |
| Builtin plugin migration | Dual adapters + extensions + plugins | One wave per tool category; delete old paths same PR |
| Cruiser ratchet | Severity flip before baseline empty | Fix-then-shrink baseline; CI fails on baseline growth |
| Plugin manifest | Ad-hoc JSON without version | `manifestVersion` + Zod schema in application |
| Local install UX | Handler-owned filesystem logic | Shared `PluginRegistryService` |
| Enable/disable | YAML + JSON duplicate truth | Single enablement store |
| Control-server API | UI-only plugin routes | CLI subcommands share service; parity tests |
| Remote fetch | npm lifecycle scripts | Fetch/unpack/validate only; no install scripts |
| Legacy extensions | YAML path entries break | Compatibility shim + migration test |
| Desktop/Tauri | Plugin paths relative to packaged cwd | Use same user data dir as CLI (`~/.rlm/plugins`) |
| Headless CI | Interactive approval hang | `interactive: false` + preApprove in tests; clear error |

---

## Integration Gotchas

| Integration | Common mistake | Correct approach |
|-------------|----------------|------------------|
| **ExtensionHost + plugin manager** | Second registry Map beside ExtensionHost | Manager writes disk state; bootstrap reads manifests → single load into ExtensionHost |
| **createToolsResolver + interop** | Interop tools registered after resolver built | Register builtins → external plugins → interop → then `createToolsResolver` (preserve v1.6 order) |
| **Agent allowlists** | Plugin manifest ignores per-agent tool lists | Preserve `agents: string[]` or map manifest tools to agent profiles in config |
| **Allowlist JSON** | New hash scheme breaks existing approvals | Keep `allowlistKey(absPath)` or migrate with dual-read |
| **Control-server restart** | Install plugin without telling UI to restart session | Return `{ requiresRestart: true }` in API; surface in UI |
| **MCP child cleanup** | Interop split drops `ResourceCleanup.track` | Interop factory still registers MCP kill handlers with cleanup |
| **Config loader** | Plugin ids in YAML without validation | Extend Zod schema; validate references in `validateConfigReferences` |
| **Desktop shell** | Plugin dir under project cwd only | Default user-global `~/.rlm/plugins` per seed; project override documented |
| **Test harness** | Real network fetch in plugin install tests | Mock fetch; use fixture archives in `tests/fixtures/plugins/` |
| **content-tree + web-fetch** | Policy stays in application while tool moves to plugin | Extract analyzer to neutral module before adapter violation fix |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Import before approval on install** | Arbitrary code execution | Manifest-only validate until allowlist approved |
| **Path traversal in plugin id or entry** | Write outside plugin dir | Resolve paths; reject `..`; install only under `<pluginsRoot>/<id>/` |
| **Remote URL without integrity check** | Supply-chain compromise | Require checksum or signed manifest; pin HTTPS |
| **Plugin access to core internals** | Bypass ToolPort guards | Document public extension surface; no exports from `application/` to plugins |
| **Shared allowlist across projects** | Wrong project trusts plugin | Keep config-dir allowlist default; document per-project scope |
| **Doctor executes entry** | Same as import-before-approval | Static validation only |
| **Silent downgrade of permissions** | User approves v1, v2 adds shell | Re-prompt on manifest permission change or version bump |

---

## UX Pitfalls

| Pitfall | User impact | Better approach |
|---------|-------------|-----------------|
| **Install succeeds, tools missing until restart** | Confusion, “broken product” | Explicit restart/session reload prompt |
| **CLI vs UI error vocabulary drift** | Same fault, different messages | Reuse structured error codes from execution events |
| **Doctor false OK** | False confidence before run | Separate validate vs load; list blocking issues |
| **Remote install without permission summary** | User approves opaque package | Show manifest capabilities before enable |
| **Disable plugin mid-session** | Stale tools in running agents | Document behavior: disable applies next bootstrap |
| **YAML-only external plugins** | Power users bypass manager | Manager and YAML converge on same ids/paths |

---

## Recovery Strategies

| Pitfall | Recovery cost | Recovery steps |
|---------|---------------|----------------|
| Cosmetic taxonomy move | MEDIUM | Revert move; extract policy first; one category at a time |
| Parallel loaders | HIGH | Pick canonical pipeline; shim legacy; delete duplicate loader |
| Flag-day cruiser severity | LOW | Restore warn + baseline; fix violations incrementally |
| Import-on-validate | MED–HIGH | Remove import from doctor/install validate; audit call sites |
| UI/runtime desync | MEDIUM | Centralize PluginRegistryService; add bootstrap parity test |
| Broken legacy extensions | LOW | Restore YAML loader shim; migration command |

---

## Pitfall-to-Phase Mapping

Suggested v1.7 phase order (dependency-first). Phase numbers are planning placeholders until ROADMAP is generated.

| Pitfall | Prevention phase | Verification |
|---------|------------------|--------------|
| Cosmetic move before extraction | Phase 1 — Runtime/interop + policy extract | `depcruise` baseline shrinks; no rename-only PRs |
| Runtime/interop duplication | Phase 1 | Single `buildRuntimeContext`; composition test |
| ARCH-02 type import fixes | Phase 1–2 | Each baseline entry removed with test |
| Adapter/plugin collapse | Phase 2 — Taxonomy | No new `adapters/tools`; manifest required |
| Manifest without versioning | Phase 2 | Schema tests; sample builtin manifests |
| Flag-day cruiser error | Phase 3 — Cruiser ratchet | Baseline empty; severity error; no `--ignore-known` |
| New layer scope blindness | Phase 2–3 | depcruise rules for `plugins/`, `runtime/` |
| Parallel loading paths | Phase 4 — Local manager | One loader feeds ExtensionHost |
| Manager/runtime desync | Phase 4 | CLI + API + bootstrap integration test |
| Enablement split stores | Phase 4 | Single enablement source; doctor checks |
| Execute on fetch/validate | Phase 4–5 | Install/doctor tests assert no import |
| Legacy YAML break | Phase 2–4 | v1.1 extension fixture still loads |
| Remote execution confusion | Phase 5 — Remote fetch | Staging dir tests; no npm lifecycle |
| Windows path regression | Phase 4 | pathToFileURL unit test |
| Tool name collisions | Phase 4 | Doctor collision report test |

---

## Sources

- RLM `.planning/PROJECT.md` — v1.7 milestone scope, plugin vs adapter decision, ARCH-02 revisit
- RLM `.planning/notes/architecture-boundary-cleanup-direction.md` — extraction-before-taxonomy sequence
- RLM `.planning/milestones/v1.6-MILESTONE-AUDIT.md` — ARCH-02 tech debt, three baselined violations
- RLM `.planning/seeds/first-class-plugin-taxonomy-for-future-tools.md` — candidate taxonomy, constraints
- RLM `.planning/seeds/remote-plugin-fetch-to-local-folder.md` — no execute on fetch, local-after-download
- RLM `src/application/bootstrap/build-runtime-context.ts` — builtin, external, interop registration order
- RLM `src/application/extension-host.ts` — allowlist, dynamic import, duplicate registration throw
- RLM `src/ports/extension-port.ts` — ports→application violation (ARCH-02)
- RLM `src/domain/agents.ts` — domain→application type import (ARCH-02)
- RLM `dependency-cruiser-baseline.json` — three known violations
- RLM `.planning/milestones/v1.1-phases/06-extension-and-plugin-foundation/06-RESEARCH.md` — extension pitfalls (Windows URL, import-before-approval, hybrid migration)
- [dependency-cruiser CLI — baseline and ignore-known](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md) — ratchet strategy (HIGH)
- [Node.js Permissions / policy](https://nodejs.org/docs/latest-v21.x/api/permissions.html) — integrity and import boundaries (MEDIUM; experimental for hard sandbox)

---
*Pitfalls research for: v1.7 Adapter & Plugin Taxonomy — extending existing RLM extension architecture*  
*Researched: 2026-05-22*
