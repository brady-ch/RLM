# Project Research Summary

**Project:** Recursive Language Model CLI (RLM) — v1.6 Architecture Cleanup  
**Domain:** Behavior-preserving structural refactor — TypeScript CLI + control-server UI monorepo  
**Researched:** 2026-05-22  
**Confidence:** HIGH

## Executive Summary

RLM v1.6 is not a feature milestone — it is a **behavior-preserving architecture cleanup** of an already sound layered codebase. The repo correctly separates CLI, application orchestration, domain policy, ports, and adapters; v1.5 graph modules fit this model. The debt is **file size and composition density**, not wrong boundaries. Four hotspots concentrate responsibility: `index.ts` (~607 LOC) as an implicit composition root, `project-config.ts` (~959 LOC) mixing types/schema/loader/resolver, `recursive-language-model.ts` (~2,322 LOC) as engine+quality-loop+tool-loop+graph-sync, and `recursive-language-model.test.ts` (~4,451 LOC). Partial extraction already exists in `runtime-composition.ts`.

Experts build this kind of cleanup with a **strangler pattern**: one extraction slice per PR, full test suite green after each slice, stable public seams preserved via barrel re-exports, and automation guardrails landed early so debt does not re-concentrate. The recommended approach is a five-wave build order: optional tooling baseline → config split → runtime bootstrap + thin entrypoint → domain engine decomposition (parallel with control-server factoring) → test restructure. Stack additions are minimal: ESLint 10 flat config, Prettier 3, dependency-cruiser for layer rules — no test framework migration, no Nx/Biome adoption.

The primary risks are **composition init order drift** when extracting runtime builders, **config export breakage** when splitting the monolith loader, and **accidental behavior changes** disguised as refactors. Mitigation is strict: single `buildRuntimeContext()` owns init order, facade re-exports preserve public API, one hotspot per phase, and test assertion changes require structural justification only. RLM engine decomposition carries the highest regression risk and needs a plan-phase spike on state threading between class and extracted modules.

## Key Findings

### Recommended Stack

Stack research confirms **no runtime stack changes** for v1.6. Existing TypeScript 6, Node ESM, React/Vite UI, Tauri shell, Ollama adapter, LangChain orchestration, and 205 `node:test` tests remain. Additions are dev-tooling only: ESLint + typescript-eslint for static analysis, Prettier for deterministic formatting, dependency-cruiser for module boundary enforcement aligned with AGENTS.md layer rules.

**Core technologies:**
- **ESLint 10 + typescript-eslint 8** — TypeScript-aware lint with flat config (`eslint.config.js`); `projectService: true` avoids brittle tsconfig wiring during file moves
- **Prettier 3 + eslint-config-prettier** — Separates style from semantics; reduces noisy diffs during large splits
- **dependency-cruiser 17** — Purpose-built for layered `forbidden`/`allowed` rules; validates `src/` and `ui/src/` separately; phased warn→error for known violations
- **node:test (keep)** — 15 test files / 205 tests; no Vitest/Jest migration benefit for a refactor-only milestone
- **c8 (optional)** — V8 coverage during refactor waves; not required for CI gate

Expand `npm run check` from `typecheck && test` to `typecheck && lint && depcruise && test` once baselines are triaged. Land format-only commit separately from logic refactors.

### Expected Features

**Must have (table stakes):**
- Zero behavior regression — all ~205 tests pass; CLI/UI/session/memory/graph flows unchanged
- Runtime composition extraction — `index.ts` becomes parse args → build runtime → dispatch; stores/extensions/tools/models wired in testable builders
- Config module split — loader, validation, resolution, defaults separated; public exports preserved via facade
- Obvious module responsibilities — no new 1k+ line files; contributors locate change points quickly
- Preserved layer boundaries — domain does not import application; adapters stay behind ports
- Contributor-visible module map — AGENTS.md reflects new layout

**Should have (differentiators):**
- Unit-testable runtime builders and config resolution — plugin/tool changes testable without subprocess CLI
- RLM engine concern modules — budget, tool loop, quality loop, graph sync extracted from monolith class
- Test file subsystem split with shared helpers — failures map to subsystems; integration anchor retained
- Lint/format scripts beyond typecheck alias — ESLint + Prettier baseline pass
- Control-server handler grouping — transport-only routes; session authority stays in execution-controller
- Import-boundary enforcement — dependency-cruiser rules prevent god-module re-creation

**Defer (post–v1.6):**
- Nx/Turborepo/pnpm workspace adoption — massive scope unrelated to single-package pain
- Full `@nx/enforce-module-boundaries`-style tags — only if repo splits into packages
- Vitest migration — no benefit for backend refactor; large churn cost
- `execution-controller.ts` deep split — cohesive but complex; highest approval/plan regression risk
- AST codemod pipeline — manual incremental extraction appropriate for ~66 TS source files
- 100% line coverage mandate — preserve integration coverage; add targeted unit tests at seams only

### Architecture Approach

Extend existing seams rather than introduce parallel architecture. Config splits stay in application; engine splits stay in domain; HTTP transport splits adjacent to control-server. Data flows unchanged: CLI/UI → application runners → domain RLM → ports → adapters. Primary deliverable is **locatable change points and unit-testable builders**.

**Major components:**
1. **`application/config/*`** — Split from `project-config.ts`: types, Zod schema, loader, resolver, validation; barrel re-export for ~20 import sites
2. **`application/bootstrap/`** — `RuntimeContext` + `buildRuntimeContext()` centralizing what `index.ts` does today; single init-order contract
3. **`cli/run-modes/*`** — Per-command dispatch extracted from entrypoint; receives built `RuntimeContext`
4. **`domain/recursion/*`** — Budget guard, tool loop, quality loop, execution-graph sync, prompt utils; class retains orchestration
5. **`application/control-server/handlers/*`** — Route modules for session, graph, workflows, model-library, static UI; transport only

### Critical Pitfalls

1. **Big-bang multi-hotspot refactor** — One extraction slice per PR; after each slice run full `npm run check`; never touch config + composition + RLM + tests simultaneously
2. **Composition init order drift** — Single `buildRuntimeContext()` owns full pipeline (extensions → MCP → tools → registry → model factory → execution → shutdown); add composition unit test asserting tool sets and cleanup registration
3. **Config export / validation regression** — Keep facade re-export surface; preserve error shapes with file/path context; run config tests before touching runtime composition
4. **Accidental behavior change disguised as refactor** — Log surprises as todos; no test assertion changes without structural justification; separate "fix" commits from "extract" commits
5. **RLM engine split changing recursion semantics** — Extract pure helpers first; keep class as orchestrator until parity tests pass; run RLM + graph-executor + integration-v15 after each peel
6. **Test split losing integration signal** — Create `tests/helpers/` first; move blocks verbatim; retain integration anchor; verify test count parity before/after

## Implications for Roadmap

Based on research, suggested phase structure for v1.6:

### Phase 0: Dev Tooling Guardrails (Optional Early Wave)
**Rationale:** Independent of extractions; freezes style before large diffs; enables consistent CI gate expansion  
**Delivers:** ESLint 10 flat config (CLI + UI blocks), Prettier baseline, dependency-cruiser with warn-severity layer rules, expanded `npm run check`  
**Addresses:** Lint/format guardrails (P2), import-boundary enforcement foundation (P3)  
**Avoids:** Lint churn hiding regressions — format-only commit separated from logic  
**Uses:** ESLint, Prettier, dependency-cruiser from STACK.md

### Phase 1: Config Split (Foundation — Critical Path Start)
**Rationale:** Runtime builders depend on resolved config types; ~20 import sites need stable facade before bootstrap extraction  
**Delivers:** `application/config/*` modules (types, schema, loader, resolver, validation), barrel re-export, focused unit tests  
**Addresses:** Config loader/validation/resolution split (P1), unit-testable config resolution (P2)  
**Avoids:** Config export breakage, validation semantics drift, ESM import mismatches  
**Uses:** Barrel-preserving module split pattern; no new dependencies

### Phase 2: Runtime Bootstrap + Slim Entrypoint (Critical Path)
**Rationale:** Depends on Phase 1 stable config imports; unblocks control-server injection tests; highest maintainer value  
**Delivers:** `RuntimeContext`, `buildRuntimeContext()`, `cli/run-modes/*`, `index.ts` <150 LOC, bootstrap unit tests  
**Addresses:** Runtime composition extraction (P1), thin CLI entrypoint (P1), unit-testable runtime builders (P2), no duplicated registration logic (P1)  
**Avoids:** Init order drift, extension/tool registration duplication, env/mode branching regression, desktop smoke break  
**Implements:** Composition root extraction pattern; single registration pipeline for ExtensionHost + interop tools

### Phase 3: Domain Engine Decomposition (Parallel-Safe After Phase 1)
**Rationale:** Highest regression risk but independent of bootstrap if different authors; can proceed parallel with Phase 4  
**Delivers:** `domain/recursion/*` modules (budget-guard, tool-loop, quality-loop, execution-graph-sync, prompt-utils), slimmed orchestrator class  
**Addresses:** RLM concern modules (P2), reduced regression risk on graph/recursion changes  
**Avoids:** RLM semantics drift, domain importing application types, application importing domain internals  
**Research flag:** Plan-phase spike needed on state threading between class and extracted modules

### Phase 4: Control-Server Boundary Clarification (Parallel-Safe After Phase 2)
**Rationale:** Handlers need injected `SessionRuntimeRef` from bootstrap; transport-only factoring without session authority split  
**Delivers:** `control-server/handlers/*`, route dispatcher, `types.ts`, documented HTTP boundary  
**Addresses:** Control-server handler grouping (P3), documented UI/control-server boundary (table stakes)  
**Avoids:** UI/control-server boundary blur, API drift, logic migrating into route handlers  
**Uses:** Handler module pattern; preserve endpoint paths and JSON shapes

### Phase 5: Test Restructure + Docs (Last — After Module Paths Stabilize)
**Rationale:** Avoid moving tests twice; module names must stabilize first; depends on Waves 1–4  
**Delivers:** `tests/application/config/`, `tests/domain/recursion/`, `tests/integration/`, `tests/helpers/`, split RLM test file, updated AGENTS.md  
**Addresses:** Subsystem-aligned test files (P2), shared test fixtures (P2), contributor module map (P1)  
**Avoids:** Test split coverage loss, integration signal gaps  
**Uses:** node:test (keep); recursive `dist/tests/**/*.test.js` glob

### Phase Ordering Rationale

- **Config before bootstrap:** Runtime builders call `loadProjectConfig` and resolvers; splitting config first provides narrow imports without breaking callers via facade
- **Bootstrap before control-server:** `startControlServer` must receive composed `SessionRuntimeRef` from builder, not construct stores inline
- **RLM split parallel with control-server:** Both depend on Phase 1 only; different risk profiles allow concurrent work if authors coordinate on full-suite gates
- **Tests last:** Module path churn during Phases 1–4 would force double moves; helpers extracted first when splitting
- **Tooling early or late:** Phase 0 recommended to reduce format noise in extraction PRs; can defer if capacity constrained

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (RLM decomposition):** State threading between `RecursiveLanguageModel` class and extracted modules; quality-loop extraction boundaries need plan-phase spike
- **Phase 2 (Bootstrap lifecycle):** Verify cleanup order matches current `index.ts` when extracted — shutdown, MCP child processes, memory release
- **Phase 0 (ESLint rules):** Choose minimal rule set aligned with existing style; type-checked rules added selectively after baseline

Phases with standard patterns (skip research-phase):
- **Phase 1 (Config split):** Existing loader behavior documented; mechanical split with barrel re-export
- **Phase 4 (Control-server):** Standard HTTP handler factoring; session authority unchanged
- **Phase 5 (Test restructure):** node:test patterns established; folder taxonomy mirrors module boundaries

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against npm registry, typescript-eslint/ESLint 10 peer ranges, repo `package.json` and `docs/TESTING.md`; phased boundary strictness MEDIUM due to existing violations |
| Features | HIGH | Grounded in PROJECT.md, CONCERNS.md, live file metrics, v1.6 todos; ecosystem patterns MEDIUM |
| Architecture | HIGH | Live `src/` layout, `docs/ARCHITECTURE.md`, partial `runtime-composition.ts` extraction; build order validated against import fan-in |
| Pitfalls | HIGH | Repo-specific pitfalls from live wiring; composition-root and ESM patterns from official docs MEDIUM |

**Overall confidence:** HIGH

### Gaps to Address

- **Existing boundary violations:** `domain/agents.ts` → application, `ports/extension-port.ts` → application — dependency-cruiser rules start at warn severity; ratchet to error per extraction phase
- **RLM quality-loop state threading:** Needs plan-phase spike before Phase 3 execution; identify which state passes explicitly vs stays on class
- **UI import audit:** Verify `ui/src/**` does not import `src/**` directly; add dependency-cruiser rule if violations found
- **Bootstrap cleanup order:** Document and test shutdown sequence during Phase 2 planning; compare against current `index.ts` implicit contract
- **Vitest reference in milestone prompt:** Confirmed out of scope — all 15 test files use `node:test` only

## Sources

### Primary (HIGH confidence)
- RLM `.planning/PROJECT.md` — v1.6 milestone scope, success criteria, constraints
- RLM `.planning/codebase/CONCERNS.md` — hotspot files and priorities
- RLM `src/index.ts`, `project-config.ts`, `runtime-composition.ts`, `recursive-language-model.ts`, `control-server.ts` — live metrics and partial extraction state
- RLM `package.json`, `tsconfig.json`, `docs/TESTING.md`, `AGENTS.md` — current baseline
- `/typescript-eslint/typescript-eslint` (Context7) — flat config, `projectService`, ESLint 10 compatibility
- `/eslint/eslint` (Context7) — flat config ESM pattern
- `/sverweij/dependency-cruiser` (Context7) — layered forbidden rules, CLI validation
- [dependency-cruiser rules tutorial](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-tutorial.md) — path-based layer enforcement
- TypeScript Handbook, [ECMAScript Modules in Node.js](https://www.typescriptlang.org/docs/handbook/esm-node.html) — `.js` import specifiers
- npm registry (`npm view`, 2026-05-22) — version numbers

### Secondary (MEDIUM confidence)
- [Nx enforce module boundaries](https://nx.dev/docs/features/enforce-module-boundaries) — boundary enforcement pattern adapted for single package
- [Marmicode boundaries cookbook](https://cookbook.marmicode.io/nx/boundaries) — layer dependency constraints
- Mark Ploeh, [Composition Root](https://blog.ploeh.dk/2011/07/28/CompositionRoot/) — single composition location
- `.planning/notes/architecture-boundary-cleanup-direction.md` — two-pass extraction strategy
- Incremental extraction / strangler refactor practice — behavior preservation patterns

### Tertiary (LOW confidence)
- mherod/resect structural-refactor docs — barrel/import update caution; not needed unless repeated cross-module moves become routine

---
*Research completed: 2026-05-22*  
*Ready for roadmap: yes*
