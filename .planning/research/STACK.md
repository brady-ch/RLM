# Stack Research — v1.6 Architecture Cleanup

**Domain:** Behavior-preserving refactor guardrails for a TypeScript/Node layered CLI + React UI monorepo  
**Researched:** 2026-05-22  
**Confidence:** HIGH for lint/format/boundary tooling choices; MEDIUM for phased boundary rule strictness (existing violations must be burned down incrementally)

**Scope:** Stack additions/changes **only** for v1.6 architecture cleanup — lint/format guardrails, test restructuring support, module boundary enforcement. Existing TypeScript 6, Node ESM CLI, React/Vite UI, Tauri shell, Ollama adapter, LangChain orchestration, and 205 passing `node:test` tests are **not** re-researched.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **ESLint** | `^10.4.0` | Static analysis and refactor guardrails | De facto standard for TS repos; flat config (`eslint.config.js`) is current ESLint default and works with ESM `"type": "module"` projects |
| **typescript-eslint** | `^8.59.4` | TypeScript-aware ESLint rules | Official TS lint stack; supports ESLint 9/10 and TypeScript `<6.1.0` (matches repo `typescript@^6.0.3`); `projectService: true` avoids brittle per-file `tsconfig` wiring during file moves |
| **@eslint/js** | `^10.0.1` | ESLint recommended baseline | Flat-config entry point paired with ESLint 10 |
| **Prettier** | `^3.8.3` | Deterministic formatting | Separates style from semantics; reduces noisy diffs during large file splits; pairs cleanly with `eslint-config-prettier` |
| **eslint-config-prettier** | `^10.1.8` | Disable ESLint rules that fight Prettier | Prevents double-fix loops between ESLint stylistic rules and Prettier |
| **dependency-cruiser** | `^17.4.0` | Module boundary + cycle enforcement | Purpose-built for layered architecture rules (`forbidden`/`allowed` by path); validates `src/` and `ui/src/` separately; outputs CI-friendly violations; can visualize dependency graphs during taxonomy pass |
| **globals** | `^17.6.0` | Flat-config environment globals | Supplies `node` and `browser` globals for split ESLint blocks (CLI vs UI) |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **c8** | `^11.0.0` | V8 coverage for `node:test` | Optional during refactor waves to confirm extracted modules remain exercised; not required for CI gate in v1.6 |
| **tsx** | `^4.21.0` (existing) | Run TypeScript tests without pre-build | Dev-only `test:watch` / targeted subsystem runs while splitting files; keep CI on compiled `dist/tests/**/*.test.js` |
| **Node built-in `node:test`** | Node `>=20` (repo on v20.18.2) | Test runner | **Keep** — 15 test files / 205 tests already on `node:test`; no migration benefit for a refactor-only milestone |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **`eslint.config.js`** (root) | Unified lint entry | Two `files` blocks: `src/**`, `tests/**` with `globals.node`; `ui/src/**` with `globals.browser` and `ui/tsconfig.json` via `projectService` |
| **`.prettierrc` + `.prettierignore`** | Format policy | Ignore `dist/`, `node_modules/`, Tauri `target/`, release staging dirs; single width (match existing 2-space TS style) |
| **`.dependency-cruiser.cjs`** | Boundary rules | Use `.cjs` extension so config loads reliably in an ESM package; encode AGENTS.md layer rules with phased severities |
| **`npm run check` expansion** | Quality gate | Evolve from `typecheck && test` to `typecheck && lint && depcruise && test` once baseline violations are triaged |

---

## Installation

```bash
# Lint + format core
npm install -D eslint@^10.4.0 @eslint/js@^10.0.1 typescript-eslint@^8.59.4 \
  eslint-config-prettier@^10.1.8 prettier@^3.8.3 globals@^17.6.0

# Module boundary enforcement
npm install -D dependency-cruiser@^17.4.0

# Optional — coverage while splitting modules
npm install -D c8@^11.0.0
```

Suggested `package.json` script additions (integration, not new packages):

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --check .",
    "format:write": "prettier --write .",
    "depcruise": "depcruise src ui/src --config .dependency-cruiser.cjs",
    "test": "npm run build && node --test --test-concurrency=4 dist/tests/**/*.test.js",
    "test:coverage": "npm run build && c8 node --test --test-concurrency=4 dist/tests/**/*.test.js",
    "check": "npm run typecheck && npm run lint && npm run depcruise && npm test"
  }
}
```

Replace the current `"lint": "npm run typecheck"` alias — typecheck stays explicit via `typecheck` script.

---

## Integration Points

### ESLint + TypeScript 6 (root `tsconfig.json`)

- Root `tsconfig.json` already enables `strict`, `verbatimModuleSyntax`, `isolatedModules`, `noUncheckedIndexedAccess`.
- Use `typescript-eslint` **`recommended`** preset initially; add **`recommendedTypeChecked`** rules selectively (`consistent-type-imports`, `no-floating-promises`, `await-thenable`) after baseline lint passes.
- **`projectService: true`** with `tsconfigRootDir: import.meta.dirname` — simpler than maintaining `tsconfig.eslint.json` while files move between `src/application/config/`, `src/runtime/composition/`, etc.
- **`tests/**`**: allow dev-only patterns (`test.only` ban via rule override if desired); tests may import across layers for integration coverage — do **not** apply production boundary ESLint rules to tests (boundary enforcement belongs in dependency-cruiser with a `pathNot: ^tests` exception).

### ESLint + UI (`ui/tsconfig.json`)

- Separate flat-config block for `ui/src/**/*.{ts,tsx}` with `globals.browser`.
- `ui/` is excluded from root `tsconfig.json` but included in Prettier; ESLint block should reference UI TS context (either extend `ui/tsconfig.json` via parser options or a dedicated `files` + `languageOptions.parserOptions.projectService` scoped to UI paths).
- Do **not** lint generated Vite/Tauri output (`ui/dist`, `src-tauri/target`).

### Prettier

- Run on `src/`, `tests/`, `ui/src/`, `scripts/`, root config files.
- Keep ESLint non-stylistic; Prettier owns quotes, trailing commas, line width.
- First landing: `format:write` once, commit separately from logic refactors to keep reviews readable.

### dependency-cruiser — layer rules aligned with AGENTS.md

Target rules (encode in `.dependency-cruiser.cjs`):

| Rule | From | To (forbidden) | Rationale |
|------|------|----------------|-----------|
| `domain-no-upper-layers` | `^src/domain/` | `^src/application/`, `^src/adapters/`, `^src/cli/` | Domain policy stays pure; today violated by `src/domain/agents.ts` → `application/project-config` |
| `ports-no-application` | `^src/ports/` | `^src/application/`, `^src/adapters/`, `^src/cli/` | Ports define contracts only; today violated by `ports/extension-port.ts` → `application/extension-host` |
| `ports-no-domain-types` | `^src/ports/` | `^src/domain/` | Prefer moving shared DTOs to `ports/` or a thin `src/types/` module during refactor |
| `adapters-no-application` | `^src/adapters/` | `^src/application/`, `^src/cli/` | Adapters implement ports; orchestration stays upstream |
| `cli-no-adapters` | `^src/cli/` | `^src/adapters/` | CLI composes through application/runtime composition root, not concrete adapters |
| `no-circular` | (any) | circular deps | Critical during file splits |
| `tests-free-import` | `^tests/` | (none extra) | Tests intentionally cross layers for integration |

**Phased enforcement:** start new rules at `severity: "warn"` (or `--ignore-known`) for known violations; ratchet to `error` as extraction phases land (matches two-pass strategy in `.planning/notes/architecture-boundary-cleanup-direction.md`).

**UI boundary:** add `forbidden` rule preventing `ui/src/**` from importing `src/**` directly — UI should talk to control-server HTTP/API only (verify current imports during phase planning).

Run: `npx depcruise-fmt --init` once for baseline config, then replace presets with project-specific layer rules above.

### Test restructuring (no new test framework)

**Do not migrate to Vitest/Jest.** The repo uses Node's built-in runner (`import test from "node:test"`), documented in `docs/TESTING.md`, with compile-then-run via `tsc`.

Recommended folder taxonomy (mirrors refactor targets):

```text
tests/
  domain/           # recursive-language-model, agents, types
  application/      # project-config, execution-controller, graph-*, workflows
  adapters/         # file stores, tools, model hosts
  cli/              # args, render
  integration/      # cross-subsystem (today's integration-v15.test.ts)
  helpers/          # QueueModel, shared fakes (extract from mega-files)
```

Mechanical support:

1. Update glob: `dist/tests/**/*.test.js` (recursive — verified on Node 20).
2. Keep `--test-name-pattern` for targeted runs (already used extensively in milestone verification docs).
3. Extract shared fakes (`QueueModel`, temp config builders) into `tests/helpers/` — no library required.
4. Optional `test:file` script: `node --test dist/tests/$npm_config_file` for subsystem focus.

**Vitest note:** milestone prompt referenced Vitest, but `package.json` and all 15 test files use `node:test` only. Treat Vitest as out of scope unless a future milestone explicitly opts into migration.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **dependency-cruiser** | **eslint-plugin-boundaries** (`^6.0.2`) | If team wants boundary violations inline in ESLint IDE diagnostics only — weaker at repo-wide graphs and CI reporting |
| **dependency-cruiser** | **eslint-plugin-import-x** (`^4.16.2`) | Supplement for `import/no-cycle` in editor; redundant if dependency-cruiser `no-circular` is enabled |
| **Prettier + ESLint** | **Biome** (single tool) | Greenfield repos; here it would replace two established ecosystems and fight existing TS/Vite/Tauri conventions mid-refactor |
| **node:test** (keep) | **Vitest** | If you need Vite-native UI component unit tests with jsdom/happy-dom — not required for backend refactor; large migration cost |
| **c8** (optional) | **`node --experimental-test-coverage`** | Built-in but still experimental and less documented; c8 is the pragmatic choice if coverage is needed |
| **Manual `npm run check`** | **lint-staged + Husky** | Post-v1.6 polish once lint/depcruise baselines are clean; adds git-hook friction during active refactor |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Vitest / Jest** | 205 tests on `node:test`; migration churn steals refactor budget | Keep `node:test`; reorganize files/directories |
| **Biome as ESLint+Prettier replacement** | Different config model; doubles tooling during transition | ESLint 10 flat config + Prettier 3 |
| **Both dependency-cruiser and eslint-plugin-boundaries** | Duplicate boundary logic, divergent rules | dependency-cruiser only for architecture layers |
| **Nx / Turborepo** | Massive workflow change for a single-package repo | npm scripts + dependency-cruiser |
| **TypeScript project references (now)** | Root cause is file responsibility size, not build graph partitioning | Split modules first; revisit if compile times become painful |
| **@stylistic/eslint-plugin** | Overlaps Prettier; creates fix conflicts | Prettier for format; ESLint for correctness |
| **Strict boundary `error` on day one** | Known violations (`domain→application`, `ports→application`, `application→adapters`) exist today | Phased warn → error per refactor phase |
| **LangGraph / new orchestration libs** | v1.6 is cleanup, not new runtime behavior | Existing domain/application modules |

---

## Stack Patterns by Variant

**If landing lint/format first (recommended Wave 0):**

- Add ESLint + Prettier with permissive rules (`recommended` only, no type-checked rules yet).
- Run one formatting commit; fix auto-fixable ESLint issues.
- Keep `check` = typecheck + test until lint baseline is green.

**If enforcing boundaries before file moves:**

- Add dependency-cruiser with `warn` severity + `--ignore-known` output committed as baseline.
- Ratchet individual rules to `error` as each extraction phase merges.

**If splitting `recursive-language-model.test.ts` (~4k lines):**

- Create `tests/domain/recursive-language-model/` with multiple `*.test.ts` files grouped by concern (quality loop, interactive session, CLI render, graph mutations).
- Extract shared fakes to `tests/helpers/` first — reduces copy/paste without new dependencies.
- Run targeted `node --test --test-name-pattern='quality loop'` commands already documented in v1.2 milestone artifacts.

**If touching UI composition (`ui/` + `control-server`):**

- Add ESLint browser block + dependency-cruiser rule blocking `ui/src → src/` imports.
- Keep UI tests integration-style through control-server (matches current pattern in mega test file).

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `typescript-eslint@^8.59.4` | `eslint@^8.57 \|\| ^9 \|\| ^10` | Peer dependency verified 2026-05-22 |
| `typescript-eslint@^8.59.4` | `typescript@>=4.8.4 <6.1.0` | Matches repo `typescript@^6.0.3` |
| `eslint-config-prettier@^10.1.8` | `eslint@>=7`, `prettier@>=3` | Flat config: import and spread last in `eslint.config.js` |
| `dependency-cruiser@^17.4.0` | Node `>=18` | Auto-detects `.dependency-cruiser.cjs`; pass `--config` explicitly in npm script for clarity |
| `c8@^11.0.0` | `node:test` via `c8 node --test ...` | Works with compiled JS in `dist/tests/` |
| `@vitejs/plugin-react@^5.1.2` | `vite@^7.2.7` | Unchanged; ESLint UI block is independent of Vite version |

---

## Sources

- `/typescript-eslint/typescript-eslint` (Context7) — flat config, `projectService`, ESLint 10 peer range — **HIGH**
- `/eslint/eslint` (Context7) — flat config `eslint.config.js` ESM pattern — **HIGH**
- `/sverweij/dependency-cruiser` (Context7) — layered `forbidden` rules, CLI validation — **HIGH**
- [dependency-cruiser rules tutorial](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-tutorial.md) — path-based layer enforcement — **HIGH**
- Repo `package.json`, `tsconfig.json`, `ui/tsconfig.json`, `docs/TESTING.md`, `AGENTS.md` — current baseline — **HIGH**
- npm registry (`npm view`, 2026-05-22) — version numbers — **HIGH**
- `.planning/notes/architecture-boundary-cleanup-direction.md` — two-pass extraction before taxonomy — **HIGH**

---
*Stack research for: v1.6 Architecture Cleanup (lint/format guardrails, test restructuring, module boundaries)*  
*Researched: 2026-05-22*
