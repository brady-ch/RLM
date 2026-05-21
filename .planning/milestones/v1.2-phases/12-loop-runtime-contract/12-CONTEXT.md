# Phase 12: Loop Runtime Contract - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 12 delivers the runtime contract for answer-quality refinement loops: a loop runs as one bounded top-level execution graph node with inspectable internal draft, critique, refine, gate, and best-of-progress state, explicit loop bounds, budget behavior, terminal stop reasons, and usage summaries. This phase defines the data and runtime surface that later rubric, refinement, routing, UI, CLI, and regression phases will enrich.

</domain>

<decisions>
## Implementation Decisions

### Runtime Shape and Graph Boundary
- Represent a quality loop as one top-level execution graph node, with internal phases living in loop metadata rather than expanding into top-level graph nodes.
- Store loop history in typed loop metadata on the graph node and final result metadata; use trace/events for lifecycle observability, not as the canonical state store.
- Keep Phase 12 focused on the bounded loop contract, node shape, stop reasons, budget accounting, and placeholder phase records; leave rubric scoring depth and best-of-progress selection algorithms to Phases 13 and 14.
- Require every completed, stopped, degraded, cancelled, or failed loop terminal state to include an explicit stop reason and usage summary. Missing terminal reason is a bug.

### Bounds, Budgets, and Stop Reasons
- Add an explicit loop config object with validated `maxIterations`, defaulting conservatively before a loop starts.
- Track loop-local model-call usage inside the global `maxModelCalls` budget and stop with `budget_exhausted` before starting an iteration that cannot finish the required loop phases.
- On degraded or stopped loops, return the best available candidate plus degraded/stopped metadata and unresolved issues unless no candidate exists.
- Include iteration count, phase call counts, token totals when available, model-call total, and stop reason in typed loop metadata and CLI/JSON metadata.

### Inspectable Internal Loop State
- Record draft, critique, refine, gate, and best-of-progress placeholders per iteration, even if later phases fill richer schemas.
- Store concise candidate summaries plus optional artifact refs for full text so graph metadata remains inspectable without bloating state.
- Represent unresolved issues as structured records with severity, id, text, and source phase so later rubric and UI work can render them directly.
- Emit lifecycle events for loop start, each phase completion, iteration stop/continue decisions, and terminal stop reason, while keeping canonical state in typed metadata.

### Compatibility and Failure Handling
- Preserve current CLI and recursive workflow behavior unless quality loops are explicitly configured or invoked; do not implicitly wrap ordinary prompts in a loop.
- In Phase 12, allow placeholder phase outputs but require typed terminal metadata; later structured parse failures become explicit degraded or failed states in Phase 13.
- Treat human stop and cancellation as terminal loop outcomes with explicit stop reason, partial usage summary, and no silent fallback.
- Add fake-model/domain tests for loop bounds, budget exhaustion, terminal stop reasons, metadata shape, and preservation of non-loop behavior.

### the agent's Discretion
The agent may choose exact TypeScript names, helper boundaries, and internal function layout as long as the public runtime contract is typed, explicit, backward-compatible, and aligned with existing domain/application/UI boundaries.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/domain/recursive-language-model.ts` already owns recursive execution, model-call counting, tool rounds, execution node lifecycle, and metadata updates.
- `src/domain/types.ts` defines `RecursivePromptMetadata`, `ExecutionGraphNode`, `ExecutionEvent`, `ExecutionBudget`, and related run contracts that should be extended rather than bypassed.
- `src/application/execution-controller.ts` owns interactive graph session state, approval/cancellation behavior, graph snapshots, and node mutation controls.
- `ui/src/main.tsx` already renders execution node cards, node inspector metadata, model trail, approval state, and plan budget details.
- Existing tests in `tests/recursive-language-model.test.ts` and related suites use fake/queue models and should be extended for loop runtime behavior.

### Established Patterns
- Domain code keeps typed metadata in `RecursivePromptMetadata` and mirrors execution graph changes through `updateExecutionGraph()`.
- Runtime observability uses explicit execution events, trace records, metadata errors, and non-silent failure codes.
- Model-call budget is enforced centrally with `modelCalls`, `remainingModelCalls()`, `canSpendAnyModelCall()`, and explicit limit records.
- UI graph nodes are typed, inspectable, and editable through controller-authoritative state rather than ad hoc client state.
- Compatibility matters: existing prompt execution, `--plan-only`, approval modes, and non-loop recursive behavior must continue unchanged.

### Integration Points
- Extend shared domain types first, then wire loop runtime behavior through the recursive engine and execution metadata.
- Surface loop node/state through `ExecutionGraphNode` and final `RecursivePromptMetadata` so CLI/JSON/UI consumers share the same contract.
- Hook cancellation and human stop into existing `ExecutionControl` and controller snapshot behavior.
- Add focused fake-model tests before broader UI and CLI polish phases.

</code_context>

<specifics>
## Specific Ideas

Use the accepted stop-reason set as the initial contract: `passed`, `critique_resolved`, `no_meaningful_improvement`, `max_iterations`, `budget_exhausted`, `human_accepted`, `stopped`, `degraded`, `failed`.

</specifics>

<deferred>
## Deferred Ideas

- Full adaptive rubric selection and structured evaluator schemas belong to Phase 13.
- Refine algorithm details and final best-of-progress selection logic belong to Phase 14.
- Phase-specific loop model override UX belongs to Phase 15.
- Rich UI/CLI loop inspection and human loop controls belong to Phase 16.
- Full cross-surface regression harness belongs to Phase 17.

</deferred>
