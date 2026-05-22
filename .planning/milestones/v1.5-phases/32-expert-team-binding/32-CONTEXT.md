# Phase 32: Expert Team Binding - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 32 binds expert presets to planned graph nodes. Planner output assigns expert metadata, users can override expert/runtime/tool/tier choices before run, overrides protect nodes from parent replan, and runtime binding exposes effective expert metadata without duplicating tool adapters.

</domain>

<decisions>
## Implementation Decisions

### Expert Assignment Contract
- Planner assigns `agentId`, `assignmentMode`, `runtime`, and optional tier/tool hints per node.
- Initial expert presets reuse existing agents: `default`, `coding`, `qa`, `product_designer`, and `research`.
- Invalid planner assignments reject planner output with `invalid_planner_output`; no fallback.
- Planner may set `runtime: rlm`; otherwise nodes default to single-pass/model runtime.

### Override And Protection Semantics
- Users can override expert preset, tool allowlist, purpose-to-tier map, and runtime mode before run.
- Effective expert fields are stored on the node with `assignmentMode: "planner" | "custom"`.
- Any user expert/tool/tier/runtime override marks the node protected for replan.
- UI shows a `custom` badge plus inspector controls for expert, tools, tiers, and runtime.

### Execution Binding And Enforcement
- Expert binding happens at execution bind time per node, resolving current node fields.
- Tool allowlists filter shared registered tools by node allowlist; no duplicate adapters per expert.
- Purpose-to-tier maps are honored by building per-node purpose routing before model calls.
- Trace/UI metadata shows effective agent id, assignment mode, runtime mode, tool allowlist, and purpose tiers.

### the agent's Discretion
The implementation may stage deep runtime routing if the current execution architecture needs an intermediate metadata surface, but the node schema, protection behavior, UI controls, and no-fallback planner validation must be implemented in this phase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/application/graph-planner.ts` validates planner JSON and maps invalid output to `GraphPlannerError`.
- `ExecutionGraphNode.composer` carries planning metadata, protection reasons, runtime, and planner lineage.
- `InteractiveExecutionSession` already marks prompt/model/manual changes as protected.
- `ui/src/main.tsx` has node card metadata, inspector controls, and planning gate surfaces.

### Established Patterns
- Graph mutations live on `InteractiveExecutionSession` and throw `MutationError`.
- API routes pass through to session methods in `control-server.ts`.
- CLI and tests use deterministic model mocks.

### Integration Points
- `src/application/graph-planner.ts`: extend planned child schema with optional expert assignment fields.
- `src/domain/types.ts`: add expert assignment fields to node/composer metadata.
- `src/application/execution-controller.ts`: register expert fields, setters, and protection reasons.
- `src/application/control-server.ts`: expose expert override route.
- `ui/src/main.tsx`: display and edit expert fields.

</code_context>

<specifics>
## Specific Ideas

Initial expert ids should match existing agent config ids exactly: `default`, `coding`, `qa`, `product_designer`, `research`.

</specifics>

<deferred>
## Deferred Ideas

Full graph executor traversal is Phase 33. Phase 32 should prepare binding metadata and enforcement surfaces that Phase 33 can consume.

</deferred>
