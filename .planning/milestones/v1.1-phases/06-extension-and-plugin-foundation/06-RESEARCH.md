# Phase 6: Extension and Plugin Foundation — Research

**Researched:** 2026-05-09  
**Domain:** Node.js ESM dynamic `import()`, plugin architecture, allowlist trust, npm `exports`  
**Confidence:** HIGH (all critical claims verified against codebase or Node.js docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 YAML-first:** User-facing enablement and extension references live in `rlm.config.yaml`.
- **D-02 Folder layout:** First-party/built-in extensions ship inside the CLI package under a stable documented directory. User/third-party extensions default to a project-local directory (e.g. `./extensions/` next to config). YAML entries resolve to paths under these documented roots.
- **D-03 Executable story stays "run the CLI":** No separate manual `node register.js` step.
- **D-04 First-load explicit confirmation:** First time an extension identity is seen, the runtime must surface an explicit user-facing approval step before executing its code. Approved identities are persisted (allowlist on disk). Revocation/editing is in scope.
- **D-05 Parallel registries behind a single facade:** Separate registration surfaces for tools, skill loaders, and model host adapters (an `ExtensionHost`-style type). Shared lifecycle hooks on the facade.
- **D-06 First-party bundled extensions:** Today's built-in tools move into first-party extension packages, registered through the same loader and contracts. `src/index.ts` reduces to orchestration.

### Claude's Discretion
- Exact relative-path resolution order (strictly config-directory–anchored vs cwd-first): choose the safer default.
- Exact on-disk store format for the post-confirmation allowlist (JSON vs YAML fragment).

### Deferred Ideas (OUT OF SCOPE)
- MCP server wiring, skill disk layouts, remote model hosts, constrained decoding integration — Phases 7–9.
- UI-specific approval UX for new extensions (CLI behavior must be specified clearly in Phase 6).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLUG-01 | System exposes a documented extension mechanism to register additional tools, skills, and model host adapters without forking core, including at least one reference registration path. | Dynamic `import()` + `ExtensionHost` facade + YAML config + allowlist covers the full requirement. Migration of built-in tools to the extension path is the reference registration. |
</phase_requirements>

---

## Summary

The project runs on Node.js 22 (`type: module`, `module: nodenext`) [VERIFIED: codebase], giving native ESM dynamic `import()` as the safe, zero-dependency mechanism for loading user extensions at runtime. The extension host needs three parallel registries (tools, skill loaders, model hosts) behind a single `ExtensionHost` facade; each registry maps name → implementation. First-party built-in tools migrate to `src/extensions/tools/` using the same interface as third-party extensions, shrinking `src/index.ts` to pure orchestration.

The two non-trivial risks are (1) Windows path handling—dynamic `import()` requires `file://` URLs on Windows, requiring `pathToFileURL()` before loading any local path—and (2) the ESM/CJS boundary: user-authored extensions in CJS will load (Node wraps them) but cannot use `require()` to pull in project-internal ESM modules, so the extension contract must document ESM-only.

The allowlist store should be a simple JSON file (one record per approved extension identity keyed by SHA-256 of the absolute resolved path), written next to the config file. First-party extensions (shipped inside the package) are pre-approved implicitly; only third-party/user extensions require the first-load confirmation prompt.

**Primary recommendation:** Implement a thin `ExtensionHost` class in `src/application/extension-host.ts` that owns the registries and load/trust lifecycle. Inject it into `src/index.ts` after config load, before agent registry construction. Keep `LanguageModelPort` untouched in Phase 6.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Extension discovery (YAML parsing) | Application (`project-config`) | — | Config is already loaded/resolved here; add `extensions[]` key to existing YAML schema |
| Path resolution + file URL conversion | Application (`extension-host`) | — | Side-effectful, not domain policy |
| Trust check + first-load confirmation | Application (`extension-host`) | CLI (`stdin/stderr`) | CLI layer handles I/O; host owns the allow/deny decision |
| Allowlist persistence (read/write) | Application (`extension-host`) | — | File I/O belongs in application layer, not domain |
| Registry storage (tool/skillLoader/modelHost) | Application (`extension-host`) | — | Parallel registries are orchestration, not domain policy |
| Dynamic `import()` of extension module | Application (`extension-host`) | — | Extension load is infrastructure concern |
| Built-in tool adapters | Adapters (`src/extensions/tools/`) | — | Migrate from `src/adapters/` to extension packages under same port contracts |
| `src/index.ts` composition root | CLI / composition | — | Shrinks to: load config → run extension host → wire registries → run agent |

---

## Standard Stack

### Core (no new runtime dependencies needed)

| What | How | Source |
|------|-----|--------|
| Dynamic import of extensions | Native `import(specifier)` | [VERIFIED: Node.js 22, ESM native] |
| Path to file URL (Windows safety) | `import { pathToFileURL } from 'node:url'` | [VERIFIED: Node.js stdlib] |
| Hash for allowlist identity | `import { createHash } from 'node:crypto'` — `sha256` of absolute path | [VERIFIED: Node.js stdlib] |
| Allowlist I/O | `import { readFile, writeFile, mkdir } from 'node:fs/promises'` | [VERIFIED: Node.js stdlib] |
| First-load confirmation prompt | `import * as readline from 'node:readline/promises'` (or `process.stdin` read) | [VERIFIED: Node.js 18+ readline/promises] |
| Extension config validation | `zod` (already in project) | [VERIFIED: codebase `package.json`] |

**No new npm packages needed for the extension host itself.** [VERIFIED: all required stdlib modules exist in Node.js 22]

### Supporting (already present)

| Library | Purpose in Phase 6 |
|---------|-------------------|
| `yaml` | Parse `extensions[]` block from `rlm.config.yaml` (already used in `project-config.ts`) |
| `zod` | Validate extension manifest shape on load |
| `node:path` | `path.resolve`, `path.dirname`, `path.isAbsolute` for path anchoring |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:crypto` sha256 | Content hash of the file | Content hash detects tampering but is slow for large extension bundles; path-based hash is simpler and consistent with "allow this file at this location" trust model. Recommend path hash for Phase 6. |
| JSON allowlist | YAML fragment appended to `rlm.config.yaml` | JSON is simpler to parse atomically; avoids deserializing the full YAML config on every run. Recommend JSON. |
| `readline/promises` | Inquirer / prompts library | No new dep needed; readline is stdlib and sufficient for a y/N confirmation. |

---

## Architecture Patterns

### System Architecture Diagram

```
rlm.config.yaml
     │  extensions: [...]
     ▼
loadProjectConfig()          ← already exists in src/application/project-config.ts
     │  raw extension entries (path/package + allowed agents)
     ▼
ExtensionHost.load(entries, { configDir, allowlistPath })
     │
     ├─ resolve absolute path (config-dir-anchored)
     ├─ convert to file URL (pathToFileURL)
     ├─ check allowlist (sha256 lookup in .rlm-allowlist.json)
     │     └─ if absent → stderr prompt → user y/N → persist if approved
     │
     ├─ dynamic import(fileUrl)          ← ESM native
     │     └─ module must export: { register(host: ExtensionHost): void }
     │
     └─ register() calls one or more of:
           host.tools.register(toolPort)
           host.skillLoaders.register(loader)
           host.modelHosts.register(adapter)

ExtensionHost
├── toolRegistry: Map<string, ToolPort>
├── skillLoaderRegistry: Map<string, SkillLoaderPort>   ← stub in Phase 6
└── modelHostRegistry: Map<string, LanguageModelPort>  ← stub in Phase 6

src/index.ts (after Phase 6)
     loadProjectConfig → ExtensionHost.load → toolsFor(agentId) reads toolRegistry → createAgentRegistry
```

### Recommended Project Structure

```
src/
├── application/
│   └── extension-host.ts      # ExtensionHost class, registries, load/trust lifecycle
├── extensions/                # First-party bundled extension packages
│   └── tools/
│       ├── guarded-shell.extension.ts
│       ├── web-search.extension.ts
│       ├── web-fetch.extension.ts
│       └── workspace-file-write.extension.ts
├── ports/
│   ├── tool-port.ts           # unchanged
│   ├── skill-loader-port.ts   # new stub (Phase 6 defines shape, Phase 7 implements)
│   └── extension-port.ts      # ExtensionManifest type; register() signature
└── index.ts                   # simplified: load → host.load → wire → run
```

### Pattern 1: Extension Manifest Contract

Every extension module (first-party or third-party) exports a single named export `register`:

```typescript
// Source: designed for this codebase; consistent with existing ToolPort contract
import type { ExtensionHost } from "../application/extension-host.js";

export function register(host: ExtensionHost): void {
  host.tools.register(new MyTool());
}
```

- Single named export avoids default-export ambiguity across CJS/ESM boundaries [VERIFIED: Node.js docs]
- `ExtensionHost` type is the only import from core; keeps extension coupling minimal

### Pattern 2: Path Resolution (config-dir-anchored)

```typescript
// Source: Node.js path/url stdlib, designed for this codebase
import { resolve, dirname, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

function resolveExtensionPath(entry: string, configFilePath: string): URL {
  const base = dirname(configFilePath);
  const abs = isAbsolute(entry) ? entry : resolve(base, entry);
  return pathToFileURL(abs);   // mandatory on Windows; harmless on POSIX
}
```

**Why config-dir-anchored:** `cwd` can differ when the CLI is invoked from a different directory; the config file location is stable. [ASSUMED — safer default; consistent with how `project-config.ts` already resolves config path]

### Pattern 3: Allowlist Check

```typescript
// Source: node:crypto, node:fs/promises stdlib
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

type Allowlist = Record<string, { approvedAt: string; path: string }>;

function extensionKey(absPath: string): string {
  return createHash("sha256").update(absPath).digest("hex");
}

async function isApproved(absPath: string, allowlistPath: string): Promise<boolean> {
  try {
    const raw = await readFile(allowlistPath, "utf8");
    const list: Allowlist = JSON.parse(raw);
    return Object.hasOwn(list, extensionKey(absPath));
  } catch {
    return false;  // file absent → not yet approved
  }
}

async function persistApproval(absPath: string, allowlistPath: string): Promise<void> {
  let list: Allowlist = {};
  try { list = JSON.parse(await readFile(allowlistPath, "utf8")); } catch { /* first write */ }
  list[extensionKey(absPath)] = { approvedAt: new Date().toISOString(), path: absPath };
  await writeFile(allowlistPath, JSON.stringify(list, null, 2), "utf8");
}
```

### Pattern 4: Dynamic Import with Error Wrapping

```typescript
// Source: Node.js ESM native; error handling convention from codebase adapters
async function loadExtensionModule(fileUrl: URL): Promise<{ register: (host: ExtensionHost) => void }> {
  let mod: unknown;
  try {
    mod = await import(fileUrl.href);
  } catch (err) {
    throw new Error(`Failed to load extension at ${fileUrl.pathname}: ${String(err)}`);
  }
  if (typeof (mod as Record<string, unknown>)["register"] !== "function") {
    throw new Error(`Extension at ${fileUrl.pathname} does not export a "register" function.`);
  }
  return mod as { register: (host: ExtensionHost) => void };
}
```

### Anti-Patterns to Avoid

- **`require()` inside the extension host:** The CLI is `type: module`; `require()` is not available. Use dynamic `import()` exclusively.
- **Passing raw string paths to `import()`:** Will fail on Windows. Always convert with `pathToFileURL` first.
- **Storing allowlist inside `rlm.config.yaml`:** The config file is user-managed; concurrent read/write risks corruption. Use a separate `.rlm-allowlist.json`.
- **Bloating `LanguageModelPort` with extension metadata:** Port interfaces are stable domain contracts. Extension registry lives in the application layer only.
- **Loading extensions before the allowlist check:** Trust check must complete (and prompt if needed) before `import()` is called on any user-supplied path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File URL conversion | Manual string `"file://" + path` | `pathToFileURL(path).href` from `node:url` | Manual concatenation breaks on Windows drive letters (`C:\...`) and spaces in paths |
| Content integrity | File content hashing on every load | Path-based `sha256` in allowlist | Content hash prevents tampering but adds I/O on every startup for large bundles; path hash is sufficient for a trust-at-location model in Phase 6 |
| Extension schema validation | Manual `typeof` checks | `zod` parse on the manifest object | Already in project; handles nested validation and produces clear error messages |
| CJS/ESM interop shim | Custom wrapper | Rely on Node.js native CJS-wrapping for `import()` of `.cjs` files | Node.js 22 wraps CJS in ESM namespace automatically; custom shims cause double-wrapping issues |

---

## ESM vs CJS Risks (Primary Risk Area)

### Risk 1: Windows `import()` with bare paths

`import("/abs/path/file.js")` silently fails on Windows because Node.js ESM requires `file://` URLs for local paths. [VERIFIED: Node.js 22 docs — `import()` accepts URL strings or bare specifiers; bare POSIX paths are not valid specifiers on Windows]

**Mitigation:** Always use `pathToFileURL(absPath).href` before `import()`. Already shown in Pattern 2 above.

### Risk 2: CJS extension calling back into ESM project internals

A user writes their extension in CJS (`module.exports = ...`). Node.js will load it via `import()` (creating a CJS namespace object), but if the extension tries to `require('../../../src/ports/tool-port')` it will fail—ESM modules are not accessible via `require()`. [VERIFIED: Node.js docs — CJS cannot require() ESM]

**Mitigation:** The extension contract must state: extensions must be ESM modules (`.mjs` or in a package with `"type": "module"`). Document this in the extension authoring guide. First-party extensions will be ESM (compiled from TypeScript).

### Risk 3: `nodenext` module resolution and `.js` extensions

With `module: nodenext`, TypeScript requires `.js` import specifiers in source even when importing `.ts` files. Extension authors writing TypeScript need the same convention. [VERIFIED: tsconfig in codebase, STACK.md]

**Mitigation:** Document in extension authoring guide. First-party extension TypeScript files follow existing `.js`-specifier convention.

### Risk 4: `package.json exports` field blocking subpath access

The project currently has no `exports` field. Adding one without care can break existing `import from 'rlm/...'` paths used by any tooling. [VERIFIED: `package.json` inspected — no `exports` key]

**Mitigation:** Add `exports` only if needed to expose `dist/extensions/` as a documented subpath. Since extensions load via file paths (not package imports), `exports` may not be needed in Phase 6 at all. If added, use explicit subpath map rather than wildcard to avoid accidental exposure.

---

## First-Party Builtins as Extensions (D-06)

### Migration path

Current location → New location:

| Current | New | Notes |
|---------|-----|-------|
| `src/adapters/guarded-shell-tool.ts` | `src/extensions/tools/guarded-shell.extension.ts` | Wraps existing class; exports `register()` |
| `src/adapters/web-search-tool.ts` | `src/extensions/tools/web-search.extension.ts` | Same pattern |
| `src/adapters/web-fetch-tool.ts` | `src/extensions/tools/web-fetch.extension.ts` | Same pattern |
| `src/adapters/workspace-file-write-tool.ts` | `src/extensions/tools/workspace-file-write.extension.ts` | Same pattern |

Each extension file is a thin wrapper:

```typescript
// src/extensions/tools/guarded-shell.extension.ts
import { GuardedShellTool } from "../../adapters/guarded-shell-tool.js";
import type { ExtensionHost } from "../../application/extension-host.js";

export function register(host: ExtensionHost): void {
  host.tools.register(new GuardedShellTool({ workspaceRoot: process.cwd() }));
}
```

The adapter classes themselves (`src/adapters/`) stay unchanged. The extension file is the registration shim only.

### Trust bypass for first-party extensions

First-party extension paths (resolved inside `dist/extensions/`) are pre-approved implicitly. The `ExtensionHost` can detect this by comparing the resolved path against `__dirname` / `import.meta.url` of the host module. No allowlist entry is written for builtins.

### npm package exports (if needed)

If extensions are ever consumed as package subpaths (Phase 7+), add to `package.json`:

```json
{
  "exports": {
    ".": "./dist/src/index.js",
    "./extensions/tools/*": "./dist/src/extensions/tools/*.js"
  }
}
```

Phase 6 does not require this—extensions load via resolved file paths, not package specifiers. Add only when Phase 7 introduces MCP/skill loading that needs stable import paths.

---

## YAML Config Shape

```yaml
# rlm.config.yaml additions for Phase 6
extensions:
  allowlist: ./.rlm-allowlist.json   # optional; defaults to same dir as config file
  load:
    - path: ./extensions/my-tool.js  # relative to this config file
      agents: [default, research]    # which agents can use tools from this extension
    - path: ./extensions/my-model.js
      agents: [coding]
```

First-party builtins are registered before user extensions without YAML entries (loaded by the host automatically from `dist/extensions/tools/`).

---

## Testing Strategy

### Integration test with temporary extension

```typescript
// tests/extension-host.test.ts (new)
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

test("ExtensionHost loads a tool extension and registers it", async () => {
  // Arrange
  const dir = await mkdtemp(join(tmpdir(), "rlm-ext-test-"));
  const extPath = join(dir, "my-tool.extension.js");
  await writeFile(extPath, `
    export function register(host) {
      host.tools.register({ name: "my-tool", description: "test", schema: {}, execute: async () => ({ status: "success", output: "ok" }) });
    }
  `);
  const allowlistPath = join(dir, ".rlm-allowlist.json");

  // Act
  const { ExtensionHost } = await import("../src/application/extension-host.js");
  const host = new ExtensionHost();
  // Pre-approve to skip interactive prompt in test
  await host.preApprove(extPath, allowlistPath);
  await host.load([{ path: extPath, agents: ["default"] }], {
    configDir: dir,
    allowlistPath,
    interactive: false,
  });

  // Assert
  assert.ok(host.tools.get("my-tool"), "tool should be registered");

  await rm(dir, { recursive: true, force: true });
});
```

**Why temp extension file:** Tests do not modify core sources; the extension is written on-the-fly in `tmpdir()`. Aligns with existing integration-test style in the repo. [VERIFIED: `tests/` contains one integration test file, `dist/tests/*.test.js` run by built-in Node test runner]

### Test matrix for Phase 6

| Behavior | Test Type | Notes |
|----------|-----------|-------|
| Extension loads and registers tool | Integration | Temp file, no interactive prompt |
| Unknown `register` export is rejected with clear error | Integration | Extension file missing the export |
| First-party builtins are pre-approved (no prompt) | Integration | Load from dist/extensions path |
| Allowlist persisted after first approval | Integration | Check JSON file written |
| Existing CLI tool behavior unchanged | Integration | Run existing `recursive-language-model.test.ts` suite |
| Windows path (file URL) round-trip | Unit | `pathToFileURL` → `fileURLToPath` round-trip, path equality |

---

## Common Pitfalls

### Pitfall 1: `import()` of a Windows bare path silently produces wrong module

**What goes wrong:** `import("C:\\Users\\foo\\ext.js")` does not resolve as a file path; Node.js treats it as a package specifier and throws `ERR_MODULE_NOT_FOUND`.  
**Why it happens:** ESM `import()` follows URL semantics; bare paths require `file://` scheme on Windows.  
**How to avoid:** Always `pathToFileURL(absPath).href` before calling `import()`.

### Pitfall 2: Extension loaded before trust check

**What goes wrong:** Code in the extension module (top-level side effects) runs before the user has approved.  
**Why it happens:** `import()` immediately executes the module.  
**How to avoid:** Allowlist check and interactive confirmation must complete and return `true` before `import()` is called. The check is synchronous from the user's perspective (awaited in sequence).

### Pitfall 3: `src/index.ts` still special-cases some tools after migration

**What goes wrong:** Partial migration leaves a dual registration path; a tool can be registered twice or with different configs.  
**Why it happens:** Incremental migration is tempting.  
**How to avoid:** Plan must include a single wave where all four built-in tool registrations are removed from `index.ts` and replaced by extension loading. Do not ship a hybrid state.

### Pitfall 4: `extensionHost.tools.register()` silently overwrites a tool with the same name

**What goes wrong:** Two extensions register a tool named `shell`; the second silently wins.  
**Why it happens:** Map `.set()` overwrites without error.  
**How to avoid:** Registry `register()` method must throw on name collision: `if (this.registry.has(tool.name)) throw new Error(...)`. Consistent with "no silent failures" (ERRO-03).

### Pitfall 5: Allowlist file path collision when multiple projects use the same home dir

**What goes wrong:** `.rlm-allowlist.json` in the config dir is per-project (good), but if two projects share a config dir, they share the allowlist.  
**Why it happens:** Default path is relative to config dir.  
**How to avoid:** Default is config-dir-adjacent, which is already per-project. Document that the allowlist should not be committed to git (add to `.gitignore` guidance).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Config-dir-anchored path resolution is safer than cwd-first | Path Resolution pattern | Low: both work; cwd-first is less predictable under different invocation styles. This is Claude's Discretion (CONTEXT.md). |
| A2 | First-party extensions detected by comparing resolved path against `import.meta.url` of ExtensionHost | First-Party Trust Bypass | Medium: if dist layout changes, detection breaks. Alternative: maintain explicit list of built-in extension paths. |
| A3 | No `exports` field addition needed in Phase 6 | npm package exports | Low: extensions load by file path, not package specifier, so `exports` is not required for Phase 6 functionality. |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ESM `import()` | Extension loading | ✓ | v22.22.0 | — |
| `node:crypto` | Allowlist sha256 | ✓ | stdlib | — |
| `node:readline/promises` | First-load prompt | ✓ | Node 18+ stdlib | — |
| `node:fs/promises` | Allowlist read/write | ✓ | stdlib | — |
| `node:url` `pathToFileURL` | Windows path safety | ✓ | stdlib | — |

No missing dependencies. All required APIs are Node.js stdlib available on v22. [VERIFIED: `node --version` → v22.22.0]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert/strict` |
| Config file | None — test runner invoked directly |
| Quick run command | `npm test` (build first, then `node --test dist/tests/*.test.js`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLUG-01 | Tool registered via extension without modifying core | Integration | `npm test` | ❌ Wave 0 |
| PLUG-01 | Extension with bad `register` export rejected clearly | Integration | `npm test` | ❌ Wave 0 |
| PLUG-01 | First-party builtins load via extension host | Integration | `npm test` | ❌ Wave 0 |
| PLUG-01 | Existing CLI tool behavior unchanged | Integration | `npm test` | ✅ existing test |

### Wave 0 Gaps

- [ ] `tests/extension-host.test.ts` — covers extension loading, registration, error rejection, first-party trust
- [ ] No new framework needed — existing `node:test` + `node:assert/strict` stack

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Yes | `zod` schema on extension manifest after `import()` |
| V4 Access Control | Yes | Allowlist check before `import()`; explicit user approval for new identities |
| V2 Authentication | No | No auth layer added in Phase 6 |
| V6 Cryptography | Minimal | `sha256` via `node:crypto` for allowlist key — no custom crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious extension loaded without approval | Elevation of Privilege | Allowlist gate with `sha256` key; interactive confirmation on first load |
| Extension silently replacing a built-in tool name | Tampering | Registry `register()` throws on name collision |
| Path traversal in YAML `path:` entry | Tampering | `path.resolve` normalizes traversal; resolved path is logged before import |
| Top-level side effects in extension before approval | Elevation of Privilege | Approval check runs before `import()` is called |

---

## Sources

### Primary (HIGH confidence — verified against codebase or Node.js stdlib)
- Codebase: `package.json` (`type: module`), `tsconfig.json` (`module: nodenext`), `node --version` (v22.22.0)
- Codebase: `src/ports/tool-port.ts`, `src/ports/language-model-port.ts`, `src/index.ts` tool wiring
- Codebase: `.planning/codebase/STACK.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`
- [CITED: nodejs.org] Node.js ESM `import()` URL semantics and `pathToFileURL` requirement on Windows
- [CITED: nodejs.org] `node:crypto` `createHash`, `node:readline/promises` — available Node 18+
- [CITED: nodejs.org] CJS cannot `require()` ESM; ESM can `import()` CJS (namespace wrapping)

### Secondary (MEDIUM confidence)
- [ASSUMED: A1] Config-dir anchoring as safer default — well-established convention in CLI tooling but not verified against a specific standard

---

## Recommendations for Planner

1. **Create `src/application/extension-host.ts`** as the single new application-layer class owning all three registries (`toolRegistry`, `skillLoaderRegistry`, `modelHostRegistry`) and the load/trust lifecycle. `SkillLoaderPort` and model host registry can be stubs (empty maps with typed interfaces) in Phase 6; Phase 7 and 8 fill them.

2. **Add `src/ports/extension-port.ts`** defining `ExtensionManifest` type (`{ register(host: ExtensionHost): void }`) and the `ExtensionRegistryEntry` (the YAML-parsed shape: `{ path: string; agents: string[] }`). This is the documented API surface for PLUG-01.

3. **Migrate built-in tools in a single atomic wave.** Add `src/extensions/tools/*.extension.ts` files, then remove the corresponding manual wiring from `src/index.ts` in the same commit. Do not ship a hybrid state (Pitfall 3).

4. **Path resolution: always config-dir-anchored, always `pathToFileURL`.** Implement this in `ExtensionHost.resolveExtensionPath(entry, configFilePath)` before any `import()` call. This is the correct default (see A1 assumption).

5. **Allowlist file: `.rlm-allowlist.json` adjacent to `rlm.config.yaml`.** JSON format, keyed by `sha256` of absolute resolved path. First-party extensions (paths inside `dist/extensions/`) skip the check entirely via a fast `startsWith(builtinsDir)` guard.

6. **`src/index.ts` post-migration shape:** `loadProjectConfig → extensionHost.load(entries) → toolsFor reads extensionHost.tools.get() → createAgentRegistry → run`. The existing `toolsByName` Map and manual adapter instantiation are deleted.

7. **Add `tests/extension-host.test.ts`** as a Wave 0 task. Test must cover: successful load, missing `register` export, name collision, pre-approval bypass for first-party paths. Use `tmpdir()` for temp extension files; clean up in test teardown.

8. **Do not touch `LanguageModelPort` in Phase 6.** The model host registry in `ExtensionHost` stores `LanguageModelPort` implementations, but the port interface itself is Phase 8's concern.
