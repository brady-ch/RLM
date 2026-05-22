---
phase: 40-domain-engine-decomposition
plan: merged
subsystem: domain-recursion
tags: [refactor, recursion, rlm]
dependency_graph:
  requires: [39-adapters-tools-taxonomy]
  provides: [domain-recursion-modules]
  affects: [src/domain/recursive-language-model.ts]
tech_stack:
  added:
    - src/domain/recursion/prompt-utilities.ts
    - src/domain/recursion/budget-guard.ts
    - src/domain/recursion/execution-graph-sync.ts
    - scripts/patch-rlm-phase40-core.mjs
  patterns:
    - Pure domain helpers + orchestrator retained for remaining engine surface
key_files:
  created:
    - src/domain/recursion/prompt-utilities.ts
    - src/domain/recursion/budget-guard.ts
    - src/domain/recursion/execution-graph-sync.ts
    - scripts/patch-rlm-phase40-core.mjs
  modified:
    - src/domain/recursive-language-model.ts
decisions:
  - Shipped an incremental slice under full `npm run check` / 211-test gate; deferred tool-round and quality-loop files to avoid workspace path sync issues and reduce single-diff risk.
metrics:
  duration_minutes: "~1 session"
  completed_date: "2026-05-22"
---

# Phase 40 Plan: Domain Engine Decomposition — Summary

**One-liner:** Moved shared prompt helpers, model/tool budget math, and live execution-graph budgeting into `domain/recursion/` while keeping `RecursiveLanguageModel` as orchestrator; tool-round and quality-loop extraction documented for follow-up.

## Outcomes

| Wave (plan) | Delivered |
|-------------|-----------|
| 40-RESEARCH + RLM-05 | `40-RESEARCH.md` — host-facade vs pure helpers for future peels |
| 40-01 | `prompt-utilities.ts` — `preview`, `limitPrompt`, parse helpers, `toModelPurpose`, `fallbackFromMessages`, etc. |
| 40-02 | `budget-guard.ts` — `remainingModelCalls`, `canSpendAnyModelCall`, `maxToolRoundsFromLimit`, `hasCallReservedForDirectAnswer`, `estimateModelCalls`, `estimateToolRounds` |
| 40-03 | `execution-graph-sync.ts` — `buildLiveExecutionMetadata` for `executionGraph` + live `budget` |
| 40-04 / 40-05 | **Deferred** — `complete()` tool-round loop and quality-loop stack remain in `recursive-language-model.ts`; next pass should use `ModelCompletionHost` / `QualityLoopHost` per `40-RESEARCH.md`. |

## Requirements

| ID | Status |
|----|--------|
| RLM-01 | **Partial** — three of five concern modules landed; tool-round + quality-loop modules pending |
| RLM-02 | **Met** — orchestrator retains flow |
| RLM-03 | **Met** — recursion modules use `domain/types` + `ports` only |
| RLM-04 | **Met** — gate green after slice |
| RLM-05 | **Met** — spike in `40-RESEARCH.md` before any quality-loop file move |
| REG-01 / REG-02 | **Met** — `npm run check`, 211 tests |

## Reproducibility

Apply the same peel to a clean `recursive-language-model.ts` with:

`node scripts/patch-rlm-phase40-core.mjs` (after restoring the pre-refactor file from git).

## Deviations from Plan

### Scope reduction

- **40-04 (tool-round-loop) / 40-05 (quality-loop)** not landed as separate modules in this commit to keep a single green gate and avoid editor/shell path desync on large new files. Extraction approach is specified in `40-RESEARCH.md` (host facade).

## Threat Flags

None identified for this slice (no new network or auth surface).

## Known Stubs / Follow-ups

- `src/domain/recursion/tool-round-loop.ts` — **missing**; implement with `ModelCompletionHost` and delegate `complete` / `completeWithoutTools`.
- Quality-loop rubrics/parsers — remain in `recursive-language-model.ts`; move to `quality-loop.ts` using a narrow host.

## Self-Check: PASSED

- Verified `npm run check` exit 0, **211** tests passing (full run dated 2026-05-22).
- Presence: `src/domain/recursion/{prompt-utilities,budget-guard,execution-graph-sync}.ts`; `scripts/patch-rlm-phase40-core.mjs`.
