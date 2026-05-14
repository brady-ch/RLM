# Architecture Patterns: Answer Quality Loops

**Project:** Recursive Language Model CLI v1.2
**Domain:** Hybrid answer-quality refinement loops inside an existing recursive CLI/UI runtime
**Researched:** 2026-05-14
**Overall confidence:** HIGH for integration points from repository code; MEDIUM for exact scoring heuristics because rubric behavior is a product decision.

## Recommendation

Implement answer-quality loops as a bounded solver strategy inside `RecursiveLanguageModel`, not as a separate workflow runner and not as five top-level graph nodes. A loop should appear as one top-level `ExecutionGraphNode` with a typed `qualityLoop` payload containing its internal `draft -> critique -> refine -> gate -> best_of_progress` history. This preserves the existing approval graph contract while making internal loop state inspectable.

The runtime should use normal `LanguageModelPort.complete()` calls with new model purposes for loop phases. Model routing should remain centralized in `PurposeRoutingLanguageModel`; per-loop-phase overrides should live on the execution node and be passed through `overrideModel` for each phase call. Trace and UI should show both the outer node status and internal loop phase history so failures and stop reasons are explicit.

Do not redesign recursion. Add a loop mode that wraps direct answer and synthesize outputs when configured or when a node composer/rubric marks the node as requiring refinement. The existing recursive decomposition policy remains responsible for deciding task structure; the new loop policy is responsible for improving a candidate answer for a single task node.

## Existing Anchors

| Existing Area | Current Role | Loop Integration |
|---|---|---|
| `src/domain/recursive-language-model.ts` | Owns depth, classify, decompose, answer, summarize, synthesize, budgets, trace, execution graph updates | Add loop solver methods and call them from direct/synthesize paths behind a config/node policy |
| `src/domain/types.ts` | Shared runtime, execution graph, trace, config types | Add loop config, loop metadata, loop trace kinds, model purposes, stop reasons |
| `src/application/execution-controller.ts` | Backend-authoritative node state, approvals, model override, snapshot | Preserve one outer node; add loop update events and phase override mutation support |
| `src/application/model-provider.ts` | Purpose-based model routing and strict override behavior | Extend purpose set for `draft`, `critique`, `refine`, `gate`, `best_of_progress` |
| `src/application/project-config.ts` | Zod config validation, defaults, agent model maps | Add loop runtime defaults and agent model purpose defaults |
| `src/application/control-server.ts` | Local HTTP/SSE API for session graph/control | Add endpoints for loop phase overrides and optional human accept gate |
| `ui/src/main.tsx` | ReactFlow graph and inspector | Render compact top-level loop node plus expandable internal loop history |

## New Domain Concepts

### Types

Add these to `src/domain/types.ts`:

```typescript
export type QualityLoopPhase = "draft" | "critique" | "refine" | "gate" | "best_of_progress";

export type QualityLoopStopReason =
  | "pass_threshold"
  | "critique_resolved"
  | "no_meaningful_improvement"
  | "max_iterations"
  | "human_accept";

export interface QualityLoopConfig {
  enabled: boolean;
  maxIterations: number;
  passThreshold: number;
  minImprovementDelta: number;
  humanGate?: "never" | "on_threshold_miss" | "always";
}

export interface QualityRubricCriterion {
  id: string;
  label: string;
  weight: number;
  description: string;
}

export interface QualityLoopPhaseModelOverride {
  phase: QualityLoopPhase;
  model?: string | undefined;
}

export interface QualityLoopIteration {
  iteration: number;
  draft?: QualityLoopCandidate | undefined;
  critique?: QualityLoopCritique | undefined;
  refined?: QualityLoopCandidate | undefined;
  gate?: QualityLoopGateResult | undefined;
}

export interface QualityLoopMetadata {
  enabled: boolean;
  status: "pending" | "running" | "passed" | "stopped" | "failed";
  rubricId: string;
  rubricCriteria: QualityRubricCriterion[];
  phaseModelOverrides?: QualityLoopPhaseModelOverride[] | undefined;
  iterations: QualityLoopIteration[];
  bestCandidateId?: string | undefined;
  stopReason?: QualityLoopStopReason | undefined;
  summary?: string | undefined;
}
```

Attach `qualityLoop?: QualityLoopMetadata` to `ExecutionGraphNode`. Keep large answer bodies either summarized in graph metadata or stored through the existing artifact/run-state pattern if they grow beyond a small preview.

### Trace

Extend `TraceEvent.kind` and `LanguageModelPurpose` with:

```typescript
"draft" | "critique" | "refine" | "gate" | "best_of_progress"
```

Use the same node id for loop phase trace events and include iteration/phase markers in `prompt` or add optional structured trace metadata if a broader trace schema change is acceptable. The important rule is that every model call has a visible phase, selected model, and output preview.

## Runtime Integration

### Solver Flow

Recommended flow inside `RecursiveLanguageModel`:

1. Existing `solve()` decides whether the node is direct or recursive.
2. Existing direct answer or synthesize creates a candidate answer.
3. If quality loops are enabled for this node, call `runQualityLoop(task, initialCandidate, context)`.
4. `runQualityLoop()` performs bounded iterations:
   - `draft`: only when no initial candidate exists or when configured for best-of-N initial drafts.
   - `critique`: evaluate candidate against adaptive rubric and unresolved issues.
   - `refine`: produce a revised candidate using critique.
   - `gate`: score candidate, check threshold, critique resolution, and improvement delta.
   - `best_of_progress`: choose final candidate from all accepted and intermediate candidates when gate does not pass early.
5. Return the chosen answer to existing caller. Downstream summarize/synthesize flow remains unchanged.

The loop should share `maxModelCalls`. Do not add a separate hidden budget. Add `qualityLoop.maxIterations` and include loop calls in `metadata.budget.modelCallsUsed`.

### Stop Reasons

Stop reasons should be computed in the domain runtime and stored on the graph node:

| Stop Reason | Runtime Condition |
|---|---|
| `pass_threshold` | Gate score >= configured threshold |
| `critique_resolved` | Gate says all material critique items are resolved even if score is borderline |
| `no_meaningful_improvement` | Score delta or critique-resolution delta is below `minImprovementDelta` after at least one refine |
| `max_iterations` | Loop reaches `maxIterations` |
| `human_accept` | User accepts current candidate at a human gate checkpoint |

If a gate response is unparsable, mark the outer node failed with `failureCategory: "model"` and an explicit code/message. Do not silently choose the latest candidate.

## Model Routing

Extend `LanguageModelPurpose`, `MODEL_PURPOSES`, `agentModelsSchema`, and `defaultAgentModels()` to include:

```typescript
draft
critique
refine
gate
best_of_progress
```

Default mappings should be conservative:

| Purpose | Default Tier | Rationale |
|---|---|---|
| `draft` | same as `answer` or dynamic | Content generation benefits from the normal answer model |
| `critique` | medium/dynamic | Critique needs stronger reasoning than shallow drafting |
| `refine` | same as `answer` or dynamic | Revision needs context handling and style control |
| `gate` | medium | Scoring must be stable and should not use the smallest model by default |
| `best_of_progress` | medium/dynamic | Final selection should compare candidates and stop reasons |

Per-node model override currently applies to every completion for that node. For loops, add phase-specific overrides so a user can use a stronger model for `critique` or `gate` without forcing every phase to that model.

Recommended precedence:

1. Phase-specific user override on `node.qualityLoop.phaseModelOverrides`.
2. Existing node-level `modelOverride`.
3. Agent model configured for the loop phase purpose.
4. Default tier fallback.

Implementation detail: update the internal `complete()` helper to accept an optional `{ purposeOverride, overrideModel }` or add `completeForPurpose(task, purpose, messages, options)`. Avoid overloading trace kind conversion too much; loop phases are first-class purposes.

## Execution Graph Metadata

Keep one top-level node in `executionGraph.nodes`.

Add these fields to `ExecutionGraphNode`:

```typescript
qualityLoop?: QualityLoopMetadata;
loopKind?: "none" | "answer_quality";
```

Recommended event updates:

```typescript
export interface ExecutionEvent {
  ...
  qualityLoopUpdate?: {
    phase: QualityLoopPhase;
    iteration: number;
    status: "started" | "completed" | "failed";
    score?: number;
    stopReason?: QualityLoopStopReason;
    message?: string;
  };
}
```

`RecursiveLanguageModel` should call an internal `updateQualityLoopNode(nodeId, update)` after each phase. That method should update `metadata.executionGraph`, publish `ExecutionEvent`, and persist enough state through `RunStatePersistence` to reconstruct loop progress if run-state continuity is later expanded.

## Approval and Human Gates

Use existing approval semantics for outer node execution. A quality loop should not ask for approval before every internal phase by default because that would make the top-level node abstraction meaningless.

Add a separate human gate only for explicit policy:

| Policy | Behavior |
|---|---|
| `never` | Fully automatic bounded loop |
| `on_threshold_miss` | Pause after max iterations or no-improvement when best candidate is below threshold |
| `always` | Pause before final answer selection |

This can reuse `ExecutionControl.waitForNodeApproval`, but the event/message must identify it as a quality gate, not normal node approval. Better long-term shape is a dedicated `requestQualityGateApproval(input)` on `ExecutionControl` so the UI can show candidate-specific accept/retry controls without confusing graph edit approvals.

Initial implementation can support `human_accept` through a dedicated control-server endpoint:

```text
POST /api/nodes/:id/quality-loop/accept
POST /api/nodes/:id/quality-loop/phase-model
```

## ReactFlow UI

### Node Card

Render loop nodes as normal cards with compact loop status:

- `Loop: running/passed/stopped/failed`
- Current phase and iteration
- Best score and threshold
- Stop reason when terminal
- Planned/effective model trail should include phase model chips when overrides exist

Do not render draft/critique/refine/gate as separate ReactFlow nodes by default. That would pollute the user-authored execution graph and complicate edit/delete/connect semantics.

### Inspector

Add an expandable `Quality Loop` section to `NodeInspector`:

- Rubric id and weighted criteria
- Iteration timeline
- Candidate previews
- Critique issue list with resolved/unresolved status
- Gate score and pass/fail reason
- Best-of-progress selection reason
- Phase model override controls for `draft`, `critique`, `refine`, `gate`, `best_of_progress`
- Human accept button when a quality gate is awaiting acceptance

Keep the existing `Model Override` input as node-wide fallback. Add phase overrides below it so the precedence is visible.

## API Changes

Modify `control-server.ts`:

| Endpoint | Purpose |
|---|---|
| `GET /api/session` | Already sufficient if `qualityLoop` is on graph nodes |
| `POST /api/nodes/:id/quality-loop/phase-model` | Set/clear phase-specific model override |
| `POST /api/nodes/:id/quality-loop/accept` | Accept best/current candidate at a human gate |
| `POST /api/nodes/:id/quality-loop/retry` | Optional later; request one more iteration if budget allows |

Modify `InteractiveExecutionSession`:

- Add `setNodeQualityLoopPhaseModelOverride(nodeId, phase, model?)`.
- Add pending quality gate state if human gates are implemented in v1.2.
- Merge runtime loop updates in `registerNode()` without dropping existing `qualityLoop` state, similar to composer merging.

## New Modules

Create focused domain modules rather than expanding `recursive-language-model.ts` with all prompt text and scoring parsing:

| New Module | Responsibility |
|---|---|
| `src/domain/quality-loop.ts` | Loop orchestration helpers, stop-reason computation, candidate comparison |
| `src/domain/quality-rubrics.ts` | Default adaptive rubric selection and criteria definitions |
| `src/domain/quality-gate-parser.ts` | Parse and validate critique/gate/best-of-progress structured model outputs |

`RecursiveLanguageModel` should remain the owner of model calls, budgets, cancellation, trace, and execution graph mutation. The new modules should be pure or near-pure helpers that receive text/results and return typed decisions.

## Modified Modules

| Module | Changes |
|---|---|
| `src/ports/language-model-port.ts` | Add loop purposes |
| `src/domain/types.ts` | Add loop config, metadata, event, trace, and graph node fields |
| `src/domain/recursive-language-model.ts` | Add `runQualityLoop`, loop phase completions, loop graph updates, stop reasons |
| `src/application/project-config.ts` | Add config validation/defaults for loop runtime and new model purposes |
| `src/application/model-provider.ts` | No algorithm change; ensure new purposes route and record selections |
| `src/application/execution-controller.ts` | Store loop metadata, phase overrides, human gate pending state |
| `src/application/control-server.ts` | Add phase override and accept endpoints |
| `src/cli/render.ts` | Show loop status, stop reason, and phase model trail in text/JSON output |
| `ui/src/main.tsx` | Add loop fields to client types, card summary, inspector timeline and controls |
| `tests/recursive-language-model.test.ts` | Add unit/integration coverage for loop execution, graph metadata, overrides, UI API contracts |

## Data Flow

```text
User prompt
  -> RecursiveLanguageModel.solve()
  -> direct answer or recursive synthesize produces candidate
  -> runQualityLoop()
       -> complete(purpose=draft/critique/refine/gate/best_of_progress)
       -> update ExecutionGraphNode.qualityLoop after each phase
       -> emit ExecutionEvent.qualityLoopUpdate over SSE
       -> PurposeRoutingLanguageModel records phase model selection
  -> final candidate returned as node answer
  -> existing summarize/synthesize/CLI render path continues
```

For UI:

```text
ExecutionEvent
  -> InteractiveExecutionSession.publish()
  -> /api/events SSE
  -> UI refreshes /api/session
  -> ReactFlow card shows compact loop status
  -> Inspector shows internal loop timeline and phase model controls
```

## Build Order

1. **Types and config foundation**
   - Add loop config, model purposes, graph metadata, trace/event types.
   - Update config defaults and schema so existing configs continue to load.

2. **Pure loop helpers**
   - Add rubric selection, gate parsing, stop-reason computation, best-candidate selection.
   - Unit-test parser failures and no-improvement behavior before wiring model calls.

3. **Runtime loop execution**
   - Add `runQualityLoop()` to `RecursiveLanguageModel`.
   - Wire it to direct answer first, then synthesize.
   - Enforce model-call budget and cancellation between every phase.

4. **Graph, trace, and CLI visibility**
   - Publish `qualityLoopUpdate` events.
   - Store `ExecutionGraphNode.qualityLoop`.
   - Render loop status and stop reason in CLI text/JSON.

5. **Model override controls**
   - Add phase-specific override storage in `ExecutionController`.
   - Add control-server endpoint and UI inspector controls.
   - Verify precedence: phase override > node override > purpose routing.

6. **Human gate controls**
   - Add pending gate state and accept endpoint only after automatic loops are stable.
   - Keep retry optional unless product requirements demand it.

7. **ReactFlow polish**
   - Add node card indicators and inspector timeline.
   - Ensure internal loop history does not alter top-level graph layout or connect/delete semantics.

## Anti-Patterns to Avoid

### Expanding Loop Phases into Top-Level Graph Nodes

**Why bad:** It makes internal quality mechanics look like user-authored workflow structure. Existing add/delete/connect and approval semantics would need special cases.

**Instead:** Keep one top-level node and put inspectable loop history under `node.qualityLoop`.

### Hidden Loop Budgets

**Why bad:** The project has a no-silent-failures priority. Hidden model calls would make budget exhaustion and model routing hard to explain.

**Instead:** Count every loop phase in `modelCallsUsed`, trace, model selections, and node metadata.

### One Global Model Override for All Loop Phases

**Why bad:** Critique/gate often need stronger reasoning than drafting. Forcing one override wastes resources or weakens evaluation.

**Instead:** Add phase-specific overrides with clear precedence.

### Free-Form Gate Parsing

**Why bad:** Stop reasons and best-of-progress selection become unreliable.

**Instead:** Require structured gate output and fail visibly on invalid gate responses.

## Test Focus

| Test Area | Required Assertions |
|---|---|
| Runtime loop pass | Node has `qualityLoop.status=passed`, `stopReason=pass_threshold`, final answer is selected candidate |
| Max iterations | Stops with `max_iterations` and chooses best-of-progress |
| No improvement | Stops with `no_meaningful_improvement` after refine delta below threshold |
| Phase model override | Critique/gate use phase override while draft/refine use node/default routing |
| Budget exhaustion | Loop cannot exceed `maxModelCalls`; failure is visible in metadata/errors |
| SSE/session | `/api/session` exposes loop timeline and events refresh UI |
| UI controls | Phase override endpoint updates selected node and preserves existing node-wide override |

## Roadmap Implications

Recommended phase structure:

1. **Loop Contracts and Rubrics** - Define types, config, rubric selection, and gate parsing.
2. **Automatic Loop Runtime** - Execute bounded draft/critique/refine/gate/best-of-progress with trace and stop reasons.
3. **Model Routing and Overrides** - Add phase purpose routing and UI/API controls.
4. **Inspectable UI History** - Render compact node status and detailed loop timeline.
5. **Human Gate Hardening** - Add explicit accept gate and retry policy if needed.

This order avoids UI work depending on unstable metadata and avoids human gate complexity before the automatic loop behavior is reliable.

## Sources

- Repository code: `src/domain/recursive-language-model.ts`
- Repository code: `src/domain/types.ts`
- Repository code: `src/application/execution-controller.ts`
- Repository code: `src/application/model-provider.ts`
- Repository code: `src/application/project-config.ts`
- Repository code: `src/application/control-server.ts`
- Repository code: `ui/src/main.tsx`
- Project context: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`
