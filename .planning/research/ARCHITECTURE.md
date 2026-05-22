# Architecture Research: v1.6 Architecture Cleanup

**Domain:** Local recursive LM CLI + interactive execution graph (behavior-preserving refactor)  
**Milestone:** v1.6 Architecture Cleanup  
**Researched:** 2026-05-22  
**Confidence:** HIGH (grounded in live `src/` layout, `docs/ARCHITECTURE.md`, and v1.5 shipped components)

## Executive Summary

v1.6 is a **behavior-preserving structural refactor** across an already sound layered architecture. The repo correctly separates CLI (`src/cli/`, `src/index.ts`), application orchestration (`src/application/`), domain policy (`src/domain/`), ports (`src/ports/`), and adapters (`src/adapters/`). v1.5 added graph planning/execution modules that fit this model; the debt is **file size and composition density**, not wrong boundaries.

Four files concentrate too much responsibility: `index.ts` (~607 LOC) as composition root, `project-config.ts` (~959 LOC) as types+schema+loader+resolver, `recursive-language-model.ts` (~2,322 LOC) as engine+quality-loop+tool-loop+graph-sync, and `execution-controller.ts` (~1,888 LOC) as session authority (out of scope for first wave except UI boundary clarity). A partial extraction already exists: `runtime-composition.ts` holds `createToolsResolver` and `createModelFactory`; `run-recursive-prompt.ts` wraps the domain engine for application callers.

The refactor should **extend existing seams**, not introduce a parallel architecture. Config splits stay in application; engine splits stay in domain; HTTP transport splits stay adjacent to `control-server.ts`. Data flows remain unchanged: CLI/UI → application runners → domain RLM → ports → adapters. The primary deliverable is **locatable change points and unit-testable builders**, not new features.

---

## Standard Architecture

### System Overview (Post-v1.5, Pre-v1.6 Cleanup)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Entry & I/O                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────────────┐  │
│  │ index.ts    │  │ cli/args     │  │ ui/ (React) + Tauri shell       │  │
│  │ (composition│  │ render       │  │                                 │  │
│  │  root — fat)│  │ shutdown     │  └──────────────┬──────────────────┘  │
│  └──────┬──────┘  └──────────────┘                 │ HTTP                  │
├─────────┴──────────────────────────────────────────┴──────────────────────┤
│  Application orchestration (src/application/)                            │
│  ┌────────────────┐ ┌─────────────────┐ ┌────────────────────────────┐  │
│  │ bootstrap *    │ │ execution-      │ │ graph-planner / executor   │  │
│  │ (new, from     │ │ controller      │ │ workflow-runner            │  │
│  │  index.ts)     │ │ (session auth)  │ │ ui-execution-runner        │  │
│  ├────────────────┤ ├─────────────────┤ ├────────────────────────────┤  │
│  │ config/* *     │ │ control-server  │ │ agent-runner, model-provider│  │
│  │ (split from    │ │ (HTTP transport)│ │ memory, interop, extensions │  │
│  │  project-config)│ └────────┬────────┘ └─────────────┬──────────────┘  │
│  └────────┬───────┘          │                          │                 │
├───────────┴──────────────────┴──────────────────────────┴─────────────────┤
│  Domain policy (src/domain/)                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │ recursive-language-model.ts  │  │ recursion/* * (budget, tools,    │  │
│  │ (orchestrator — fat)         │  │ quality-loop, graph-sync)        │  │
│  └──────────────┬───────────────┘  └──────────────────────────────────┘  │
├─────────────────┴──────────────────────────────────────────────────────────┤
│  Ports (src/ports/)          │  Adapters (src/adapters/, extensions/)     │
└──────────────────────────────┴────────────────────────────────────────────┘

* = proposed v1.6 extractions
```

### Component Responsibilities (Current vs Target)

| Component | Layer | Owns today | v1.6 target |
|-----------|-------|------------|-------------|
| `index.ts` | CLI entry | Args dispatch, store wiring, extension/interop bootstrap, all run modes | Thin `main()`: parse args → `buildRuntimeContext()` → mode handler |
| `runtime-composition.ts` | Application | Model factory, tools resolver, `readablePath` | Expand to full runtime bootstrap; or sibling `bootstrap/` modules |
| `project-config.ts` | Application | Types, Zod schema, YAML load/merge, resolution, validation, defaults | Split into `config/*` with barrel re-export |
| `recursive-language-model.ts` | Domain | Full recursion, quality loop, tool rounds, execution graph sync, parsers | Orchestrator class + `domain/recursion/*` modules |
| `run-recursive-prompt.ts` | Application | Thin RLM wrapper | Unchanged — stable integration point |
| `execution-controller.ts` | Application | Graph session authority, plan/replan, approvals | Unchanged structurally; control-server calls it |
| `control-server.ts` | Application | HTTP routing, JSON handlers, static UI, session bridge | Route modules + handler files; transport only |
| `ui-execution-runner.ts` | Application | UI confirm → `GraphExecutor` | Unchanged; receives deps from bootstrap |
| `GraphPlanner` / `GraphExecutor` | Application | v1.5 graph authoring/execution | Unchanged; benefit from cleaner config/bootstrap imports |

---

## Recommended Project Structure

```
src/
├── index.ts                          # Composition root (target: <150 LOC)
├── cli/
│   ├── args.ts                       # Unchanged
│   ├── render.ts
│   ├── shutdown.ts
│   └── run-modes/                    # NEW — extracted from index.ts
│       ├── headless-agent.ts
│       ├── headless-workflow.ts
│       ├── ui-mode.ts
│       ├── plan-node.ts
│       └── session-admin.ts          # session-list, memory-inspect, workflow import/export
├── application/
│   ├── bootstrap/                    # NEW — runtime wiring
│   │   ├── runtime-context.ts        # RuntimeContext type (all wired deps)
│   │   ├── build-runtime-context.ts  # Stores, extension host, interop, registry
│   │   └── build-interop-runtime.ts  # MCP/skill tools (optional sub-split)
│   ├── config/                       # NEW — split from project-config.ts
│   │   ├── index.ts                  # Barrel re-export (backward compat)
│   │   ├── project-config-types.ts   # Interfaces, MODEL_PURPOSES, type guards
│   │   ├── config-schema.ts          # Zod schemas only
│   │   ├── config-loader.ts          # loadProjectConfig, scoped fragments, seed
│   │   ├── config-resolver.ts        # resolveRuntimeConfig, applyModelOverride, hosts
│   │   └── config-validation.ts      # validateConfigReferences, merge helpers
│   ├── runtime-composition.ts        # KEEP — model/tools factories (may merge into bootstrap)
│   ├── control-server/
│   │   ├── index.ts                  # startControlServer (public API)
│   │   ├── routes.ts                 # Route table / dispatch
│   │   ├── handlers/
│   │   │   ├── session.ts
│   │   │   ├── graph-mutations.ts
│   │   │   ├── graph-workflows.ts
│   │   │   ├── model-library.ts
│   │   │   └── static-ui.ts
│   │   └── types.ts                  # SessionRuntimeRef, ControlServer
│   ├── execution-controller.ts       # Session authority (defer deep split)
│   ├── graph-planner.ts              # Unchanged
│   ├── graph-executor.ts             # Unchanged
│   └── ...                             # Other application modules unchanged
├── domain/
│   ├── recursive-language-model.ts   # Orchestrator only (target: <800 LOC)
│   ├── recursion/                      # NEW — extracted concerns
│   │   ├── budget-guard.ts           # modelCalls, toolRoundLimit, remainingModelCalls
│   │   ├── tool-loop.ts              # Tool round execution in answer path
│   │   ├── quality-loop.ts           # runQualityLoop + parsers/evaluators
│   │   ├── execution-graph-sync.ts   # ensureExecutionNode, emitExecution, status sync
│   │   └── prompt-utils.ts           # limitPrompt, parseClarification, JSON extract
│   ├── types.ts
│   └── run-state-persistence.ts
├── ports/
└── adapters/

tests/
├── application/
│   ├── config/
│   ├── bootstrap/                    # NEW — unit tests for builders
│   └── control-server/
├── domain/
│   └── recursion/
├── cli/
└── integration/                      # Renamed from integration-v15.test.ts
    └── graph-authoring.test.ts
```

### Structure Rationale

- **`bootstrap/`:** Centralizes what `index.ts` does today between config load and mode dispatch. Enables unit tests with mocked adapters without spawning CLI.
- **`config/`:** Separates **read** (loader), **validate** (schema + references), and **resolve** (runtime overrides). ~20 import sites use `project-config`; barrel export avoids a flag-day rename.
- **`domain/recursion/`:** Keeps domain free of application imports. Quality loop and tool loop are domain policy, not orchestration.
- **`control-server/`:** HTTP is transport; session remains authoritative in `execution-controller.ts`. Handlers receive `InteractiveExecutionSession` + `SessionRuntimeRef` — no business logic migration into handlers beyond request/response mapping.
- **`cli/run-modes/`:** CLI-specific dispatch stays out of application layer; run modes receive a built `RuntimeContext`.

---

## Architectural Patterns

### Pattern 1: Composition Root Extraction

**What:** Move object graph construction from `index.ts` into `buildRuntimeContext(options): RuntimeContext`.  
**When to use:** Any time the entrypoint wires >5 collaborators (currently ~15).  
**Trade-offs:** (+) testable wiring, (+) single place for lifecycle; (−) one more indirection layer.

**Example:**
```typescript
// application/bootstrap/runtime-context.ts
export interface RuntimeContext {
  projectConfig: ProjectConfig;
  runtimeConfig: RecursiveModelConfig;
  loadedConfigPath?: string;
  memoryManager: MemoryManager;
  extensionHost: ExtensionHost;
  registry: AgentRegistry;
  createModel: ReturnType<typeof createModelFactory>;
  toolsFor: ReturnType<typeof createToolsResolver>;
  runState: RuntimeRunState;
  memory: MemoryResolver;
  logger?: RuntimeLogger;
  cleanup: ResourceCleanup;
  cancellation: CancellationController;
  execution: ExecutionControl;
  // UI-only fields optional
  sessionStore?: FileSessionStore;
}

// index.ts becomes:
const ctx = await buildRuntimeContext(options);
if (options.command === "ui") return runUiMode(ctx, options);
if (options.workflow) return runWorkflowMode(ctx, options);
return runAgentMode(ctx, options);
```

### Pattern 2: Barrel-Preserving Module Split

**What:** Split large files internally; re-export public API from original path or `config/index.ts`.  
**When to use:** High fan-in modules (`project-config` has ~20 importers).  
**Trade-offs:** (+) zero behavior change, (+) incremental migration; (−) temporary re-export indirection.

**Example:**
```typescript
// application/config/index.ts
export * from "./project-config-types.js";
export { loadProjectConfig, seedProjectRlmStarter } from "./config-loader.js";
export { resolveRuntimeConfig, applyModelOverride, resolveRuntimeHostSelection } from "./config-resolver.js";
// project-config.ts becomes thin re-export OR deleted after import updates
```

### Pattern 3: Domain Submodule Extraction (Class Retains Orchestration)

**What:** Extract private method clusters from `RecursiveLanguageModel` into pure functions or small classes in `domain/recursion/`; class delegates.  
**When to use:** Single class >1,500 LOC with identifiable concern boundaries.  
**Trade-offs:** (+) testable units for budget/tool/quality paths; (−) must pass explicit state (metadata, modelCalls) to avoid hidden coupling.

**Example:**
```typescript
// domain/recursion/budget-guard.ts
export class RecursionBudget {
  constructor(private maxModelCalls: number, private toolRoundLimit: number) {}
  canSpendModelCall(): boolean { /* ... */ }
  remainingModelCalls(): number { /* ... */ }
}

// recursive-language-model.ts delegates in run(), solve(), runQualityLoop()
```

### Pattern 4: Control-Server Handler Modules

**What:** `routeRequest` becomes a route table mapping `method+path` → handler function; handlers live in `handlers/`.  
**When to use:** Single routing function >500 LOC with distinct endpoint groups.  
**Trade-offs:** (+) endpoint discoverability; (−) shared helper duplication unless `control-server/http-utils.ts` extracted.

---

## Data Flow

### Request Flow (Unchanged Semantics)

Behavior-preserving refactor means **no change** to these flows; only **where** wiring happens moves.

```
CLI args / UI HTTP
    ↓
buildRuntimeContext (NEW — was inline in index.ts)
    ↓
Mode handler (cli/run-modes/* or control-server handler)
    ↓
Application runner (runConfiguredAgent | runWorkflow | GraphExecutor | planNode)
    ↓
runRecursivePrompt → RecursiveLanguageModel.run
    ↓
Ports (LanguageModel, Tool, Trace) → Adapters
    ↓
ExecutionControl callbacks → InteractiveExecutionSession (UI path)
    ↓
renderResult / JSON response / SSE events
```

### State Management Boundaries

| State | Owner | Consumers | v1.6 change |
|-------|-------|-----------|-------------|
| Execution graph (nodes, edges, layout) | `InteractiveExecutionSession` | control-server, GraphExecutor, GraphPlanner | None |
| Approval / clarification | `InteractiveExecutionSession` + `ExecutionControl` | RLM via callbacks, UI via API | None |
| Run manifest / memory scopes | `FileMemoryStore` + `MemoryResolver` | bootstrap creates; session restore via `SessionRuntimeRef` | Wiring moves to bootstrap |
| Model/tool instances | `RuntimeContext` (cached models, extension registry) | All runners | Explicit context object |
| Config (project + runtime) | `config/*` modules | All application layers | Import path only |

### Key Data Flows

1. **Headless agent run:** `index.ts` → `buildRuntimeContext` → `runConfiguredAgent` → `runRecursivePrompt` → RLM → stdout via `renderResult`. Today wired in `index.ts` lines 467–545; moves to `cli/run-modes/headless-agent.ts`.

2. **UI confirm run:** `POST /api/chat/confirm-run` → `onConfirmRun` → `createUiExecutionRunner.start` → `GraphExecutor` → per-node `runConfiguredAgent`. `SessionRuntimeRef` bridges runId/memory across save/restore. Control-server stays transport; no execution logic migration.

3. **Config cascade:** YAML fragments → `loadProjectConfig` → `applyModelOverride` → `resolveRuntimeConfig` → passed in `RuntimeContext`. Split files; same function signatures via barrel.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | v1.6 integration notes |
|----------|---------------|------------------------|
| `index.ts` ↔ `bootstrap/` | Direct function calls | **NEW.** index only parses args and delegates |
| `bootstrap/` ↔ `config/` | `loadProjectConfig`, resolvers | Config split must land before bootstrap extraction |
| `bootstrap/` ↔ `adapters/` | Concrete store/model constructors | Bootstrap owns adapter instantiation; domain never imports adapters |
| `cli/run-modes/` ↔ `application/` | `RuntimeContext` + mode-specific options | Run modes import application runners, not adapters directly |
| `control-server/handlers/` ↔ `execution-controller` | Session method calls | Handlers thin; no new session APIs required |
| `control-server` ↔ `ui-execution-runner` | `onConfirmRun` callback | Unchanged contract; runner built in bootstrap, passed to `startControlServer` |
| `agent-runner` ↔ `domain/recursion/*` | Via `RecursiveLanguageModel` only | Engine split is domain-internal; `run-recursive-prompt.ts` unchanged |
| `GraphExecutor` ↔ `agent-runner` | Existing `runConfiguredAgent` input | No change; benefits from stable `ProjectConfig` imports |
| `tests/` ↔ `config/` | Direct loader/resolver imports | Update paths when barrel stabilizes; add bootstrap unit tests |

### External Services (Unchanged)

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Ollama / HTTP model hosts | Adapters via `createModelFactory` | Factory stays in `runtime-composition` or bootstrap |
| MCP servers | `interop-runtime` + `ExtensionHost` | Bootstrap wires; cleanup tracked on `ResourceCleanup` |
| File stores (`.rlm/`, `.planning/runs`) | Adapters constructed in bootstrap | Session admin commands use same stores |

---

## New vs Modified Components

### New Components

| Component | Path | Responsibility |
|-----------|------|----------------|
| `RuntimeContext` | `application/bootstrap/runtime-context.ts` | Typed bag of wired runtime dependencies |
| `buildRuntimeContext` | `application/bootstrap/build-runtime-context.ts` | Full object graph from CLI options + config |
| Config modules | `application/config/*` | Split loader, schema, types, resolver, validation |
| Run mode handlers | `cli/run-modes/*` | Per-command execution paths extracted from index |
| RLM submodules | `domain/recursion/*` | Budget, tool loop, quality loop, graph sync, utils |
| Control-server handlers | `application/control-server/handlers/*` | HTTP endpoint implementations |
| Route dispatcher | `application/control-server/routes.ts` | Method/path → handler routing |
| Bootstrap tests | `tests/application/bootstrap/` | Unit tests for wiring without CLI |
| Config unit tests | `tests/application/config/` | Schema, merge, resolver isolated tests |

### Modified Components

| Component | Change | Risk |
|-----------|--------|------|
| `src/index.ts` | Reduce to dispatch + error handler | Low if bootstrap tested |
| `src/application/project-config.ts` | Becomes barrel or deleted after split | Low with re-export |
| `src/application/runtime-composition.ts` | May absorb or delegate to bootstrap | Low |
| `src/domain/recursive-language-model.ts` | Delegate to recursion modules | Medium — 205 tests must pass |
| `src/application/control-server.ts` | Thin wrapper around routes + handlers | Low-Medium |
| `tests/project-config-scopes.test.ts` | Move to `tests/application/config/` | Low |
| `tests/integration-v15.test.ts` | Rename/split to `tests/integration/` | Low |
| `package.json` scripts | Add eslint/prettier when tooling lands | Low |

### Explicitly Unchanged (Defer)

| Component | Reason |
|-----------|--------|
| `execution-controller.ts` | Session authority is complex but cohesive; splitting risks approval/plan regressions |
| `graph-planner.ts`, `graph-executor.ts` | Already modular from v1.5 |
| `ports/*`, adapter implementations | No boundary violations to fix |
| `ui/src/*` | v1.6 clarifies server boundaries only; no UI feature work |
| Domain `types.ts` | No schema changes required for cleanup |

---

## Suggested Build Order

Order minimizes import churn and keeps tests green after each wave. Each wave ends with `npm test` (205 tests).

### Wave 0 — Dev Tooling Guardrails (Independent)

1. Add ESLint + Prettier (or Biome) with TypeScript-aware config.
2. Wire `npm run lint` beyond typecheck; optional pre-commit hook.
3. **Dependency:** none. **Enables:** consistent formatting for large moves.

### Wave 1 — Config Split (Foundation)

1. Create `application/config/project-config-types.ts` — move interfaces, constants, type guards.
2. Create `config-schema.ts` — move Zod schemas (~163–329 today).
3. Create `config-loader.ts` — `loadProjectConfig`, scoped fragments, `seedProjectRlmStarter`.
4. Create `config-resolver.ts` — `resolveRuntimeConfig`, `applyModelOverride`, host/tier resolution.
5. Create `config-validation.ts` — `validateConfigReferences`, merge helpers.
6. Add `config/index.ts` barrel; make `project-config.ts` re-export everything.
7. Add focused unit tests per submodule.
8. **Dependency:** none for runtime. **Blocks:** bootstrap extraction (Wave 2).

### Wave 2 — Runtime Bootstrap + Slim Entrypoint

1. Define `RuntimeContext` type covering stores, registry, factories, execution control.
2. Implement `buildRuntimeContext(options, loadedConfig)` — extract lines ~186–348 from `index.ts`.
3. Extract interop/extension wiring to `build-interop-runtime.ts` if bootstrap exceeds ~250 LOC.
4. Create `cli/run-modes/session-admin.ts` for early-exit commands (session-list, workflow import/export, preferences).
5. Create `headless-agent.ts`, `headless-workflow.ts`, `plan-node.ts`, `ui-mode.ts`.
6. Reduce `index.ts` to launch wizard → parse → build context → dispatch.
7. Add bootstrap unit tests with mocked adapters.
8. **Depends on:** Wave 1 stable config imports. **Blocks:** meaningful control-server handler injection tests.

### Wave 3 — Domain Engine Decomposition

1. Extract `budget-guard.ts` — model call and tool round accounting (~1307–1320 region).
2. Extract `execution-graph-sync.ts` — node registration, status, `emitExecution` (~1475–1805).
3. Extract `tool-loop.ts` — tool call iteration inside answer path (~1058–1155 region).
4. Extract `quality-loop.ts` — `runQualityLoop` + parsers/evaluators (~250–716, ~1916–2273 helpers).
5. Extract `prompt-utils.ts` — shared parsers, `limitPrompt`, `createId`.
6. Slim `RecursiveLanguageModel` to orchestration (`run`, `solve`, `classify`, `decompose`).
7. Extend `tests/recursive-language-model.test.ts` or add `tests/domain/recursion/` for extracted units.
8. **Depends on:** none strictly; parallel with Wave 2 if different authors. **Risk:** highest — run full suite after each extraction.

### Wave 4 — Control-Server Boundary Clarification

1. Move `SessionRuntimeRef`, `ControlServer` types to `control-server/types.ts`.
2. Extract HTTP utilities (`sendJson`, `readJsonBody`, `serveUiAsset`) to `control-server/http-utils.ts`.
3. Split handlers by route group (session, graph, workflows, model-library, static).
4. Replace monolithic `routeRequest` with `routes.ts` dispatcher.
5. Document boundary in code: handlers call `session.*` only; no direct `GraphExecutor` from handlers (confirm-run stays callback).
6. **Depends on:** Wave 2 `ui-mode.ts` passing same `startControlServer` inputs. **Parallel-safe** with Wave 3.

### Wave 5 — Test Restructure

1. Mirror `tests/application/config/`, `tests/domain/recursion/`, `tests/integration/`.
2. Split `integration-v15.test.ts` by concern (plan→run, export→import, workflow graph).
3. Add bootstrap wiring smoke test (build context with temp config, no network).
4. **Depends on:** Waves 1–4 stable module paths. **Last** to avoid moving tests twice.

### Build Order Diagram

```
Wave 0 (tooling) ─────────────────────────────────────────────┐
                                                               │
Wave 1 (config split) ──→ Wave 2 (bootstrap + index slim) ──→ Wave 4 (control-server)
                               │                               │
                               └──────────→ Wave 3 (RLM split) ─┘
                                                    │
                                         Wave 5 (test restructure)
```

**Critical path:** Config split → Bootstrap → Entrypoint slim. RLM split and control-server split can proceed in parallel after Wave 1.

---

## Scaling Considerations

This milestone targets **maintainer scale**, not user scale.

| Scale | Architecture adjustments |
|-------|--------------------------|
| Single developer | Monolith layers fine; file size is the pain point |
| 2–5 contributors | Module boundaries + bootstrap tests reduce merge conflicts in `index.ts` / RLM |
| Future plugin authors | Clear `bootstrap/` + `config/` docs lower onboarding; extension host wiring already isolated |

### Scaling Priorities

1. **First bottleneck:** 600+ LOC `index.ts` — every new CLI command touches composition root. Fix: bootstrap + run-modes.
2. **Second bottleneck:** 2,300 LOC RLM — quality loop changes risk tool loop regressions. Fix: domain/recursion modules with focused tests.

---

## Anti-Patterns

### Anti-Pattern 1: Inverting Layer Dependencies

**What people do:** Move graph session logic into control-server handlers or config loader into domain.  
**Why it's wrong:** Violates ports/adapters direction; UI transport starts owning policy.  
**Do this instead:** Handlers delegate to `InteractiveExecutionSession`; config stays in application.

### Anti-Pattern 2: Big-Bang Rename Without Barrel

**What people do:** Delete `project-config.ts` and update 20 imports in one commit.  
**Why it's wrong:** Large diff, hard review, easy miss.  
**Do this instead:** Barrel re-export; migrate imports incrementally; delete shim last.

### Anti-Pattern 3: Behavior Changes Disguised as Refactor

**What people do:** "While we're here" fix routing, change defaults, alter error messages.  
**Why it's wrong:** v1.6 success criteria require all 205 tests passing unchanged semantics.  
**Do this instead:** Separate natural fixes; document in commit; no silent changes.

### Anti-Pattern 4: Splitting `execution-controller.ts` Early

**What people do:** Break session class before stabilizing bootstrap/control-server.  
**Why it's wrong:** Highest regression risk for approvals, replan, protected state.  
**Do this instead:** Defer session split; clarify control-server boundary first.

### Anti-Pattern 5: Application Layer Importing Domain Internals

**What people do:** Import `quality-loop.ts` from `graph-executor`.  
**Why it's wrong:** Couples orchestration to engine internals.  
**Do this instead:** Keep `run-recursive-prompt.ts` as the sole application entry to RLM.

---

## Research Flags for Roadmap Phases

| Phase topic | Deeper research? | Reason |
|-------------|------------------|--------|
| Config scoped YAML merge | Unlikely | Existing behavior documented in loader; split only |
| Bootstrap lifecycle / shutdown | Maybe | Verify cleanup order matches today when extracted |
| RLM quality-loop extraction | Yes | State threading between class and module needs plan-phase spike |
| execution-controller split | Later | Out of v1.6 scope unless file blocks UI boundary work |
| ESLint rule set | Maybe | Choose minimal rules aligned with existing style |

---

## Sources

- `.planning/PROJECT.md` — v1.6 milestone goals and success criteria
- `.planning/codebase/ARCHITECTURE.md` — layered architecture snapshot
- `docs/ARCHITECTURE.md` — current runtime flow documentation
- `src/index.ts` — composition root (~607 LOC)
- `src/application/project-config.ts` — config monolith (~959 LOC)
- `src/application/runtime-composition.ts` — partial extraction (~69 LOC)
- `src/domain/recursive-language-model.ts` — engine monolith (~2,322 LOC)
- `src/application/control-server.ts` — HTTP transport (~720 LOC)
- `src/application/execution-controller.ts` — session authority (~1,888 LOC)
- `src/application/run-recursive-prompt.ts` — stable application→domain seam
- `src/application/ui-execution-runner.ts`, `graph-executor.ts` — v1.5 execution path
- `tests/` — 15 test files, 205 passing (per PROJECT.md)

---
*Architecture research for: v1.6 Architecture Cleanup*  
*Researched: 2026-05-22*
