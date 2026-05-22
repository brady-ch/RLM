# Phase 40 — State threading spike (RLM-05)

**Status:** Resolved before quality-loop code extraction  
**Date:** 2026-05-22

## Problem

`RecursiveLanguageModel` holds mutable run state (`modelCalls`, `maxModelCalls`, `metadata`, execution maps, tooling) that quality-loop and tool-round logic mutate interleaved with port calls. Extracting those routines into `src/domain/recursion/*` risks silent drift if “hidden `this`” assumptions leak.

## Findings

1. **Single source of mutations for budgeting** — `modelCalls`, `maxModelCalls`, and `toolRoundLimit` are read/written from `run()`, `complete()` / tool rounds, depth selection, quality phases, and graph events. Extracted routines must not own a *copy* of these counters; they either receive **explicit numeric arguments** (pure helpers) or a **narrow host facade** whose methods forward to the orchestrator fields.

2. **Host facade pattern** — For async flows that span many steps (`complete` tool loop, `runQualityLoop`), a `*Host` interface (structurally implemented by the class via a private `asXxxHost(): XxxHost` factory) keeps dependency direction **domain → ports + domain types** while avoiding duplicate state. The module exports **functions**; the class remains the only place that owns `Map` identity for `executionNodes` / `executionEdges`.

3. **Pure slices** — Budget math (`remainingModelCalls`, `estimateModelCalls`, `estimateToolRounds`) and prompt shaping (`preview`, `limitPrompt`, `toModelPurpose`) are **pure**; threading is trivial: pass values in, get values out.

4. **Execution graph snapshot** — `updateExecutionGraph()` only derives `metadata.executionGraph` and `metadata.budget` from existing maps + counters. Safe extraction: a pure `buildLiveExecutionMetadata(...)` used by the orchestrator so graph structure and budget telemetry stay in lockstep.

5. **Quality loop local state** — Loop-local variables (`metadata` `QualityLoopMetadata`, `candidateTexts`, `selectedCandidateId`, `previousGateEvaluation`) stay inside the extracted `runQualityLoop` function; **shared** state (`this.modelCalls`, `this.metadata.tokenUsage`, execution node maps) stays on the host. `writeLoopMetadata` remains a host operation because it mirrors into `executionNodes` and `metadata.qualityLoop`.

6. **Ordering / side effects** — `emitExecution`, `runStateWrites`, `trace.record`, and `recordUsage` must stay ordered as today. The host facade preserves call order; extracted functions call host hooks in the same sequence as the original methods.

## Decision

Proceed with: **pure helpers in standalone modules** + **host-facade driven `runCompletionWithToolRounds` / `runCompletionWithoutTools` / `runQualityLoop` / `completeQualityLoopPhase`** so no second copy of orchestrator fields exists in recursion modules.
