# Roadmap: Recursive Language Model CLI

## Milestones

- 🚧 **v1.6 Architecture Cleanup** — Phases 36-42 (planning)
- ✅ **v1.5 Dynamic Graph Authoring** — Phases 30-35 (shipped 2026-05-22; archive: `.planning/milestones/v1.5-ROADMAP.md`)
- ✅ **v1.4 Session Memory** — Phases 25-29, 29.1 (shipped 2026-05-21; archive: `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.3 Desktop Product** — Phases 21-24 (shipped 2026-05-21; archive: `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.2 Answer Quality Loops** — Phases 12-17 (shipped 2026-05-20; archive: `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.1 Interop, chat-first, plugins, constrained tools** — Phases 6-11, including inserted Phase 8.5 (shipped 2026-05-13; archive: `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-08; archive: `.planning/milestones/v1.0-ROADMAP.md`)

## Overview

v1.6 is a behavior-preserving architecture cleanup: land dev-tooling guardrails, split config and runtime composition hotspots, reorganize adapters by concern, decompose the recursive engine, clarify control-server transport boundaries, and restructure tests with updated contributor docs — all while keeping CLI/UI/session/graph flows unchanged and the full test suite green after every extraction slice.

## Phases

**Phase Numbering:**
- Phase numbers continue from v1.5 (last phase: 35).
- v1.6 uses phases 36-42.

### 🚧 v1.6 Architecture Cleanup (Planning)

**Milestone Goal:** Reduce structural debt across CLI composition, config loading, core engine, tests, tooling, and UI boundaries while preserving existing behavior.

- [x] **Phase 36: Dev Tooling Guardrails** — ESLint, Prettier, dependency-cruiser baselines and expanded `npm run check`.
- [x] **Phase 37: Config Layer Split** — Focused `application/config/` modules with barrel facade and unit tests (2026-05-22).
- [x] **Phase 38: Runtime Bootstrap** — `RuntimeContext`, `buildRuntimeContext()`, slim `index.ts`, and `cli/run-modes/*` (2026-05-22).
- [x] **Phase 39: Adapters & Tools Taxonomy** — Group tools, persistence, and model adapters by concern with aligned extension shims.
- [x] **Phase 40: Domain Engine Decomposition** — `domain/recursion/` concern modules with orchestrator retaining flow (`40-SUMMARY.md`, `40-VERIFICATION.md`).
- [x] **Phase 41: Control-Server Boundary** — Handler modules with bootstrap-injected dependencies and transport-only routes (2026-05-22).
- [x] **Phase 42: Test Restructure & Docs** — Subsystem-aligned tests, shared helpers, and updated AGENTS.md contributor map (2026-05-22).

<details>
<summary>✅ v1.5 Dynamic Graph Authoring (Phases 30-35) — SHIPPED 2026-05-22</summary>

See `.planning/milestones/v1.5-ROADMAP.md`, `.planning/milestones/v1.5-REQUIREMENTS.md`, and `.planning/milestones/v1.5-MILESTONE-AUDIT.md`.

- [x] **Phase 30: Plan-from-Node Foundation** — Model-driven child planning from any node with root-composer default and explicit failure states (5/5 plans).
- [x] **Phase 31: Protected Replan UX** — Replace/Merge/Cancel gate when protected descendants exist on parent replan (3/3 plans).
- [x] **Phase 32: Expert Team Binding** — Planner-assigned expert presets, inspector overrides, and execution-time allowlist enforcement (3/3 plans).
- [x] **Phase 33: Graph Execution Loop** — Shared graph executor walks approved topology with per-node expert binding and visible runtime modes (3/3 plans).
- [x] **Phase 34: Graph Workflow Export/Import** — Lossless `kind: graph` sidecars with playbook/pipeline variants and frozen replay (3/3 plans).
- [x] **Phase 35: Integration Hardening** — UI/CLI parity, graph-primary UX default, and session save/reopen for new fields (1/1 plan).

</details>

<details>
<summary>✅ v1.4 Session Memory (Phases 25-29, 29.1) — SHIPPED 2026-05-21</summary>

See `.planning/milestones/v1.4-ROADMAP.md`, `.planning/milestones/v1.4-REQUIREMENTS.md`, and `.planning/milestones/v1.4-MILESTONE-AUDIT.md`.

</details>

<details>
<summary>✅ v1.3 Desktop Product (Phases 21-24) — SHIPPED 2026-05-21</summary>

See `.planning/milestones/v1.3-ROADMAP.md` and `.planning/milestones/v1.3-REQUIREMENTS.md`.

</details>

## Phase Details

### Phase 36: Dev Tooling Guardrails
**Goal**: Maintainers have automated lint, format, and layer-boundary guardrails before large extraction diffs land.
**Depends on**: Nothing (first phase of v1.6)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, REG-01, REG-02
**Success Criteria** (what must be TRUE):
  1. `npm run lint` passes on `src/` and `ui/src/` with ESLint 10 flat config and a minimal typescript-eslint baseline aligned to existing style.
  2. Prettier 3 formats TypeScript sources; eslint-config-prettier prevents rule conflicts; format-only changes are isolated from logic refactors.
  3. dependency-cruiser enforces AGENTS.md layer rules at warn severity with a triaged baseline for known violations.
  4. `npm run check` runs typecheck, lint, Prettier `--check`, dependency-cruiser (with baseline), and test once baselines are green.
  5. All existing tests pass with no intentional behavior changes to CLI flags, config semantics, control-server API, or graph/session/memory flows.
**Plans**: 36-01 (`36-01-PLAN.md`), 36-02 (`36-02-PLAN.md`) — shipped 2026-05-22

### Phase 37: Config Layer Split
**Goal**: Config loading, validation, and resolution live in focused, unit-testable modules with a stable public facade.
**Depends on**: Phase 36
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06, REG-01, REG-02
**Success Criteria** (what must be TRUE):
  1. Config logic lives under `application/config/` (types/schema, defaults, loader, validation, runtime resolution, model override, starter seed).
  2. Existing import sites continue working via barrel re-export facade without a flag-day rename.
  3. Validation errors retain file/path context and existing error shapes after the split.
  4. Runtime host selection, tier resolution, model override, and starter seeding behavior match pre-split semantics.
  5. Config resolution modules have focused unit tests runnable without full CLI invocation; full suite and `npm run check` stay green.
**Plans**: 3 plans in 3 waves (`37-01-PLAN.md`, `37-02-PLAN.md`, `37-03-PLAN.md`)

Plans:
- [x] `37-01-PLAN.md` — Extract types, Zod schema, defaults, YAML merge into `application/config/`
- [x] `37-02-PLAN.md` — Extract loader + validation; preserve path-prefixed parse errors
- [x] `37-03-PLAN.md` — Extract runtime/host/model resolution + starter seed; barrel façade + unit tests

### Phase 38: Runtime Bootstrap
**Goal**: CLI entrypoint is thin; runtime construction is centralized, ordered, and unit-testable.
**Depends on**: Phase 37
**Requirements**: BOOT-01, BOOT-02, BOOT-03, BOOT-04, BOOT-05, BOOT-06, REG-01, REG-02
**Success Criteria** (what must be TRUE):
  1. `buildRuntimeContext()` in `application/bootstrap/` returns a typed `RuntimeContext` as the single composition entry point.
  2. `src/index.ts` reads primarily as argument parsing, early exits, runtime build, and dispatch (target <150 LOC).
  3. CLI run modes live in `cli/run-modes/*` and receive a built `RuntimeContext` instead of constructing stores/adapters inline.
  4. Init order is preserved in one pipeline: extensions → MCP cleanup tracking → tool resolver → agent registry → model factory → execution control → shutdown wiring.
  5. Extension/tool registration stays unified through one path; bootstrap builders have unit tests; full suite and `npm run check` stay green.
**Plans**: `38-01-PLAN.md`, `38-02-PLAN.md` — shipped 2026-05-22

Plans:
- [x] `38-01-PLAN.md` — Typed `RuntimeContext` + `buildRuntimeContext()` with bootstrap unit coverage
- [x] `38-02-PLAN.md` — `cli/run-modes/*` dispatch + slim CLI entry (`src/index.ts`)

### Phase 39: Adapters & Tools Taxonomy
**Goal**: Adapters are grouped by concern with extension shims aligned and ports remaining the public contract.
**Depends on**: Phase 38
**Requirements**: ADPT-01, ADPT-02, ADPT-03, ADPT-04, ADPT-05, ADPT-06, REG-01, REG-02
**Success Criteria** (what must be TRUE):
  1. Tool adapters group under `adapters/tools/`; persistence stores under `adapters/persistence/`; model hosts under `adapters/models/`.
  2. Shared adapter utilities colocate with their owning concern module rather than orphaned flat files.
  3. Extension registration shims in `src/extensions/tools/` align with adapter locations with no duplicate tool implementations.
  4. Ports remain the public contract; import updates route through composition/bootstrap without growing scattered application→adapter coupling.
  5. CLI, UI, session, graph, and memory flows behave identically; full suite and `npm run check` stay green.
**Plans**: `39-01-PLAN.md` — shipped 2026-05-22

Plans:
- [x] `39-01-PLAN.md` — taxonomy move, `adapters/index.ts` barrel, bootstrap adapter re-exports, extension shim paths

### Phase 40: Domain Engine Decomposition
**Goal**: The recursive engine splits into locatable concern modules while the orchestrator retains top-level recursion flow.
**Depends on**: Phase 37
**Requirements**: RLM-01, RLM-02, RLM-03, RLM-04, RLM-05, REG-01, REG-02
**Success Criteria** (what must be TRUE):
  1. `recursive-language-model.ts` decomposes into `domain/recursion/` modules (budget guard, tool-round loop, quality loop, execution-graph sync, prompt utilities).
  2. The orchestrator class retains top-level recursion flow; extracted modules are pure or narrowly scoped helpers integrated without semantics drift.
  3. Domain modules do not import application-layer types; dependency direction stays domain → ports only.
  4. Plan-phase spike resolves state threading between class fields and extracted modules before quality-loop extraction executes.
  5. Each extraction slice passes RLM, graph-executor, and integration test suites; full suite and `npm run check` stay green.
**Plans**: `40-01-PLAN.md` … `40-05-PLAN.md`

**Research flag:** Implemented — quality-loop peeled via stitched module + archived peel sources (`40-VERIFICATION.md`).

Plans:
- [x] `40-RESEARCH.md` + spike (RLM-05)
- [x] `40-01-PLAN.md` — prompt utilities → `domain/recursion/prompt-utilities.ts`
- [x] `40-02-PLAN.md` — budget guard → `domain/recursion/budget-guard.ts`
- [x] `40-03-PLAN.md` — execution graph sync → `domain/recursion/execution-graph-sync.ts`
- [x] `40-04-PLAN.md` — tool-round loop → `domain/recursion/tool-round-loop.ts`
- [x] `40-05-PLAN.md` — quality loop → `domain/recursion/quality-loop.ts` (stitched)

### Phase 41: Control-Server Boundary
**Goal**: HTTP transport is grouped by surface with session/graph authority staying in application services.
**Depends on**: Phase 38
**Requirements**: CTRL-01, CTRL-02, CTRL-03, CTRL-04, REG-01, REG-02
**Success Criteria** (what must be TRUE):
  1. HTTP route handlers group into `application/control-server/handlers/` by surface (session, graph, workflows, model-library, static UI).
  2. Control server remains transport-only; session and graph authority stay in `InteractiveExecutionSession` and execution-controller services.
  3. `startControlServer` receives composed runtime dependencies from bootstrap, not constructed inside route handlers.
  4. Endpoint paths, request/response JSON shapes, and error vocabulary are unchanged from pre-refactor behavior.
  5. Full suite and `npm run check` stay green with no API or UI contract drift.
**Plans**: `41-01-PLAN.md` — shipped 2026-05-22

Plans:
- [x] `41-01-PLAN.md` — surface handlers package, dispatcher, bootstrap `buildStartControlServerInput`

### Phase 42: Test Restructure & Docs
**Goal**: Tests mirror subsystem boundaries and contributors can locate change points from updated documentation.
**Depends on**: Phases 36-41
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, DOC-01, DOC-02, REG-01, REG-02
**Success Criteria** (what must be TRUE):
  1. Shared test helpers live in `tests/helpers/` before large test file splits.
  2. `recursive-language-model.test.ts` splits into subsystem-aligned files under `tests/domain/recursion/` mirroring new module boundaries.
  3. Config and bootstrap modules have focused unit tests at extraction boundaries.
  4. Integration anchor tests remain intact and green; test count parity is verified before and after splits; blocks move verbatim unless structurally justified.
  5. `AGENTS.md` reflects new module homes and documents where to add tools, adapters, config fields, and runtime wiring; full suite and `npm run check` stay green.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 36 → 37 → 38 → 39 → 40 → 41 → 42

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 36. Dev Tooling Guardrails | v1.6 | 2/2 | Complete | 2026-05-22 |
| 37. Config Layer Split | v1.6 | 3/3 | Complete | 2026-05-22 |
| 38. Runtime Bootstrap | v1.6 | 2/2 | Complete | 2026-05-22 |
| 39. Adapters & Tools Taxonomy | v1.6 | 1/1 | Complete | 2026-05-22 |
| 40. Domain Engine Decomposition | v1.6 | 5/5 | Complete | 2026-05-22 |
| 41. Control-Server Boundary | v1.6 | 1/1 | Complete | 2026-05-22 |
| 42. Test Restructure & Docs | v1.6 | 1/1 | Complete   | 2026-05-22 |
| 30-35 Dynamic Graph Authoring | v1.5 | 18/18 | Complete | 2026-05-22 |
| 25-29, 29.1 Session Memory | v1.4 | 6/6 | Complete | 2026-05-21 |
| 21-24 Desktop Product | v1.3 | archived | Complete | 2026-05-21 |
| 12-17 Answer Quality Loops | v1.2 | archived | Complete | 2026-05-20 |
| 6-11 Interop / plugins | v1.1 | archived | Complete | 2026-05-13 |
| 1-5 MVP | v1.0 | archived | Complete | 2026-05-08 |
