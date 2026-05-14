# Stack Research: Answer Quality Loops

**Project:** Recursive Language Model CLI v1.2
**Scope:** Stack additions/changes for hybrid refinement loop nodes only
**Researched:** 2026-05-14
**Confidence:** HIGH for internal integration points; MEDIUM for external library version posture

## Recommendation

Do not add a new orchestration framework, database, state library, or evaluator service for v1.2. Implement answer-quality loops as first-party TypeScript domain/application modules on top of the existing recursive engine, execution graph, model-purpose routing, run-state persistence, and ReactFlow UI.

The repo already has the required primitives: bounded model calls, per-node approval/editing, per-node model override, purpose-based routing, typed execution graph nodes, artifact refs, run-state mutation logs, SSE snapshots, and ReactFlow custom nodes. The new stack work should be type/model additions, not platform replacement.

## Recommended Stack Additions

| Addition | Type | Purpose | Why |
|---|---:|---|---|
| `src/domain/refinement-loop.ts` | New internal module | Execute bounded `draft -> critique -> refine -> gate -> best-of-progress` loop | Keeps loop policy pure and testable, separate from recursive decomposition mechanics. |
| `src/domain/rubrics.ts` | New internal module | Define adaptive rubric selection and rubric scoring contracts | Rubrics are product logic, not model-provider logic. This prevents prompt scattering across engine methods. |
| `src/domain/refinement-types.ts` or extend `src/domain/types.ts` | Type additions | Add `RefinementLoopState`, `RefinementIteration`, `RubricCriterion`, `GateDecision`, `LoopStopReason` | Loop history must be inspectable and serializable through metadata/UI snapshots. |
| Extend `LanguageModelPurpose` | Type/config change | Add `draft`, `critique`, `refine`, `gate`, `best_of_progress` | Existing purpose routing is the right path for phase-specific model defaults and traceability. |
| Extend `MODEL_PURPOSES` and config validation | Config change | Allow `agents.*.models.{draft,critique,refine,gate,best_of_progress}` | Reuses current tier/override semantics instead of inventing loop-only model config. |
| Extend `ExecutionGraphNode` | Type change | Add `loop?: RefinementLoopSummary` and possibly a new `kind` value: `refinement-loop` | A loop appears as one top-level node while exposing internal history in inspector state. |
| Extend `ExecutionEvent` | Type change | Add `subtype` values for `loop_iteration`, `loop_gate`, `loop_stop`, `loop_candidate` | SSE/UI can update inspectable loop history without scraping trace text. |
| Extend `RunStatePersistence` paths | Persistence change | Persist loop snapshots/checkpoints under `checkpoints` or `loopHistory.<nodeId>` | Existing run-state store is sufficient; do not add SQLite just for loop history. |
| UI `LoopInspector` component in `ui/src/main.tsx` or split UI modules | UI addition | Show iterations, critique resolution, rubric scores, stop reason, selected candidate | ReactFlow already supports custom node data/handles; keep the loop as one node card plus inspector detail. |
| Focused tests in `tests/recursive-language-model.test.ts` or new loop test file | Test addition | Verify stop reasons, max iteration cap, model-purpose routing, history serialization | Loops are policy-heavy and need deterministic fake model tests. |

## Existing Libraries To Keep Using

| Library | Current project version | Use for v1.2 | Rationale |
|---|---:|---|---|
| TypeScript | `^6.0.3` | Primary implementation language | Existing strict-ish typed boundaries are the main safety tool for graph/event schema changes. |
| Zod | `^4.4.3` | Validate config, rubric contributions, event payloads, and persisted loop snapshots | Zod 4 is stable and supports TypeScript-first validation plus JSON Schema conversion; no need for a second schema library. |
| `@xyflow/react` | `^12.8.7` | Render loop node and existing graph handles | ReactFlow supports custom nodes, multiple handles, and source/target handle ids; current UI already uses those APIs. |
| React/Vite | React `^19.2.1`, Vite `^7.2.7` | Existing browser UI | No new UI state framework is needed for the current snapshot/SSE architecture. |
| `lucide-react` | `^0.468.0` | Icons for loop status/actions | Already in use; sufficient for gate/stop/history affordances. |
| `@langchain/langgraph` | `^1.2.9` | Do not use for core loop execution in v1.2 | LangGraph supports graph loops and conditional edges, but adopting it here would create a second execution controller beside the existing recursive engine. |

## Model Routing Changes

Add new language-model purposes:

```ts
export type LanguageModelPurpose =
  | "depth"
  | "classify"
  | "decompose"
  | "answer"
  | "summarize"
  | "synthesize"
  | "draft"
  | "critique"
  | "refine"
  | "gate"
  | "best_of_progress";
```

Recommended defaults:

| Loop phase | Default routing | Override behavior |
|---|---|---|
| Draft | `answer`-like small/medium tier, config purpose `draft` if present | Node-level phase override wins, then node override, then agent purpose config. |
| Critique | medium or dynamic | Should be independently overridable; critique quality is often the bottleneck. |
| Refine | same tier as draft or one tier higher | Use phase override if user selects a stronger model for refinement. |
| Gate | medium deterministic prompt, no tools by default | Gate must return structured decision and stop reason. |
| Best-of-progress | medium/dynamic | Selects final among candidates, including earlier drafts when refinement regresses. |

Do not overload the existing single `TaskNode.modelOverride` for all phases. Add loop-specific overrides:

```ts
type RefinementPhase = "draft" | "critique" | "refine" | "gate" | "best_of_progress";

interface RefinementLoopConfig {
  maxIterations: number;
  passThreshold: number;
  minImprovementDelta: number;
  phaseModelOverrides?: Partial<Record<RefinementPhase, string>>;
}
```

## Data Contracts

Use serializable plain objects, validated with Zod at the boundaries:

```ts
type LoopStopReason =
  | "pass_threshold"
  | "critique_resolved"
  | "no_meaningful_improvement"
  | "max_iterations"
  | "human_accept";

interface RefinementIteration {
  iteration: number;
  draft: string;
  critique: string;
  refined: string;
  gate: {
    passed: boolean;
    score: number;
    unresolvedCritiqueIds: string[];
    improvementDelta: number;
    stopReason?: LoopStopReason;
  };
  models: Partial<Record<RefinementPhase, string>>;
}

interface RefinementLoopSummary {
  rubricId: string;
  rubricFit: number;
  iterations: RefinementIteration[];
  bestIteration: number;
  stopReason: LoopStopReason;
}
```

Store full text in loop history only while bounded. If later loops become large, reuse the existing artifact-ref pattern and keep graph state to summaries plus refs.

## Integration Points

| Area | Change |
|---|---|
| `src/domain/recursive-language-model.ts` | Add a branch that detects loop-enabled tasks/nodes and delegates to `runRefinementLoop(...)`; keep recursion/decomposition unchanged. |
| `src/domain/types.ts` | Extend graph node, event, trace, purpose, and metadata types for loop summaries/history. |
| `src/ports/language-model-port.ts` | Extend `LanguageModelPurpose`; no provider API change needed because `purpose` and `overrideModel` already exist. |
| `src/application/project-config.ts` | Extend `MODEL_PURPOSES` and schema validation to accept loop phase model selections. |
| `src/application/model-provider.ts` | No architectural change; existing `PurposeRoutingLanguageModel.selectModel` already handles configured purposes once the type/config allow them. |
| `src/application/execution-controller.ts` | Register loop nodes, expose loop history in snapshots, add controller methods for phase overrides and human accept. |
| `src/domain/run-state-persistence.ts` | Add a generic `persistLoopState(nodeId, loopState)` or generic mutation helper instead of only node status writes. |
| `ui/src/main.tsx` | Add loop-aware node rendering and inspector section; phase override controls should be inside the selected node inspector. |

## What Not To Add

| Avoid | Why |
|---|---|
| New orchestration engine for this feature | Existing engine owns cancellation, model budgets, approval, graph metadata, and no-silent-failure semantics. Splitting execution would create duplicate failure modes. |
| LangGraph as the loop runtime | Its loop/conditional-edge model is relevant, but the repo already has a typed execution controller. Use it as conceptual reference only. |
| SQLite/Postgres for loop history | Current local-first run-state store and artifact refs are enough for bounded loop histories. Revisit only if durable cross-session replay becomes a milestone goal. |
| Redux/Zustand/XState | Current UI receives backend-authoritative snapshots over SSE. More client state would weaken the backend-authoritative graph model. |
| External LLM evaluator/scoring service | v1.2 needs inspectable hybrid refinement, not benchmark-grade eval infrastructure. Use model-based gate plus structured rubric output. |
| Vector database/embedding stack | Not needed for draft/critique/refine/gate loops unless future retrieval memory is explicitly prioritized. |
| Prompt-only hidden loops | Conflicts with the requirement for inspectable loop history and clear stop reasons. |

## Implementation Boundaries

Keep these boundaries strict:

- `rubrics.ts` selects criteria and renders phase prompts; it does not call models.
- `refinement-loop.ts` executes loop policy using `LanguageModelPort`, budget checks, cancellation checks, and event callbacks.
- `recursive-language-model.ts` decides whether a task runs direct/recursive/loop and records trace/metadata.
- `execution-controller.ts` remains the backend authority for graph snapshots, approvals, phase overrides, and human accept.
- UI renders loop history and sends override/accept actions; it does not compute gate outcomes.

## Source Notes

- Local source: `package.json` confirms existing dependencies: Zod 4, React 19, Vite 7, `@xyflow/react`, LangChain/LangGraph packages.
- Local source: `src/ports/language-model-port.ts` already supports `purpose` and `overrideModel`.
- Local source: `src/application/model-provider.ts` already routes by purpose and records model selections.
- Local source: `src/domain/types.ts` and `src/application/execution-controller.ts` already carry graph nodes, model overrides, events, snapshots, run-state hooks, and approval controls.
- Official Zod docs: Zod 4 is stable and includes TypeScript-first validation and JSON Schema conversion. https://zod.dev/
- Official ReactFlow docs: custom nodes and multiple handles with `sourceHandle`/`targetHandle` are supported. https://reactflow.dev/learn/customization/handles
- Official LangGraph JS docs: LangGraph supports state graphs and conditional edges, but this project should not adopt it as a second runtime for v1.2. https://docs.langchain.com/oss/javascript/langgraph/graph-api
