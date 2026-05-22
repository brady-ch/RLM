---
phase: "42-test-restructure-docs"
plan: "42-test-restructure-docs"
type: standard
requirements:
  - TEST-01
  - TEST-02
  - TEST-03
  - TEST-04
  - TEST-05
  - DOC-01
  - DOC-02
  - REG-01
  - REG-02
---

## Objective

Restructure large engine tests around `src/domain/recursion/` boundaries, extract shared helpers, tighten config/bootstrap unit coverage at extraction seams, refresh `AGENTS.md`, and keep `npm run check` green without dropping tests.

## Context

@42-CONTEXT.md

## Tasks

### 1 — PLAN.md publication (auto)

Deliver this file; orchestrator commits or executor commits once.

### 2 — Extract `tests/helpers/` (auto)

Move shared prelude from `recursive-language-model.test.ts` into cohesive helper modules (`mock-language-model`, `mock-plan-model`, `recursion-fixtures`, `quality-loop-helpers`, `simple-tools`). Preserve identifiers and behavior verbatim (TEST-05).

### 3 — Split recursive engine tests (auto)

Create `tests/domain/recursion/recursive-language-model.test.ts` with the verbatim test blocks (from line 314 onward) plus updated imports. Remove `tests/recursive-language-model.test.ts` stub.

Update `package.json` `test` script so nested `dist/tests/**/*.test.js` files run (`node --test dist/tests`).

### 4 — Domain recursion units (auto)

Add focused Node test files:

- `tests/domain/recursion/prompt-utilities.unit.test.ts`
- `tests/domain/recursion/budget-guard.unit.test.ts`
- `tests/domain/recursion/execution-graph-sync.unit.test.ts`

### 5 — Config / bootstrap seams (auto)

Where `project-config.spec.ts` facade already covers routing, add at least:

- `tests/application/config/yaml-merge.unit.test.ts` (`mergeYamlLayers`, `mergeInterop`, `isPlainRecord`)
- `tests/application/config/loader.unit.test.ts` (`parseYamlTagged` error path)

Bootstrap retains `bootstrap-runtime.unit.test.ts`; extend only if an obvious pure gap appears.

### 6 — Verification (auto)

- Record `grep -r '^test(' tests ... | wc -l` before helpers split vs after (`recursive-language-model` suite count unchanged; totals may rise only due to new unit tests).
- `npm run check` passes.

### 7 — DOC-01 / DOC-02 (auto)

Rewrite `AGENTS.md` layout table: `application/config/*`, `application/bootstrap/*`, `domain/recursive-language-model.ts` + `domain/recursion/*`, adapter subdirs, `application/control-server/handlers/*`, `tests/helpers/`, `tests/domain/recursion/*`. Extend “Extending” with pointers for config fields and bootstrap wiring.

### 8 — CLOSE (auto)

Produce `42-test-restructure-docs-SUMMARY.md`, `VERIFICATION.md` in phase dir if required by tooling, bump `.planning/STATE.md`, `ROADMAP.md`, mark requirements TEST/DOC/REG rows in `REQUIREMENTS.md`, final docs commit.

## Success criteria

- All listed requirements marked complete in REQUIREMENTS traceability after execution.
- No intentional semantic changes to production code.
- Integration anchors (`integration-v15`, graph/session suites) untouched except import path churn if any (none expected).
