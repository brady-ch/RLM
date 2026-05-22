# Feature Research: v1.6 Architecture Cleanup

**Domain:** Behavior-preserving structural refactor — TypeScript CLI + control-server UI monorepo  
**Milestone:** v1.6 — Architecture Cleanup  
**Researched:** 2026-05-22  
**Confidence:** HIGH for repo-specific scope (PROJECT.md, CONCERNS.md, live file metrics); MEDIUM for ecosystem patterns (verified against Nx boundary guidance, incremental extraction practice)

## How Architecture Cleanup Typically Works (TypeScript CLI + UI Monorepo)

Architecture cleanup milestones are **not feature milestones**. They deliver **observable structural outcomes** while keeping runtime behavior, CLI flags, config semantics, and UI/control-server contracts unchanged.

### Typical workflow

1. **Inventory hotspots** — Find files that mix composition, policy, and I/O. In RLM today: `src/index.ts` (~607 lines), `src/application/project-config.ts` (~959), `src/domain/recursive-language-model.ts` (~2,322), `tests/recursive-language-model.test.ts` (~4,451), `src/application/control-server.ts` (~720).
2. **Extract by change reason** — Move code into modules named for *why* they change (config validation vs runtime wiring vs recursion budgeting), not for abstract layer labels alone.
3. **Preserve public seams first** — Keep stable exports (`loadProjectConfig`, `resolveRuntimeConfig`, `runRecursivePrompt`, control-server routes) while splitting internals. Callers update imports only when necessary.
4. **Strangler, not big-bang** — One extraction per PR/phase with full test suite green. Avoid simultaneous directory moves + renames + behavior edits.
5. **Test the new seams** — Add focused unit tests for extracted builders/resolvers so future changes do not require spawning the full CLI or UI server.
6. **Guard with automation** — Typecheck (already present), then lint/format and optional import-boundary rules so debt does not re-concentrate.

### RLM-specific shape (CLI + embedded UI)

This repo is a **single-package monorepo**, not a multi-package Nx workspace:

| Surface | Role today | Cleanup target |
|---------|------------|----------------|
| `src/index.ts` | CLI entry + runtime composition + dispatch | Thin entry: parse args → build runtime → dispatch |
| `src/application/` | Orchestration, config, control server, graph runners | Focused modules; no new “god” files |
| `src/domain/` | Recursion policy (`recursive-language-model.ts`) | Concern modules: budgeting, tool loops, graph events |
| `src/cli/` | Args, render, shutdown | Stays I/O-only; no store/model wiring |
| `ui/` | Vite/React bundle served by control server | No business logic creep; API contract unchanged |
| `src/application/control-server.ts` | HTTP routing + session/graph/memory APIs | Route handlers grouped; runtime deps injected from composition layer |

Partial progress already exists: `src/application/runtime-composition.ts` exposes `createToolsResolver`, `createModelFactory`, and `readablePath`, but most store/extension/event wiring still lives in `index.ts`.

---

## Feature Landscape

### Table Stakes (Expected Outcomes — Missing = Refactor Incomplete)

These are non-negotiable for v1.6. Stakeholders do not celebrate them, but the milestone fails without them.

| Outcome | Why expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Zero behavior regression** | Refactor milestone contract in PROJECT.md | LOW (verification) | All ~205 tests pass; CLI/UI/session/memory/graph flows unchanged |
| **Thin CLI entrypoint** | `index.ts` is the #2 concern in CONCERNS.md | MEDIUM | Reads as: parse args → early exits → build runtime → dispatch; not store/extension/MCP wiring |
| **Extracted runtime composition** | Todo + partial `runtime-composition.ts` | HIGH | Stores, extension host, interop tools, model factory, execution control, shutdown/cleanup, memory manifest — testable without `main()` |
| **Split config loader / validation / resolution** | `project-config.ts` mixes 6+ responsibilities (~959 lines) | HIGH | Focused modules with compatible public exports; validation errors keep file/path context |
| **Obvious module responsibilities** | Success criterion: contributors locate change points quickly | MEDIUM | Each target file has one primary reason to change; no new 1k+ line files |
| **Preserved layer boundaries** | Existing ports/adapters/application/domain layout | LOW | Adapters stay behind ports; domain does not import application |
| **No duplicated registration logic** | Extension/plugin growth risk in entrypoint todo | MEDIUM | Built-ins, external extensions, MCP/skill tools registered in one composition path |
| **Subsystem-aligned test files** | `recursive-language-model.test.ts` is 4,451 lines | MEDIUM | Split by concern with shared helpers; keep integration coverage (`integration-v15.test.ts`, graph/memory suites) |
| **Typecheck remains CI gate** | `npm run check` = typecheck + test | LOW | Already enforced; must stay green throughout |
| **Documented UI/control-server boundary** | Control server mixes HTTP + domain orchestration | MEDIUM | Composition builds `SessionRuntimeRef`; routes delegate to application services — no new coupling to `index.ts` |
| **AGENTS.md / contributor map updated** | Architecture docs still describe pre-extraction layout | LOW | Reflect new module homes so onboarding matches reality |

---

### Differentiators (High-Value Cleanup — Not Required to “Move Files,” but Define Success)

These separate a useful cleanup from cosmetic churn and align with RLM’s long-term velocity (plugins, graph, memory, desktop).

| Outcome | Value proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Unit-testable runtime builders** | Plugin/tool changes testable without subprocess CLI | MEDIUM | e.g. `buildRuntimeContext({ config, options })` with injectable ports for tests |
| **Unit-testable config resolution** | Safer plugin/model-host YAML evolution | MEDIUM | Tests for tier resolution, host selection, overrides without filesystem I/O where possible |
| **RLM engine concern modules** | Lowers regression risk on graph/recursion changes | HIGH | Extract budgeting, tool-round loop, graph-event mirroring from `recursive-language-model.ts` |
| **Shared test fixtures/helpers** | Split tests stay DRY; failures map to subsystems | MEDIUM | `tests/helpers/` or per-domain setup for graph, config, RLM mocks |
| **Lint + format scripts beyond typecheck** | CONCERNS.md #4; `lint` currently aliases `typecheck` only | LOW–MED | ESLint (or equivalent) + Prettier/format script; baseline pass before tightening rules |
| **Import-boundary enforcement (lightweight)** | Prevents re-creation of god modules | MED | Tagless option: eslint rule or simple script banning `domain/` → `application/` imports |
| **Stable extension composition contract** | v1.1+ investment in ExtensionHost | MED | Composition module documents built-in vs configured vs interop tool order |
| **Control-server route factoring** | 720-line HTTP surface | MED | Group handlers (session, graph, memory, model library, static UI) without API behavior change |
| **Incremental extraction metrics** | Proves milestone progress | LOW | Track line counts / import fan-in on former hotspots in phase verification |

---

### Anti-Features (Commonly Requested, Problematic in Cleanup Milestones)

| Anti-feature | Why requested | Why problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Big-bang directory restructure** | “Clean folder tree” | Mass import churn, review fatigue, hidden regressions | Extract modules in place; rename paths only when seams are tested |
| **Nx/Turborepo/pnpm workspaces adoption** | Industry monorepo best practice | Massive scope; unrelated to current single-package pain | Stay single-package; optional boundary lint without workspace tooling |
| **New user-facing capabilities** | “While we’re in there” | Violates behavior-preserving milestone; breaks verification | v1.6 success criteria explicitly forbid; defer to v1.7+ product themes |
| **Public config API break without shim** | Shorter internal names | Breaks downstream scripts, desktop packaging, docs | Re-export from `project-config.ts` (facade) until callers migrate |
| **`shared/utils` junk drawer** | Quick home for extracted helpers | Becomes new bottleneck (common monorepo failure mode) | Place helpers next to owning concern or in existing layer |
| **Rewrite tests to match new modules** | Fresh test design | Loses regression signal; scope explosion | Move/split existing tests; add narrow unit tests for new seams only |
| **Simultaneous RLM algorithm changes** | Fix bugs noticed during split | Cannot attribute failures | Small natural fixes only; log other bugs as todos |
| **UI framework migration** | Modernize React stack | Unrelated to architecture debt | Keep Vite/React; clarify server/UI boundary only |
| **Circular dependency “fixes” via `any` or lazy requires** | Unblocks extraction quickly | Hides architecture violations | Fix dependency direction or introduce port interface |
| **100% line coverage mandate** | Quality gate enthusiasm | Delays shipping structural wins | Preserve integration coverage; add targeted unit tests at extraction boundaries |
| **Codemod-driven mass moves without test gate** | Stripe-style automation envy | Single-package repo lacks that investment | Manual incremental extraction with `tsc` + full test after each slice |

---

## Feature Dependencies

```
lint/format baseline (optional early)
    └── import-boundary rules (tighten after baseline)

config split (loader / validation / resolution / defaults)
    └── runtime composition extraction
            │   (builders call resolveRuntimeConfig, loadProjectConfig)
            └── control-server composition clarity
                    (SessionRuntimeRef built by runtime builder, not index inline)

RLM concern extraction (budget / tool loop / graph events)
    └── test file split for RLM
            (mirror module boundaries; shared helpers)

integration tests (integration-v15, graph-workflow, session-memory)
    └── must stay green throughout — no dependency on refactor order,
        but block merge if any phase breaks them
```

### Dependency notes

- **Config split → runtime composition:** Runtime builders depend on resolved config types and functions. Split config first (or maintain a stable facade) so composition modules import narrow modules instead of a 959-line file.
- **Runtime composition → control-server boundary:** `startControlServer` should receive a composed `SessionRuntimeRef` and services from the runtime builder, not construct stores/adapters inside route handlers.
- **RLM decomposition ↔ test split:** Can proceed in parallel if each extraction keeps tests green, but test file splits are easiest **after** module names stabilize (avoid chasing renames twice).
- **Lint/format guardrails:** Can land early (recommended) to freeze style before large diffs, or late to avoid fighting unrelated formatting in the same PRs as extractions.
- **UI (`ui/`) package:** Minimal dependency on backend refactors if control-server API unchanged; cleanup is primarily server-side composition.

---

## MVP Definition

### Launch With (v1.6 core)

Minimum viable cleanup — validates the milestone without scope creep.

- [ ] **Runtime composition extraction** — `index.ts` primarily CLI dispatch; builders cover stores, extensions, tools, models, execution/shutdown wiring
- [ ] **Config module split** — loader, validation, resolution, defaults separated; public exports preserved
- [ ] **Full test suite green** — no intentional behavior changes; integration paths preserved
- [ ] **Contributor-visible module map** — AGENTS.md (or equivalent) matches new layout

### Add After Core (still v1.6 if capacity)

- [ ] **RLM concern decomposition** — at least one extracted concern (budgeting or tool loops) with tests
- [ ] **Test restructure** — `recursive-language-model.test.ts` split into subsystem files + helpers
- [ ] **Lint/format scripts** — beyond `typecheck`; CI `npm run check` extended or documented
- [ ] **Control-server handler grouping** — clearer internal structure, same HTTP API

### Future Consideration (post–v1.6)

- [ ] **Full ESLint `@nx/enforce-module-boundaries`-style tags** — if repo splits into packages or workstreams multiply
- [ ] **Automated dependency graph reports** — if hotspot files regress above threshold
- [ ] **AST codemod pipeline (resect/structural-refactor)** — only if repeated cross-module moves become routine

---

## Feature Prioritization Matrix

| Outcome | Maintainer value | Implementation cost | Priority |
|---------|------------------|---------------------|----------|
| Zero behavior regression / tests green | HIGH | LOW (ongoing gate) | P1 |
| Runtime composition extraction | HIGH | HIGH | P1 |
| Config loader/validation/resolution split | HIGH | HIGH | P1 |
| Thin `index.ts` readable as CLI flow | HIGH | MED (follows composition) | P1 |
| Unit tests for runtime/config builders | HIGH | MED | P2 |
| RLM concern modules | HIGH | HIGH | P2 |
| Test file subsystem split | MED | MED | P2 |
| Lint/format guardrails | MED | LOW–MED | P2 |
| Control-server internal factoring | MED | MED | P3 |
| Import-boundary enforcement | MED | MED | P3 |
| Line-count / fan-in metrics in verification | LOW | LOW | P3 |

**Priority key:** P1 = must ship in v1.6; P2 = should ship if core extractions complete; P3 = valuable polish without blocking milestone closure.

---

## Observable Success vs Cosmetic Refactor

| Signal | Cosmetic (insufficient) | Real cleanup (v1.6) |
|--------|-------------------------|---------------------|
| File count | Many tiny files, same import tangle | Clear ownership; reduced fan-in on former hotspots |
| Entrypoint | `index.ts` re-export shuffle | New code for plugins/tools goes to composition module, not `index.ts` |
| Config | Copy-paste into 6 files | Validation errors unchanged; resolver tests without full CLI |
| Tests | All in one file still | Failures point to subsystem file; integration suite retained |
| UI | None | Same routes/responses; runtime built outside route handlers |
| Reviewer question | “Where do I add an extension?” still unclear | Answer: composition module + existing ExtensionHost path |

---

## Competitor / Ecosystem Comparison (Refactor Patterns)

| Pattern | Typical approach | RLM v1.6 approach |
|---------|------------------|-------------------|
| Monorepo boundary enforcement | Nx tags + `@nx/enforce-module-boundaries` | Single package; existing layers + optional ESLint import rules |
| Module extraction | AST tools (resect, ts-morph) at scale | Incremental manual extraction + full test gate (appropriate for ~66 TS source files) |
| CLI composition | `commander`/`yargs` + DI container | Keep custom `cli/args.ts`; introduce application runtime builders |
| UI + backend split | Separate packages with shared types | Keep embedded UI; clarify control-server vs `ui/` bundle boundary |
| Test layout | Co-located `*.test.ts` or `tests/` mirror | Keep `tests/`; mirror subsystems after module split |

---

## Sources

| Source | Confidence | Used for |
|--------|------------|----------|
| `.planning/PROJECT.md` (v1.6 milestone) | HIGH | Scope, success criteria, target files |
| `.planning/codebase/CONCERNS.md` | HIGH | Hotspot priorities |
| `.planning/todos/pending/2026-05-22-*.md` | HIGH | Extraction acceptance checks |
| `src/index.ts`, `runtime-composition.ts`, `project-config.ts` | HIGH | Current partial extraction state, line scale |
| `package.json` scripts (`lint` = typecheck only) | HIGH | Tooling gap |
| [Nx enforce module boundaries](https://nx.dev/docs/features/enforce-module-boundaries) | MEDIUM | Boundary enforcement pattern (adapted lightweight) |
| [Marmicode boundaries cookbook](https://cookbook.marmicode.io/nx/boundaries) | MEDIUM | Layer/tag dependency constraints |
| Incremental extraction / test-gated refactor practice | MEDIUM | Strangler pattern, behavior preservation |

---
*Feature research for: v1.6 Architecture Cleanup — TypeScript CLI + control-server UI monorepo*  
*Researched: 2026-05-22*
