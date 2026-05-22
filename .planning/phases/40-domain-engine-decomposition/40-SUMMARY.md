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
    - src/domain/recursion/tool-round-loop.ts
    - src/domain/recursion/quality-loop.ts
    - src/domain/recursion/quality-loop-helpers.snippet
    - src/domain/recursion/quality-loop-header.snippet
    - scripts/stitch-quality-loop.mjs
    - scripts/phase40-peel-source.ts (frozen extractor input; excluded from compile)
    - scripts/patch-rlm-phase40-core.mjs
  patterns:
    - Pure helpers + host facades (`ModelCompletionHost`, `QualityLoopHost`) orchestrator retains maps and run state (`40-RESEARCH.md`).
key_files:
  created:
    - src/domain/recursion/prompt-utilities.ts
    - src/domain/recursion/budget-guard.ts
    - src/domain/recursion/execution-graph-sync.ts
    - src/domain/recursion/tool-round-loop.ts
    - src/domain/recursion/quality-loop.ts
    - scripts/stitch-quality-loop.mjs
  modified:
    - src/domain/recursive-language-model.ts
    - tsconfig.json
decisions:
  - Completed 40-04 (`runCompletionWithToolRounds` / `runCompletionWithoutTools`) and 40-05 stitched module with frozen rubric/parser bundle plus peel-source regenerate path to avoid brittle line slicing on future orchestrator trims.
metrics:
  duration_minutes: "~2 sessions"
  completed_date: "2026-05-22"
---

# Phase 40 Plan: Domain Engine Decomposition — Summary

**One-liner:** Recursive engine concern modules (`prompt-utilities`, `budget-guard`, `execution-graph-sync`, `tool-round-loop`, stitched `quality-loop`) live under `domain/recursion/` with narrow host facades; orchestrator keeps graph maps and budgeting fields.

## Outcomes

| Wave (plan) | Delivered |
|-------------|-----------|
| 40-RESEARCH + RLM-05 | `40-RESEARCH.md` — host facade + pure-helper split |
| 40-01 | `prompt-utilities.ts` |
| 40-02 | `budget-guard.ts` |
| 40-03 | `execution-graph-sync.ts` (`buildLiveExecutionMetadata`) |
| 40-04 | `tool-round-loop.ts` — `ModelCompletionHost`, `runCompletionWithToolRounds` / `runCompletionWithoutTools` |
| 40-05 | `quality-loop.ts` (+ `QualityLoopHost`), rubrics/parsers via `quality-loop-helpers.snippet`; main exports regenerated from `phase40-peel-source.ts` by `scripts/stitch-quality-loop.mjs` |

## Requirements

| ID | Status |
|----|--------|
| RLM-01 | **Met** — five concern slices under `domain/recursion/` plus orchestrator delegation |
| RLM-02 | **Met** — orchestrator retains `run()` / graph ownership |
| RLM-03 | **Met** — recursion modules bind to `domain/types` + `ports` only |
| RLM-04 | **Met** — `npm run check` green |
| RLM-05 | **Met** — `40-RESEARCH.md` before quality-loop wiring |
| REG-01 / REG-02 | **Met** — `npm run check`, **359** tests |

## Reproducibility

- Core peel patch (historical entry point): `node scripts/patch-rlm-phase40-core.mjs`
- Quality module rebuild: adjust `phase40-peel-source.ts` + `quality-loop-helpers.snippet` as needed → `node scripts/stitch-quality-loop.mjs`.

## Deviations from Plan

None material — stitched quality loop bundles a frozen helper fragment and archived peel source (`scripts/phase40-peel-source.ts`) so regenerating `quality-loop.ts` does not rely on drifting line numbers inside the live orchestrator after helper deletion.

## Threat Flags

None — no new network or auth paths.

## Known Stubs / Follow-ups

None — `tool-round-loop.ts` and `quality-loop.ts` are production modules; rerun stitch only when intentionally changing peeled logic.

## Self-Check: PASSED

- `npm run check` exit 0; **359** tests passing (2026-05-22).
- Presence: recursion modules listed in frontmatter; orchestrator delegates to hosts.
