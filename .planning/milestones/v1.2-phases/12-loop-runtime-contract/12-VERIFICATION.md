---
phase: 12-loop-runtime-contract
verified: 2026-05-17T17:42:47Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
---

# Phase 12: Loop Runtime Contract Verification Report

**Phase Goal:** Users can run a quality loop as one bounded top-level graph node with inspectable internal loop state and explicit exit semantics.
**Verified:** 2026-05-17T17:42:47Z
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can see a quality loop represented as one collapsed top-level execution graph node. | VERIFIED | `run()` branches on `request.config.qualityLoop?.enabled === true` before `selectDepth()`, creates `ensureExecutionNode(root, "quality-loop", ...)`, and the test `quality loop graph node stays collapsed with nested phase history` asserts exactly one graph node with kind `"quality-loop"` and no depth event. |
| 2 | User can inspect the loop's internal draft, critique, refine, gate, and best-of-progress history without expanding it into top-level nodes. | VERIFIED | `QUALITY_LOOP_PHASES` contains `draft`, `critique`, `refine`, `gate`, and `best_of_progress`; `runQualityLoop()` records phase records inside `QualityLoopMetadata.iterations`; tests assert the nested phase sequence and per-phase model metadata. |
| 3 | User can configure max iterations and model-call budget behavior before the loop runs. | VERIFIED | `runtime.qualityLoop` is validated by `qualityLoopSchema`; CLI flags set `configOverrides.qualityLoop`; config and parse tests cover default disabled config, explicit `maxIterations`, invalid `maxIterations: 0`, `--quality-loop`, and `--quality-loop-max-iterations`. |
| 4 | Every completed, stopped, degraded, or failed loop reports a clear stop reason and usage summary. | VERIFIED | `finish()` requires `stopReason`, writes `metadata.usage = summarizeQualityLoopUsage(metadata)`, emits `quality loop stopped: ...`, and tests cover `max_iterations`, `budget_exhausted`, `degraded`, and `failed` terminal states with usage assertions. |
| 5 | Quality loop state has a typed canonical contract before runtime implementation uses it. | VERIFIED | `src/domain/types.ts` exports `QualityLoopConfig`, `QualityLoopMetadata`, `QualityLoopStopReason`, usage, issue, candidate, phase, and iteration types; metadata is exposed on `RecursivePromptMetadata.qualityLoop` and `ExecutionGraphNode.loop`. |
| 6 | Users can opt into a quality loop through explicit runtime configuration. | VERIFIED | YAML `runtime.qualityLoop.enabled` and CLI `--quality-loop` / `--quality-loop-max-iterations` are implemented; ordinary runs remain non-loop unless `qualityLoop.enabled === true`. |
| 7 | Invalid or unbounded loop configuration is rejected before execution starts. | VERIFIED | Zod requires `maxIterations` to be a positive integer and `budgetBehavior` to be `"stop_before_partial_iteration"`; config test asserts invalid `maxIterations: 0` rejects with `maxIterations` in the error. |
| 8 | User can run an explicit quality loop as one collapsed top-level graph node. | VERIFIED | Runtime path creates one root `"quality-loop"` node and no loop phase child nodes or edges; fake-model test asserts `executionGraph.nodes.length === 1`. |
| 9 | User can inspect nested draft, critique, refine, gate, and best-of-progress records in loop metadata. | VERIFIED | Phase records include `phase`, status, timestamps, summary, model, usage, candidate id, and unresolved issues; test asserts nested phase order and model sequence. |
| 10 | Loop execution stops before an iteration that cannot finish within the model-call budget. | VERIFIED | `runQualityLoop()` checks `remainingModelCalls() < 5` before each iteration and returns `budget_exhausted` with zero iterations and zero loop model calls when `maxModelCalls: 4`. |
| 11 | Every terminal loop has a stop reason and usage summary. | VERIFIED | Terminal helper writes `stopReason`, `usage.modelCallsTotal`, token totals, phase call counts, and selected candidate id when available; render tests expose these fields. |
| 12 | Non-loop recursive execution remains unchanged unless `qualityLoop.enabled` is true. | VERIFIED | Quality-loop branch is gated by `request.config.qualityLoop?.enabled === true`; test `quality loop disabled preserves non loop direct execution` asserts the direct trace remains `["answer"]`. |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/domain/types.ts` | Quality loop config, metadata, stop reason, issue, candidate, phase, usage, and graph-node contracts | VERIFIED | Contains exported loop contract types, `RecursiveModelConfig.qualityLoop`, `RecursivePromptMetadata.qualityLoop`, `"quality-loop"` node kind, and `ExecutionGraphNode.loop`. |
| `src/application/project-config.ts` | Zod validation and conservative defaults for `runtime.qualityLoop` | VERIFIED | Contains `qualityLoopSchema`, default disabled loop config, positive `maxIterations`, and literal `budgetBehavior`. |
| `src/cli/args.ts` | CLI opt-in flags mapping into `RecursiveModelConfig.qualityLoop` | VERIFIED | Contains `--quality-loop`, `--quality-loop-max-iterations`, and writes both `config.qualityLoop` and `configOverrides.qualityLoop`. |
| `tests/project-config-scopes.test.ts` | Config validation tests for loop bounds and defaults | VERIFIED | Contains all three required `quality loop config ...` tests. |
| `src/domain/recursive-language-model.ts` | Opt-in loop runtime path, budget preflight, phase records, terminal metadata, and events | VERIFIED | Contains `runQualityLoop`, `completeQualityLoopPhase`, five-call preflight, synchronized metadata writes, terminal stop handling, degraded and failure paths. |
| `src/cli/render.ts` | Compact and JSON output exposing canonical `qualityLoop` metadata | VERIFIED | JSON includes `qualityLoop: result.metadata.qualityLoop`; compact output includes status, stop reason, iteration count, selected candidate id, and usage. |
| `tests/recursive-language-model.test.ts` | Fake-model tests for loop node shape, budget exhaustion, metadata, render output, and non-loop regression | VERIFIED | Contains runtime, parse, metadata, degraded, failed, disabled-regression, and render coverage. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/application/project-config.ts` | `src/domain/types.ts` | `RecursiveModelConfig.qualityLoop` | WIRED | Runtime config schema produces the typed `qualityLoop` object used by `RecursiveModelConfig`. |
| `src/cli/args.ts` | `src/domain/types.ts` | `configOverrides.qualityLoop` | WIRED | Manual check found assignments at `src/cli/args.ts` lines 182 and 195; SDK pattern check was a false negative caused by escaped regex literal handling. |
| `src/domain/recursive-language-model.ts` | `src/domain/types.ts` | `QualityLoopMetadata` | WIRED | Runtime imports and writes canonical `QualityLoopMetadata`, phase, candidate, issue, status, and config types. |
| `src/domain/recursive-language-model.ts` | `src/cli/render.ts` | `RecursivePromptMetadata.qualityLoop` | WIRED | Runtime writes `this.metadata.qualityLoop`; renderer reads `result.metadata.qualityLoop` for compact and JSON output. SDK pattern check was a false negative against the dotted access form. |
| `tests/recursive-language-model.test.ts` | `src/domain/recursive-language-model.ts` | `RecursiveLanguageModel.run({ config: { qualityLoop: ... } })` | WIRED | Tests instantiate `RecursiveLanguageModel` with explicit `qualityLoop` config and assert runtime metadata/output behavior. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/domain/recursive-language-model.ts` | `metadata.qualityLoop` / `node.loop` | `runQualityLoop()` creates metadata, `completeQualityLoopPhase()` calls `this.model.complete()`, `writeLoopMetadata()` synchronizes result metadata and graph node metadata. | Yes | FLOWING |
| `src/cli/render.ts` | `result.metadata.qualityLoop` | Runtime result metadata from `RecursiveLanguageModel.run()`; render tests build inline metadata to verify projection. | Yes | FLOWING |
| `src/application/project-config.ts` | `config.runtime.qualityLoop` | Zod-parsed YAML plus `DEFAULT_PROJECT_CONFIG.runtime`; tested with temp YAML files. | Yes | FLOWING |
| `src/cli/args.ts` | `configOverrides.qualityLoop` | Explicit CLI flags set override objects consumed by runtime config resolution. | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build and quality-loop runtime/render/config checks | `npm run build && node --test --test-name-pattern='quality loop' dist/tests/recursive-language-model.test.js && node --test --test-name-pattern='renders .*quality loop metadata' dist/tests/recursive-language-model.test.js && node --test --test-name-pattern='quality loop config' dist/tests/project-config-scopes.test.js` | Build passed; 11/11 quality-loop recursive/render tests passed; 2/2 render metadata tests passed; 3/3 config tests passed. | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LOOP-01 | 12-01, 12-02 | User can run an answer-quality refinement loop as one collapsed top-level execution graph node with inspectable internal `draft -> critique -> refine -> gate -> best-of-progress` history. | SATISFIED | Runtime creates one `"quality-loop"` graph node and stores internal phases in `node.loop.iterations`; fake-model test asserts one node and full nested phase history. |
| LOOP-02 | 12-01, 12-02 | User can configure hard loop bounds, including max iterations and model-call budget behavior, and every loop exits with an explicit stop reason. | SATISFIED | Config/CLI support `maxIterations` and `budgetBehavior`; runtime preflights five model calls and terminal helper requires stop reasons; tests cover `max_iterations` and `budget_exhausted`. |
| LOOP-03 | 12-01, 12-02 | User can inspect loop history including candidate text summaries, critiques, refinements, scores, unresolved issues, selected candidate, phase model, and token/model-call usage. | SATISFIED | Types and runtime metadata expose candidates, phase records, unresolved issues, selected candidate id, per-phase model metadata, usage totals, and renderer output; tests cover selected candidate, unresolved issues, unknown model fallback, and usage. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| N/A | N/A | N/A | N/A | No blocking stub or placeholder patterns found in phase files. Static empty arrays/objects found by grep are normal initialization/test fixture values that are populated by runtime, config parsing, or assertions. |

### Human Verification Required

None. Phase 12 is a runtime contract phase and `.planning/phases/12-loop-runtime-contract/12-VALIDATION.md` states LOOP-01, LOOP-02, and LOOP-03 are fully testable with fake models and metadata assertions.

### Gaps Summary

No gaps found. The phase goal and LOOP-01, LOOP-02, and LOOP-03 are satisfied in the codebase. Later phases explicitly handle richer rubric selection, best-of-progress algorithms, phase-specific model routing, UI controls, and broader regression harnesses; those are not Phase 12 blockers.

---

_Verified: 2026-05-17T17:42:47Z_
_Verifier: the agent (gsd-verifier)_
