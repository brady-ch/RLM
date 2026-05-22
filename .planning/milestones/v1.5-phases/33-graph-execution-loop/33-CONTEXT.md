# Phase 33: Graph Execution Loop - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations accepted)

<domain>
## Phase Boundary

Phase 33 implements a shared graph executor that walks approved planned topology (not root-only `selectAgent` delegation). Each node binds its expert profile, tool allowlist, and purpose-to-tier map at execution time; single-pass and RLM runtime modes run with visible metadata and no silent escalation; the UI shows per-node execution progress during interactive runs.

</domain>

<decisions>
## Implementation Decisions

### Graph Traversal Model
- Introduce a shared `GraphExecutor` in `src/application/` that walks the session graph in topological order (parents before children).
- Execution starts from approved root nodes and follows planned edges; no root-only `selectAgent` shortcut for graph runs.
- Existing approval gates and pause/resume semantics remain — executor respects node approval state before running a node.
- Missing or invalid expert agent ids fail explicitly at bind time with actionable errors (no fallback agent).

### Node Execution Binding
- At each node, resolve expert profile from `expertAgentId` via agent registry; honor `expertToolAllowlist`, `expertPurposeTiers`, and model overrides already on the node.
- Tool filtering and purpose routing reuse Phase 32 binding patterns in `recursive-language-model.ts` and `model-provider.ts`.
- Execution trace and node metadata expose effective agent id, assignment mode, runtime mode, tool allowlist, and purpose tiers.
- Child node prompts inherit ancestor context per existing plan-budget semantics.

### Runtime Mode Execution
- `single-pass`: one model completion path without RLM recursion for that node.
- `rlm`: full `RecursiveLanguageModel` run with node plan budget and constrained tools.
- Use exact `node.expertRuntime` — no silent escalation to RLM when single-pass is set.
- Unsupported or missing runtime mode surfaces explicit error states in UI and CLI.

### Progress Visibility
- Executor updates per-node status (`running`, `completed`, `failed`) as it walks the graph; reuse existing session event/subscriber model.
- UI reflects live node status on the canvas and in the inspector during runs (no new polling channel if session events suffice).
- Active node shows effective runtime mode and expert id in node card metadata.
- Failed nodes block dependent descendants with visible failure reason.

### Claude's Discretion
Executor module placement, exact topological sort edge cases (parallel siblings), and whether to batch sibling execution vs sequential are at implementer discretion — prefer sequential v1 for predictability and simpler status updates.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `InteractiveExecutionSession` in `execution-controller.ts` — graph state, approval, expert field registration, status events.
- `createUiExecutionRunner` in `ui-execution-runner.ts` — currently root-only via `selectAgent`; replace/wrap with graph executor entry.
- `RecursiveLanguageModel` — already propagates expert metadata on task nodes (Phase 32).
- `runConfiguredAgent` in `agent-runner.ts` — agent run lifecycle with purpose routing and memory.
- `agent-registry.ts` — expert preset resolution by id.

### Established Patterns
- Graph mutations and run lifecycle on `InteractiveExecutionSession`.
- Control server routes delegate to session methods.
- Execution events via session subscribers for UI refresh.
- Tests use deterministic model mocks in `tests/`.

### Integration Points
- New `src/application/graph-executor.ts` (or equivalent) called from UI runner and eventually CLI.
- `ui-execution-runner.ts` — switch from root-only delegation to graph executor.
- `execution-controller.ts` — expose run lifecycle hooks if executor needs session coordination.
- `ui/src/main.tsx` — per-node status and runtime/expert badges during execution.
- `tests/graph-executor.test.ts` — topology walk, bind-time failures, runtime modes.

</code_context>

<specifics>
## Specific Ideas

Phase 32 deferred full graph traversal to this phase — consume expert binding metadata already on nodes without schema changes unless gaps are found.

</specifics>

<deferred>
## Deferred Ideas

- Frozen graph workflow replay without replan — Phase 34.
- CLI graph run parity — Phase 35.
- Parallel sibling node execution — future optimization.

</deferred>
