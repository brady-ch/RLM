# Technology Stack — v1.7 Adapter & Plugin Taxonomy

**Project:** Recursive Language Model CLI  
**Domain:** Local-first plugin taxonomy, runtime/interop split, boundary enforcement  
**Researched:** 2026-05-22  
**Confidence:** HIGH for boundary tooling and manifest validation (repo-verified); MEDIUM for remote-fetch transport (standard Node patterns, no RLM implementation yet)

**Scope:** Stack additions/changes **only** for v1.7 — plugin manifests, local-folder install, remote fetch-to-local, runtime/interop module split, dependency-cruiser error ratchet. Existing TypeScript 6, Node ESM CLI, React 19/Vite 7 UI, Tauri shell, Zod/YAML config, `ExtensionHost`, `buildRuntimeContext()`, and dependency-cruiser 17 WARN baseline are **not** re-researched.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Zod** | `^4.4.3` (existing) | `rlm.plugin.json` manifest parse + doctor validation | Already the project config schema stack (`application/config/schema.ts`); one validation dialect for YAML project config and JSON plugin manifests; surfaces actionable errors for CLI/UI doctor |
| **yaml** | `^2.8.4` (existing) | Optional human-authored manifest variant | Same parser as `rlm.config.yaml`; use only if UX needs editable manifests — JSON remains canonical on disk after install |
| **tar** | `^7.5.15` | Extract remote `.tar.gz` / `.tgz` into `~/.rlm/plugins/<id>/` | npm-maintained (`isaacs/node-tar`); battle-tested in npm CLI; supports stream extract with entry filters for path-traversal defense; covers GitHub/GitLab archive URLs and release assets without a git binary |
| **semver** | `^7.8.1` | Manifest `version` + `engines.rlm` compatibility checks | De facto Node semver implementation; doctor can compare installed plugin vs running RLM version and fail with explicit range errors |
| **dependency-cruiser** | `^17.4.0` (existing) | ARCH-02 error ratchet + new `plugins/` / `runtime/` rules | Already in `npm run check`; only **3** baseline violations remain — ratchet `severity: "error"` and burn down baseline rather than adding a second boundary tool |
| **Node built-in `fetch`** | Node `>=20` (existing) | Download remote plugin archives | No `node-fetch`/`axios`; repo already targets Node 20+; fetch is streaming-friendly with `Readable.fromWeb` into `tar.x` |
| **Node built-in `fs/promises`** | Node `>=20` (existing) | Local-folder copy, install layout, registry index | `fs.cp({ recursive: true })` for folder install; `mkdir`/`writeFile` for `~/.rlm/plugins/registry.json` (or equivalent index) |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Node `child_process.spawn`** | built-in | Optional `git clone --depth 1` for repo URLs | When user supplies a git remote and `git` is on PATH; secondary to fetch+tar; no `simple-git` dependency |
| **Node `crypto.createHash`** | built-in (existing in `ExtensionHost`) | Allowlist keys, manifest integrity optional | Reuse existing SHA-256 allowlist pattern from `extension-host.ts`; optional checksum field in manifest later |
| **Node `pathToFileURL` + dynamic `import()`** | built-in (existing) | Load plugin entry after install | Same mechanism as `ExtensionHost.loadExternal`; plugin manager only changes *where* paths come from |
| **tsx** | `^4.21.0` (existing, dev) | Dev iteration on plugin loader/doctor | Keep CI on compiled `dist/`; no runtime dependency |

### Runtime / Interop Split (no new packages)

| Move target | Source today | Purpose |
|-------------|--------------|---------|
| `src/runtime/composition/` | `runtime-composition.ts`, parts of `bootstrap/` | Tool/model factory wiring consumed by `buildRuntimeContext()` |
| `src/runtime/interop/` | `interop-runtime.ts`, `mcp-skill-runtime.ts` | MCP stdio clients, skill discovery, interop tool factories |
| `src/plugins/builtin/` | `src/adapters/tools/*` + `src/extensions/tools/*` shims | Built-in tool plugins with `register.ts` per capability area |
| `src/plugins/external/` | New: loader, manifest, registry, doctor | External/local-folder + fetched plugin lifecycle |

This is a **module move**, not a framework adoption. Keep `ExtensionHost` as the registration surface; bootstrap imports move from `../application/*` to `../runtime/*` and `../plugins/*`.

### dependency-cruiser Ratchet (config change, not a new package)

**Current state (verified):** `.dependency-cruiser.js` uses `severity: "warn"` on 8 ARCH rules; `dependency-cruiser-baseline.json` lists **3** known violations:

- `src/adapters/tools/web-fetch-tool.ts` → `application/content-tree.ts`
- `src/domain/agents.ts` → `application/project-config.ts` (type-only)
- `src/ports/extension-port.ts` → `application/extension-host.ts` (type-only)

**v1.7 target:**

1. Fix the three violations (extract shared types to `ports/` or thin `src/types/`; move `content-tree` helper to domain/ports).
2. Change all `forbidden` rules from `"warn"` → `"error"`.
3. Add rules for new directories:

| Rule | From | To (forbidden) | Rationale |
|------|------|----------------|-----------|
| `no-plugins-to-application` | `^src/plugins/` | `^src/application/` | Plugins register through host ports, not orchestration |
| `no-plugins-to-cli` | `^src/plugins/` | `^src/cli/` | CLI dispatches commands; plugins don't import CLI |
| `no-runtime-to-cli` | `^src/runtime/` | `^src/cli/` | Composition/interop stays below CLI |
| `no-runtime-to-adapters` (optional) | `^src/runtime/` | `^src/adapters/` | Runtime composes via ports + bootstrap adapter boundary |
| `no-builtin-plugin-to-external-loader` | `^src/plugins/builtin/` | `^src/plugins/external/` | Built-ins don't depend on external install machinery |

4. Regenerate baseline with `npx depcruise-baseline src`; **goal is empty baseline** — keep `--ignore-known` only as a short-lived bridge if a phase lands mid-ratchet.
5. `depcruise:ci` stays: `dependency-cruise src --config .dependency-cruiser.js --ignore-known dependency-cruiser-baseline.json` until baseline is deleted.

**Confidence:** HIGH — [dependency-cruiser rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) documents `severity: "error"` for CI fail; `--ignore-known` downgrades baseline entries to `ignore` ([CLI docs](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md)).

### Plugin Manager UX (no new UI stack)

| Surface | Stack | Notes |
|---------|-------|-------|
| Control server handlers | Node `http` (existing) | Add `handlers/plugins.ts` — list/install/enable/disable/doctor/fetch |
| UI panels | React 19 + existing fetch to control-server | No TanStack Query / Zustand unless state complexity proves it; match existing session/graph handler patterns |
| CLI commands | Existing `cli/args.ts` dispatch | `rlm plugin list|install|enable|disable|doctor|fetch` mirroring HTTP API |

---

## Installation

```bash
# New runtime dependencies (v1.7)
npm install tar@^7.5.15 semver@^7.8.1

# Already installed — extend usage, do not reinstall
# zod@^4.4.3 yaml@^2.8.4 dependency-cruiser@^17.4.0 (dev)
```

No changes to UI `package.json` (UI shares root `node_modules` via Vite root config).

Suggested script additions:

```json
{
  "scripts": {
    "depcruise:baseline": "depcruise-baseline src --config .dependency-cruiser.js --output-to dependency-cruiser-baseline.json",
    "depcruise:strict": "dependency-cruise src --config .dependency-cruiser.js",
    "check": "npm run typecheck && npm run lint && npm run format:check && npm run depcruise:strict && npm test"
  }
}
```

Switch `check` to `depcruise:strict` (no `--ignore-known`) once baseline is empty.

---

## Integration with Bootstrap & Extension Host

### Current flow (preserve semantics)

```text
buildRuntimeContext()
  → ExtensionHost.loadBuiltins([{ path, register }, …])
  → ExtensionHost.loadExternal(config.extensions.load, { allowlistPath, interactive })
  → createMcpTools / createSkillTool → extensionHost.tools.register
  → createToolsResolver({ extensionHost, interopTools })
```

### v1.7 flow (same contracts, new discovery)

```text
buildRuntimeContext()
  → PluginRegistry.discover({ builtin: src/plugins/builtin, user: ~/.rlm/plugins, project: .rlm/plugins })
  → for each enabled plugin: validateManifest(zod) → doctor checks → allowlist gate
  → ExtensionHost.loadBuiltins(builtinRegisters)   // static imports for shipped built-ins
  → ExtensionHost.loadExternal(enabledExternal)    // dynamic import from installed paths
  → runtime/interop factories (from src/runtime/interop/)
  → createToolsResolver (from src/runtime/composition/)
```

**Integration points:**

| Component | Change | Library |
|-----------|--------|---------|
| `ExtensionHost` | Keep `loadBuiltins` / `loadExternal` / allowlist; add optional manifest metadata on registry entries | Node built-ins only |
| `extension-port.ts` | Replace `ExtensionHost` type import with port-facing `ExtensionRegistrar` interface to fix ARCH-02 violation | TypeScript only |
| `bootstrap/build-runtime-context.ts` | Import from `runtime/composition` + `runtime/interop`; delegate plugin discovery to `plugins/external/plugin-loader.ts` | — |
| `config/schema.ts` | Extend `extensions.load[]` or add `plugins:` block referencing installed ids | Zod |
| Installed layout | `~/.rlm/plugins/<plugin-id>/rlm.plugin.json` + entry module | fs + semver |

### Manifest shape (Zod, not a new schema stack)

Canonical file: **`rlm.plugin.json`** at plugin root.

```json
{
  "id": "acme.web-tools",
  "name": "ACME Web Tools",
  "version": "1.0.0",
  "engines": { "rlm": "^1.7.0" },
  "entry": "./register.js",
  "capabilities": {
    "tools": ["web_search", "web_fetch"],
    "categories": ["web"]
  },
  "permissions": {
    "network": true,
    "filesystem": "workspace"
  }
}
```

Validate with Zod in `plugins/external/plugin-manifest.ts`; doctor runs semver against `package.json` version.

### Remote fetch-to-local (transport)

**Primary path — fetch + tar (no git required):**

```typescript
// Pseudocode — implementation detail for executor, not new deps
const res = await fetch(archiveUrl, { redirect: "follow" });
await pipeline(
  Readable.fromWeb(res.body),
  tar.x({
    cwd: targetDir,
    strip: 1,
    filter: (path) => !path.includes(".."), // path traversal guard
  }),
);
```

Support URL patterns: GitHub `codeload.github.com/.../tar.gz/refs/tags/vX`, GitLab archive, direct `.tar.gz` / `.tgz` release assets.

**Secondary path — git spawn (optional, no library):**

```typescript
spawn("git", ["clone", "--depth", "1", repoUrl, targetDir], { stdio: "inherit" });
```

Use when URL is a git remote and `git --version` succeeds; otherwise surface explicit error — no silent fallback.

After fetch: **same** manifest validation, permission review, allowlist approval, and enablement as local-folder install. No code execution during fetch/extract beyond writing files.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| **tar** | **tar-stream** / **modern-tar** | `tar` is npm's own extractor; better documented for sync directory extract + filter; `modern-tar` is newer/zero-dep but adds unfamiliar API surface for minimal gain |
| **fetch + tar** | **simple-git** `^3.36.0` | Adds dependency *and* requires git on PATH for all installs; conflicts with seed intent to support archive URLs without git |
| **fetch + tar** | **degit** `^3.0.0` | Thin wrapper around git clone; same git requirement; less control over extract security |
| **Zod manifest** | **JSON Schema + ajv** | Second validation dialect; project already standardized on Zod for config |
| **semver** | Manual regex | Error-prone for pre-release/build metadata |
| **dependency-cruiser error ratchet** | **eslint-plugin-boundaries** | Duplicate boundary logic; cruiser already wired in CI with baseline |
| **fs.cp local install** | **ncp** / **fs-extra** | Unnecessary; Node 20 `fs.cp` is sufficient |
| **Control-server REST** | **tRPC** / **Hono** | New HTTP framework for one handler group; existing `node:http` router pattern suffices |
| **Plugin hot reload** | **chokidar** | Out of v1.7 scope; enable/disable is restart-level |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Plugin marketplace SDK** (OpenVSX, npm registry UI) | PROJECT.md and seeds explicitly exclude marketplace | Local folder + explicit URL fetch-to-local |
| **Remote execution / URL import()** | Security and observability conflict; seed forbids executing code during fetch | Download → extract → validate → user approve → local dynamic import |
| **VM2 / isolated-vm sandbox** | Heavy, maintenance burden; false sense of security for native tools | Existing allowlist + interactive approval + permission metadata in manifest |
| **Webpack/Rollup plugin bundler** | Plugins ship as ESM with `export function register(host)` — same as today's third-party extensions | Document entry module convention; TypeScript plugin authors compile themselves |
| **npm/pnpm as installer** | Pulls full package manager graph; conflicts with deterministic `~/.rlm/plugins/` layout | tar extract or folder copy |
| **axios / node-fetch** | Redundant on Node 20+ | Built-in `fetch` |
| **LangChain tool plugins** | v1.7 is taxonomy/distribution, not new orchestration | Existing `ToolPort` + `ExtensionHost` |
| **MCP server for plugin management** | Overkill for local registry CRUD | Control-server HTTP handlers |
| **Vitest/Jest for plugin tests** | Repo uses `node:test` | Extend `tests/plugins/` with existing runner |
| **Strict depcruise error before fixing 3 violations** | CI goes red without value | Fix violations, then ratchet (matches v1.6 ARCH-02 deferral) |
| **New UI state library** | Plugin list is moderate complexity | React state + control-server fetch, consistent with graph/session handlers |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `tar@^7.5.15` | Node `>=18` | Repo on Node 20+; use `filter`/`strip` options for safe extract |
| `semver@^7.8.1` | Node `>=10` | Use `semver.satisfies(runningVersion, manifest.engines.rlm)` |
| `zod@^4.4.3` | TypeScript 6 | Shared with config schema |
| `dependency-cruiser@^17.4.0` | Node `>=18` | `--ignore-known` + empty baseline = strict CI |
| Dynamic `import()` of plugins | `"type": "module"` package | Plugins must ship ESM `.js` or `.mjs` entry; document in manifest |

---

## Sources

- Repo: `package.json`, `.dependency-cruiser.js`, `dependency-cruiser-baseline.json`, `src/application/extension-host.ts`, `src/application/bootstrap/build-runtime-context.ts`, `.planning/notes/architecture-boundary-cleanup-direction.md`, `.planning/seeds/first-class-plugin-taxonomy-for-future-tools.md`, `.planning/seeds/remote-plugin-fetch-to-local-folder.md` — **HIGH**
- npm registry (`npm view tar semver dependency-cruiser`, 2026-05-22) — **HIGH**
- [dependency-cruiser CLI](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md) — `--ignore-known`, `depcruise-baseline` — **HIGH**
- [dependency-cruiser rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) — `severity: "error"` — **HIGH**
- [node-tar](https://github.com/isaacs/node-tar) — extract API — **MEDIUM** (README fetch empty; version verified via npm)

---
*Stack research for: v1.7 Adapter & Plugin Taxonomy — plugin manifests, plugin manager UX, runtime/interop split, dependency-cruiser boundary enforcement*  
*Researched: 2026-05-22*
