# Pitfalls Research

**Domain:** Behavior-preserving architecture cleanup — TypeScript CLI + control-server UI monorepo  
**Milestone:** v1.6 — Architecture Cleanup  
**Researched:** 2026-05-22  
**Confidence:** HIGH for repo-specific pitfalls (live file metrics, CONCERNS.md, v1.6 todos, 205-test harness); MEDIUM for ecosystem patterns (composition-root guidance, monorepo refactor tooling — verified against official TypeScript ESM docs and published refactor practice)

## Critical Pitfalls

### Pitfall 1: Big-Bang Multi-Hotspot Refactor

**What goes wrong:**
A single change set simultaneously extracts `src/index.ts` wiring, splits `project-config.ts`, decomposes `recursive-language-model.ts`, and renames test files. CI goes red with dozens of failures; reviewers cannot tell whether a regression is composition-order drift, config resolution change, engine logic change, or a broken import path.

**Why it happens:**
All hotspots feel related (“architecture cleanup”), so teams batch them to “finish the milestone faster.” The repo’s largest files (`index.ts` ~607 lines, `project-config.ts` ~959, `recursive-language-model.ts` ~2,322, `recursive-language-model.test.ts` ~4,451) tempt a directory-tree rewrite instead of incremental strangler extraction.

**How to avoid:**
One extraction slice per phase/PR: split config **or** extract runtime builders **or** peel one RLM concern **or** move one test cluster — never all four. After each slice: `npm run check` (typecheck + full test build). Keep module paths stable until the new seam has its own unit tests.

**Warning signs:**
- Diff touches 15+ files across `src/index.ts`, `project-config.ts`, `recursive-language-model.ts`, and `tests/` in one commit.
- PR description says “moved everything to the new layout.”
- Failures span CLI, UI control-server, and graph execution with no single root cause.

**Phase to address:**
Phase 1 (milestone planning / first extraction) — enforce slice boundaries before any code moves.

---

### Pitfall 2: Composition Root Initialization Order Drift

**What goes wrong:**
Extracting runtime builders shuffles the boot sequence in `src/index.ts`. Extensions load after MCP tools, memory manifest is written before `MemoryResolver` exists, `ResourceCleanup.track()` is never called for MCP child processes, or shutdown handlers fire before the control server closes. Symptoms: flaky tests, orphaned MCP subprocesses, missing interop tools on agents, or UI sessions that start but cannot execute.

**Why it happens:**
Today’s order is implicit in a 600-line `main()` — not documented as a contract. Extractors copy blocks into functions without preserving dependencies: `ExtensionHost.loadBuiltins` → `loadExternal` → `createMcpTools` (with `cleanup.track`) → `createToolsResolver` → agent registry → model factory → execution control → shutdown registration. Each step assumes prior side effects (e.g., interop tools registered on `extensionHost` before `toolsFor("default")`).

**How to avoid:**
Introduce a single `buildRuntimeContext()` (or equivalent) that returns a typed context object and documents init order in code comments only where non-obvious. Add a focused unit test that asserts: built-in tools present, configured extensions loaded, interop tools deduped against agent tool lists, cleanup registry receives MCP closers, shutdown invokes `cancellation.cancel` then `memoryManager.releaseAll` then `cleanup.closeAll`. Do not split init across multiple exported functions callers can reorder.

**Warning signs:**
- New builder functions are independently callable in any order.
- `createMcpTools` callback no longer passes child kill handles to cleanup.
- UI mode works on second launch but not first (store init race).
- `detectOpenHandles` or hanging CI after control-server tests.

**Phase to address:**
Phase 2 — Runtime composition extraction from CLI entrypoint.

---

### Pitfall 3: Breaking Config Public Exports and Validation Semantics

**What goes wrong:**
Splitting `project-config.ts` renames or relocates `loadProjectConfig`, `resolveRuntimeConfig`, `applyModelOverride`, `resolveRuntimeHostSelection`, `resolveModelTier`, and type guards (`isGraphWorkflowConfig`). Callers in tests (15 files), `agent-runner`, `workflow-runner`, desktop packaging scripts, and docs break. Worse: validation errors lose file path / YAML key context, so users see generic Zod messages instead of actionable config failures — violating the “no silent failures” product constraint.

**Why it happens:**
Splitters create narrow internal modules and update imports aggressively instead of keeping a facade re-export surface. Validation moves to a new file but catch blocks no longer attach `loadedConfig.path` or merge-layer identity.

**How to avoid:**
Split internals first; keep `project-config.ts` (or `project-config/index.ts`) as a stable facade that re-exports the same public API until all callers migrate deliberately. Preserve error shapes in tests — especially `tests/project-config-scopes.test.ts` and host/tier routing tests. Run config tests after every split slice before touching runtime composition.

**Warning signs:**
- Grep shows imports changing from `./project-config.js` to four different new paths in one PR.
- Config test failures only show Zod issue paths without project file context.
- `resolveRuntimeHostSelection` behavior changes when `process.env` or CLI `--host` is set (regression in `tests/model-host-routing.test.ts`).

**Phase to address:**
Phase 1 — Config loader / validation / resolution split (before runtime composition).

---

### Pitfall 4: Accidental Behavior Change Disguised as “Natural Fix”

**What goes wrong:**
While extracting code, a developer “fixes” a long-noticed bug (starter seed timing, default tier fallback, quality-loop budget edge case, replan protection). Tests are updated to match. v1.6 milestone scope is violated; regressions cannot be bisected to structure vs semantics.

**Why it happens:**
Large files encode years of implicit behavior; refactors feel like the “right time” to correct quirks. PROJECT.md allows “small natural fixes only,” which is interpreted too broadly.

**How to avoid:**
Log behavioral surprises as `.planning/todos/` items; do not fix in v1.6 unless blocking extraction (e.g., untestable side effect). Require failing-before / passing-after proof that existing tests did not change expectations. Any test assertion edit must cite the structural reason (import path, mock relocation), not new expected outputs.

**Warning signs:**
- Commit messages mention “fix” or “improve” rather than “extract” or “move.”
- Test diffs change expected JSON payloads, exit codes, or error strings.
- New feature flags or CLI flags appear in a refactor branch.

**Phase to address:**
All phases — treat as a cross-cutting gate in plan verification.

---

### Pitfall 5: Extension and Tool Registration Duplication or Reordering

**What goes wrong:**
Built-in extensions (`guarded-shell`, `workspace-file-write`, `web-search`, `web-fetch`), config-driven external extensions, and interop tools (MCP + skill) get registered in multiple composition paths — or interop tools are appended in a different order. Agents see duplicate tool names, wrong allowlist enforcement, or missing MCP tools because `createToolsResolver` filters interop tools against configured names differently than before.

**Why it happens:**
v1.1 invested in `ExtensionHost` as the unified registration surface, but wiring still lives inline in `index.ts`. Extractors copy registration into both a “runtime builder” and a “UI builder” without shared helper.

**How to avoid:**
One function owns the full registration pipeline: `loadBuiltins` → `loadExternal` (with allowlist + interactive TTY rules) → register interop tools on host → return `toolsFor` resolver. UI and CLI modes must call the same function. Extend `tests/extension-host.test.ts` or add composition tests that assert tool name sets per agent profile match pre-refactor snapshots.

**Warning signs:**
- `extensionHost.tools.register` appears in more than one module.
- `createToolsResolver` duplicated with slightly different interop merge logic.
- MCP tools present in CLI agent run but absent in UI confirm-run path (or vice versa).

**Phase to address:**
Phase 2 — Runtime composition extraction.

---

### Pitfall 6: RLM Engine Split That Changes Recursion Semantics

**What goes wrong:**
Extracting budgeting, tool-round loops, or graph-event mirroring from `recursive-language-model.ts` subtly alters `maxModelCalls` enforcement, tool round caps, quality-loop phase routing, or `ExecutionControl` callback timing. Graph execution (`GraphExecutor`), approval gates, and quality-loop metadata diverge — often without failing tests if mocks are too coarse.

**Why it happens:**
The 2,322-line class interleaves policy with private helpers (`parseQualityLoopGate`, `clamp`, graph registration side effects). Extractors move methods but break shared mutable state (`this` counters, loop metadata objects passed by reference).

**How to avoid:**
Extract **pure helpers first** (parsers, budget math, message builders) into modules with no class state. Keep `RecursiveLanguageModel` as the orchestrator until parity tests pass. Only then consider delegating sub-policies to injected strategy objects. Run `tests/recursive-language-model.test.ts`, `tests/constrained-tool-calling.test.ts`, `tests/graph-executor.test.ts`, and `tests/integration-v15.test.ts` after each peel. Prefer package-private exports over public API expansion.

**Warning signs:**
- New modules import `ExecutionControl` or session types into `src/domain/` (layer violation).
- Tool round count or model call budget differs on identical mock queues.
- Quality-loop stop reasons or rubric selection change without test updates.

**Phase to address:**
Phase 3 — RLM concern decomposition (budgeting, tool loops, graph events).

---

### Pitfall 7: Test Suite Split That Loses Integration Signal

**What goes wrong:**
The 4,451-line `tests/recursive-language-model.test.ts` is split by filename, but shared `QueueModel` fixtures, control-server bootstrapping, and cross-subsystem scenarios are dropped or duplicated inconsistently. Coverage appears improved (more files) while regressions slip through gaps between new files. Alternatively, tests are rewritten “cleanly” instead of moved — losing historical edge cases.

**Why it happens:**
Splitters optimize for file size, not failure ownership. Node test runner runs all `dist/tests/*.test.js` with no tag filtering, so splitting alone does not require harness changes — encouraging careless moves.

**How to avoid:**
Create `tests/helpers/` (or `tests/fixtures/`) first with shared mocks (`QueueModel`, registry setup, control-server boot). **Move** test blocks verbatim; do not rewrite assertions. Keep at least one integration-heavy file (`integration-v15.test.ts` pattern) unchanged as an anchor. After split, count test cases before/after (must match). Run full suite, not `-g` filters, before merge.

**Warning signs:**
- Test count drops after “restructure” PR.
- Duplicate 200-line mock classes in three files.
- Scenarios that touched CLI + control-server + RLM now exist only in unit-isolated tests with over-mocked boundaries.

**Phase to address:**
Phase 4 — Test restructure (after module names stabilize).

---

### Pitfall 8: UI / Control-Server Boundary Blur or API Drift

**What goes wrong:**
Refactor pushes store construction or extension loading into `control-server.ts` route handlers, or `SessionRuntimeRef` shape changes so UI save/reopen, memory injection, or `onConfirmRun` wiring breaks. Desktop Tauri shell (`src-tauri/` starts packaged `rlm ui`) still launches, but session restore, model library routes, or graph mutation endpoints behave differently.

**Why it happens:**
`control-server.ts` (~720 lines) is itself a hotspot; teams “finish” extraction by inlining dependencies rather than injecting them from the composition root. HTTP routes are easier to edit than `index.ts`, so logic migrates the wrong direction.

**How to avoid:**
Composition root builds `{ session, sessionStore, memory, modelLibrary, sessionRuntime, onConfirmRun }` and passes it to `startControlServer`. Route handlers stay thin delegates. Preserve endpoint paths and JSON shapes documented in `docs/UI.md`. Run control-server-dependent tests and manual smoke: `POST /api/chat/confirm-run`, session save/reopen, graph plan endpoints.

**Warning signs:**
- `control-server.ts` imports from `src/extensions/` or constructs `ExtensionHost`.
- `createUiExecutionRunner` inputs differ between refactored builder and old inline wiring.
- UI works via `npm run dev:ui` (Vite proxy) but fails via `rlm ui` (bundled dist + server).

**Phase to address:**
Phase 5 — UI / control-server composition boundary clarity.

---

### Pitfall 9: ESM Import Path and Build Output Mismatches

**What goes wrong:**
New modules use incorrect relative specifiers (`./foo` without `.js`), or tests import from `src/` while runtime uses `dist/`. `npm test` runs `tsc` then `node --test dist/tests/*.test.js` — source-only refactors pass IDE checks but fail in CI. Circular imports surface only at runtime.

**Why it happens:**
Repo uses `"type": "module"` with TypeScript emitting to `dist/`. Splitting files multiplies import edges; without `tsc --noEmit` and full test build, broken paths slip through.

**How to avoid:**
Every new module uses `.js` extensions in relative imports (existing convention). After each extraction: `npm run typecheck` and `npm test`. Watch for circular imports between new `application/runtime-*` modules and `index.ts`. Do not introduce barrel `index.ts` re-exports unless updating all consumers in the same slice — partial barrels cause duplicate singletons.

**Warning signs:**
- `Cannot find module './runtime-config-resolution.js'` at test runtime.
- `tsc` succeeds but `node --test dist/...` throws `ERR_MODULE_NOT_FOUND`.
- New `application/index.ts` re-exports half the layer.

**Phase to address:**
Phases 1–2 — any file split (config or composition).

---

### Pitfall 10: Environment and Mode Branching Regression

**What goes wrong:**
Extracted builders mishandle command-specific branches: UI-only starter seed (`seedProjectRlmStarter` when no `rlm.config.yaml`), `RLM_SKIP_STARTER_SEED`, `RLM_EMBED_MODEL`, `RLM_UI_DIST`, TTY-gated extension approval, `plan-only` / `require-approval`, workflow-import early exit, and `resolveRuntimeHostSelection({ cliHostId, env })`. A generic builder runs seed logic for CLI agent mode or skips allowlist interactivity in UI mode.

**Why it happens:**
Mode switches are scattered across `main()` if/else chains; extraction to shared builder collapses branches incorrectly.

**How to avoid:**
Keep command dispatch in `index.ts`; pass a resolved `CliOptions` + `command` enum into builders. Document mode-specific flags on the builder input type. Preserve early-return commands (`workflow-import`, `help`, `plan-node` JSON output) in entrypoint, not inside shared runtime init.

**Warning signs:**
- Starter seed runs on `rlm agent` invocations.
- Extension load throws in CI where `interactive: false` is required.
- Host selection ignores CLI `--host` after refactor.

**Phase to address:**
Phase 2 — Runtime composition extraction.

---

## Technical Debt Patterns

Shortcuts that seem reasonable during cleanup but recreate debt.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Facade re-export file that grows unbounded | Stable imports during split | New “god facade” replacing god module | Temporarily in Phase 1; delete re-exports once callers updated |
| `shared/utils` or `common/helpers.ts` for extracted snippets | Faster compile | Unclear ownership; circular imports | Never — colocate with owning concern |
| Duplicate composition for CLI vs UI | Unblocks UI milestone | Two boot paths diverge | Never — single builder with mode flags |
| `@ts-ignore` / `any` to break import cycles | Unblocks PR | Hidden layer violations | Never |
| Defer tests for new builders (“structure only PR”) | Smaller diff | Untested init order rots | Never for composition root |
| Mass Prettier reformat before extraction | “Clean baseline” | Review noise hides regressions | Only as dedicated Phase 0 with no logic changes |
| Keep all logic in `RecursiveLanguageModel` class | Avoids state split risk | 2k+ line file persists | Only if Phase 3 capacity exhausted — extract pure helpers still |

---

## Integration Gotchas

Common mistakes when connecting subsystems during refactor (not external SaaS).

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **ExtensionHost + allowlist** | Hardcode allowlist path or skip TTY check after move | Resolve allowlist relative to config file dir; pass `interactive: process.stdin.isTTY && process.stdout.isTTY` |
| **MCP child processes** | Lose `cleanup.track({ close: () => child.kill() })` | Register every MCP spawn with `ResourceCleanup` in composition builder |
| **Desktop Tauri shell** | Break CLI entry shebang or `bin` path in `package.json` | Keep `dist/src/index.js` as bin; smoke `npm run package:smoke` after entry refactor |
| **UI static assets** | Change `resolveUiDistDir` call site or env precedence | Preserve `RLM_UI_DIST` override; composition passes `uiDistDir` to `startControlServer` |
| **Session memory restore** | Reorder `restoreSessionMemory` vs `createMemoryForRun` | Match current `index.ts` UI branch: restore → new runId → rebind vector index → `sessionRuntime` ref |
| **Graph workflow sidecars** | Import loader from wrong config module | Keep `loadGraphWorkflow` / export paths on stable application API |
| **PurposeRoutingLanguageModel** | Rebuild with stale `hostSelection` after config split | Compose from `resolveRuntimeHostSelection(projectConfig, { cliHostId, env })` after full config resolution |
| **Agent registry tool bundles** | Call `toolsFor(id)` before extensions registered | Register all tools on host before `createAgentRegistry` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Full rebuild per test run** | Slow local iteration during refactor | Accept for v1.6; use `npm run typecheck` between micro-edits, full `npm test` at slice boundaries | Every extraction PR (~205 tests × build) |
| **Model instance cache key change** | Duplicate Ollama connections, RAM spike | Preserve `createModelFactory` cache key `${hostId}:${model}` | Multi-agent workflow runs after composition move |
| **Accidental per-request extension reload** | UI plan/run latency, allowlist prompts | Load extensions once per process in builder | UI session with multiple confirm-run cycles |
| **Synchronous graph in test helpers** | Flaky SSE/event ordering tests | Keep event polling patterns from existing tests when splitting | Control-server tests split across files |
| **Lint on entire repo mid-refactor** | Thousands of unrelated warnings | Land lint baseline as separate commit or Phase 0 | First ESLint introduction |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Extension allowlist path traversal or cwd sensitivity** | Unapproved code execution if path resolution changes | Keep `resolve(configDir, entry.path)` and `allowlistKey(absPath)` logic byte-identical; test in `extension-host.test.ts` |
| **Shell tool registration omitted** | Agents run without allowlist guard | Ensure `guarded-shell.extension` remains in built-in registration list |
| **Interactive approval bypass** | CI or headless loads unapproved extensions | Preserve `interactive: false` throw path for non-TTY |
| **Capability tokens on run state** | Session hijack if regen logic changes | Do not refactor `runState.capabilityToken` format during v1.6 |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **Error message vocabulary drift** | UI/CLI show different failure text for same fault | Move strings with handlers; run integration-v15 parity tests |
| **Silent fallback reintroduced** | Failed config/load falls back to defaults | Preserve explicit throws from validation module |
| **Exit code changes** | Scripts relying on non-zero failure break | Keep `process.exitCode = 1` paths in entrypoint dispatch, not buried in builders |
| **Starter seed surprise** | New `.rlm/` created on wrong command | Gate seed to UI command branch only |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Runtime extraction:** `index.ts` still constructs `ExtensionHost`, `McpSkillRuntime`, or stores inline — verify grep for `new ExtensionHost` / `new FileSessionStore` only in composition module
- [ ] **Config split:** Callers still import internal validation types — verify public surface unchanged via re-export audit
- [ ] **RLM decomposition:** Line count dropped but class still contains tool loop + budget + graph events — verify at least one concern extracted with tests
- [ ] **Test split:** File count increased but scenario count dropped — compare `node --test --list` or test case count before/after
- [ ] **Lint/format:** `npm run lint` still aliases `typecheck` only — verify ESLint/Prettier actually runs if claimed
- [ ] **UI boundary:** `control-server.ts` imports adapters directly for construction — verify only receives injected ports/services
- [ ] **Desktop path:** `package:smoke` not run after entry refactor — verify packaged binary starts UI
- [ ] **Plugin path:** External extension load order matches pre-refactor — verify integration test with fixture extension

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Big-bang refactor with mixed failures | HIGH | Revert to last green commit; re-apply one slice at a time with bisect |
| Init order / resource leak | MEDIUM | Compare shutdown logs; restore `ResourceCleanup.track` calls; add composition unit test |
| Config export break | LOW–MED | Restore facade re-exports; forward to new modules internally |
| Test split coverage gap | MEDIUM | Restore verbatim tests from git history; add missing scenarios to integration anchor file |
| UI/API drift | MED–HIGH | Diff JSON responses against pre-refactor captures; run `integration-v15.test.ts` + manual UI smoke |
| Accidental behavior change | HIGH | Revert semantic commits; file follow-up todo; restore original assertions |

---

## Pitfall-to-Phase Mapping

How v1.6 roadmap phases should prevent these pitfalls. Phase numbers follow dependency order from FEATURES.md (config → composition → engine → tests → lint → UI boundary).

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Big-bang multi-hotspot refactor | Phase 1 (planning gate) | PR touches ≤1 hotspot domain; checklist in plan |
| Config export / validation regression | Phase 1 — Config split | `project-config-scopes`, `model-host-routing` tests green; error messages include path |
| ESM import / build mismatches | Phase 1–2 | `npm test` full dist run passes |
| Composition init order drift | Phase 2 — Runtime composition | Composition unit test; no orphan MCP processes |
| Extension/tool registration duplication | Phase 2 | Tool name snapshot per agent; extension-host tests |
| Env/mode branching regression | Phase 2 | UI seed, CLI no-seed, headless extension tests |
| Accidental behavior change | All phases | No test assertion changes without structural justification |
| RLM semantics drift | Phase 3 — Engine decomposition | RLM + graph-executor + integration-v15 green |
| Test split coverage loss | Phase 4 — Test restructure | Test count parity; helpers extracted first |
| Lint churn hiding regressions | Phase 5 — Lint/format (optional early) | Format-only commits separated by git history |
| UI/control-server boundary blur | Phase 5 — UI boundary | `control-server` grep for `ExtensionHost`; API docs unchanged |
| Desktop/smoke break | Phase 2 or 5 | `npm run package:smoke` on entry changes |

---

## Sources

- RLM `.planning/PROJECT.md` — v1.6 milestone scope, success criteria, constraints
- RLM `.planning/codebase/CONCERNS.md` — hotspot files and suggested mitigations
- RLM `.planning/todos/pending/2026-05-22-*.md` — extraction acceptance checks
- RLM `.planning/research/FEATURES.md` — dependency order, anti-features, phase priorities
- RLM `src/index.ts`, `src/application/runtime-composition.ts`, `src/application/extension-host.ts`, `package.json` — live wiring and test harness
- RLM v1.2 milestone audit — UI vs engine process split warning (MODL-05 merge precedence precedent)
- Mark Ploeh, [Composition Root](https://blog.ploeh.dk/2011/07/28/CompositionRoot/) — single composition location, libraries without containers (MEDIUM confidence for TS CLI mapping)
- TypeScript Handbook, [ECMAScript Modules in Node.js](https://www.typescriptlang.org/docs/handbook/esm-node.html) — `.js` import specifiers (HIGH)
- mherod/resect, structural-refactor docs — barrel/import update caution during moves (MEDIUM)
- Go test-splitting practice guides — preserve scenario boundaries when splitting large test files (MEDIUM)

---
*Pitfalls research for: v1.6 Architecture Cleanup — behavior-preserving refactor*  
*Researched: 2026-05-22*
