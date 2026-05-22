---
phase: 36-dev-tooling-guardrails
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 70
files_reviewed_list:
  - .dependency-cruiser.js
  - .prettierignore
  - .prettierrc.json
  - dependency-cruiser-baseline.json
  - eslint.config.js
  - package.json
  - src/adapters/file-memory-store.ts
  - src/adapters/file-run-state-store.ts
  - src/adapters/file-session-store.ts
  - src/adapters/file-vector-index.ts
  - src/adapters/guarded-shell-tool.ts
  - src/adapters/http-language-model.ts
  - src/adapters/ollama-embedding-model.ts
  - src/adapters/ollama-language-model.ts
  - src/adapters/search-query.ts
  - src/adapters/web-fetch-tool.ts
  - src/adapters/web-search-tool.ts
  - src/adapters/workspace-file-write-tool.ts
  - src/application/agent-registry.ts
  - src/application/agent-runner.ts
  - src/application/content-tree.ts
  - src/application/control-server.ts
  - src/application/execution-controller.ts
  - src/application/extension-host.ts
  - src/application/graph-executor.ts
  - src/application/graph-planner.ts
  - src/application/graph-workflow-runner.ts
  - src/application/graph-workflow-serializer.ts
  - src/application/graph-workflow-store.ts
  - src/application/interop-runtime.ts
  - src/application/mcp-skill-runtime.ts
  - src/application/memory-manager.ts
  - src/application/memory-resolver.ts
  - src/application/model-library.ts
  - src/application/model-provider.ts
  - src/application/project-config.ts
  - src/application/resource-cleanup.ts
  - src/application/run-recursive-prompt.ts
  - src/application/runtime-composition.ts
  - src/application/runtime-events.ts
  - src/application/semantic-memory-index.ts
  - src/application/session-memory-bridge.ts
  - src/application/workflow-runner.ts
  - src/cli/args.ts
  - src/cli/first-run.ts
  - src/cli/render.ts
  - src/cli/runtime-logger.ts
  - src/domain/execution-failure.ts
  - src/domain/recursive-language-model.ts
  - src/domain/run-state-persistence.ts
  - src/domain/types.ts
  - src/index.ts
  - src/ports/language-model-port.ts
  - src/ports/memory-store-port.ts
  - src/ports/run-state-store-port.ts
  - tests/constrained-tool-calling.test.ts
  - tests/extension-host.test.ts
  - tests/graph-executor.test.ts
  - tests/graph-planner.test.ts
  - tests/graph-workflow.test.ts
  - tests/integration-v15.test.ts
  - tests/mcp-skill-interoperability.test.ts
  - tests/memory-store.test.ts
  - tests/project-config-scopes.test.ts
  - tests/recursive-language-model.test.ts
  - tests/run-state-store.test.ts
  - tests/session-memory-bridge.test.ts
  - tests/session-store.test.ts
  - tests/web-tools.test.ts
  - ui/src/main.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z  
**Depth:** standard  
**Files reviewed:** 70 (diff range `becec86^..b5e8086`, excludes `.planning/` and lockfiles)  
**Status:** issues_found  

## Summary

Commits **becec86** (ESLint, Prettier, dependency-cruiser, `npm run check`) and **b5e8086** (Prettier on `src/`, remaining tests, and `ui/src/main.tsx`) were reviewed. Functional changes appear limited to ESLint-driven cleanups (e.g. renaming unused callback parameters with a `_` prefix) plus mechanical formatting.

Verification on current `HEAD`: `npm run lint`, `npm run format:check`, `npm run depcruise:ci`, and `npm test` (205 tests) all succeeded.

There are **no critical security or correctness defects** surfaced in tooling config or sampled diffs; remaining items are toolchain consistency and hygiene (below).

## Warnings

### WR-01: TypeScript program mode without type-checked ESLint presets

**File:** `eslint.config.js` (roughly lines 26–51, analogous block for UI at lines 46–52)

**Issue:** `parserOptions.project` points at `./tsconfig.json` and `./ui/tsconfig.json`, which makes the `@typescript-eslint` parser initialize project-wide type-awareness. The activated ruleset is `typescript-eslint`'s **`recommended`** only, **not** `recommendedTypeChecked` / `strictTypeChecked`. You pay TS program overhead on every lint without enabling the rulesets that leverage that overhead.

**Fix:** Either drop `parserOptions.project` (and rely on `@typescript-eslint` recommended rules that do not need type information), or adopt the corresponding type-checked config spread (per current `typescript-eslint` docs), e.g. replace `...tseslint.configs.recommended` with the appropriate `recommendedTypeChecked`/`strictTypeChecked` variant for Node and UI blocks.

---

### WR-02: Undocumented minimum Node requirement for ESLint flat config

**File:** `eslint.config.js:28` (`import.meta.dirname`); **`README.md`**: Prerequisites  

**Issue:** ESLint flat config relies on **`import.meta.dirname`**, available in newer Node releases (typically **≥ 20.11**). Prerequisites only say “modern ESM”; developers on older Node versions get a brittle failure running `npm run lint` without a documented floor.

**Fix:** Add `"engines"` in `package.json` (for example `{ "node": ">=20.11.0" }` aligned with ESLint/typescript-eslint docs) or state the explicit minimum Node version alongside `tsx`/`ESM` in README prerequisites—matching CI (currently Node 22 in `.github/workflows/package-smoke.yml`).

## Info

### IN-01: Prettier scope omits tooling JavaScript at repo root

**File:** `package.json` scripts `format`, `format:check`  

**Issue:** Prettier targets `src`, `tests`, and `ui/src` only; root-level authoring files (`eslint.config.js`, `.dependency-cruiser.js`, `scripts/**/*.mjs`, etc.) are not included in `--check`/CI format enforcement.

**Fix:** Extend Prettier CLI globs—e.g. `prettier --check .` with `.prettierignore` already excluding `dist/`, `coverage/`, and lockfiles—or add explicit paths for `eslint.config.js`, `.dependency-cruiser.js`, and `scripts/`.

---

### IN-02: Known architecture violations live in baseline

**File:** `dependency-cruiser-baseline.json`  

**Issue:** `--ignore-known` suppresses three **warn** severity layer violations (`no-adapters-to-application`, `no-domain-to-application`, `no-ports-to-application`). This is deliberate for phased cleanup but hides violations from failing CI (`depcruise:ci` exits clean while debt remains).

**Fix:** No urgency for Phase 36; optionally track removals in backlog or tighten rules once refactor lands.

---

_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
