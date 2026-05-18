---
phase: 15
name: loop-phase-model-routing-and-overrides
status: discussed
created_at: 2026-05-18
autonomous: true
requirements:
  - MODL-04
  - MODL-05
  - MODL-06
---

# Phase 15 Context

## Goal

Users can control and audit model selection independently for each quality-loop phase.

## Smart Discuss Decisions

### 1. Loop phase routing contract

Decision: add distinct quality-loop phase purposes for `draft`, `critique`, `refine`, `gate`, and `best_of_progress`, then route each through the existing purpose-routing model wrapper.

Rationale: the existing `PurposeRoutingLanguageModel` already owns tier resolution, runtime host selection, model selection recording, and strict host failures. Extending that contract keeps routing behavior centralized.

### 2. Override surface

Decision: support a structured runtime/config override map keyed by loop phase, using configured model tier names or concrete model ids.

Rationale: this gives CLI/config users a stable surface now and gives the later UI phase a durable backend contract.

### 3. Planned vs effective model trace

Decision: record planned and effective model assignment on every quality-loop internal phase event and summarize them in `qualityLoop.phaseModels` metadata.

Rationale: per-event detail preserves audit history across iterations while the summary keeps CLI/JSON output compact.

### 4. Unavailable model behavior

Decision: fail explicitly before the selected loop phase runs, including phase name, requested route/model, and available configured routes in the error/metadata.

Rationale: Phase 15 is part of the no-silent-failures milestone. Selected unavailable models must never silently fall back.

## Existing Code Facts

- `LanguageModelPurpose` currently contains only `depth`, `classify`, `decompose`, `answer`, `summarize`, and `synthesize`.
- `PurposeRoutingLanguageModel.selectModel()` resolves a purpose to an agent model selection and then to a configured tier or concrete model id.
- `runQualityLoop()` currently calls `completeQualityLoopPhase()`, which always uses purpose `answer` plus the task-level `modelOverride`.
- `QualityLoopPhaseRecord` currently stores only the effective `model` string.
- Global `metadata.modelSelections` records model selections from `agent-runner`, but loop metadata does not yet summarize planned/effective model assignments by loop phase.

## Must-Haves

- Draft, critique, refine, gate, and best-of-progress phases use distinct model purposes.
- Runtime quality-loop config accepts per-phase model overrides.
- Per-phase metadata records planned route/selection and effective model.
- Compact CLI output exposes quality-loop phase model summary.
- Invalid or unavailable selected phase models fail explicitly instead of silently falling back.
