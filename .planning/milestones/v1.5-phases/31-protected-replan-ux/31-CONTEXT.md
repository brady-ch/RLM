# Phase 31: Protected Replan UX - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 31 adds a protected replan gate for parent replans when user-protected descendants would be affected. It must provide Replace subtree, Merge, and Cancel semantics across UI and CLI while preserving Phase 30's silent replan behavior for pristine model-planned descendants.

</domain>

<decisions>
## Implementation Decisions

### Protected Descendant Detection
- Protected descendants include manual child adds, manual prompt edits, user model overrides, pins/future expert overrides.
- The gate appears only when a parent replan would affect at least one protected descendant.
- Pristine model-planned nodes continue to replan silently, as Phase 30 already does.
- Protection should use node metadata derived from existing fields plus new `protectedReason[]` where needed.

### Replace / Merge / Cancel Semantics
- Replace subtree deletes all descendants under the replanned parent, then applies fresh planner output.
- Merge preserves protected descendants, removes pristine model-planned descendants, and includes protected child context in the planner prompt.
- Cancel performs no graph mutation, makes no planner call, and returns the current graph unchanged.
- Merge conflicts keep protected nodes as-is and place new planner children after them with stable layout spacing.

### UI / CLI Gate Surface
- UI presents a node-scoped modal or panel with Replace subtree, Merge, Cancel, and a protected-node summary.
- CLI `plan-node` returns a structured `replan_requires_choice` error unless `--replan replace|merge|cancel` is supplied.
- Merge explanation copy: “Merge keeps protected edits and replans only replaceable drafts.”
- Required coverage includes unit tests for protected detection/merge plus API/CLI parity tests for Replace/Merge/Cancel.

### the agent's Discretion
The implementation may choose the exact internal helper boundaries and UI component structure, provided the behavior and error vocabulary remain explicit and consistent across session, API, CLI, and UI.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 30 introduced `src/application/graph-planner.ts` and async `InteractiveExecutionSession.planNode`.
- `ExecutionGraphNode` already tracks `modelOverrideSource`, `composer.plannedBy`, prompt/edit fields, and node status.
- The UI already has card-level `Plan children`, inspector actions, and planning error display.

### Established Patterns
- Session mutations throw `MutationError`; `control-server.ts` maps those to 409 JSON payloads.
- CLI command parsing lives in `src/cli/args.ts`; command execution is centralized in `src/index.ts`.
- Tests use deterministic `LanguageModelPort` mocks in `tests/recursive-language-model.test.ts`.

### Integration Points
- `src/application/execution-controller.ts`: protected detection, replan gate, replace/merge/cancel behavior.
- `src/application/control-server.ts`: pass replan choice from HTTP requests.
- `src/cli/args.ts` and `src/index.ts`: parse/pass `--replan`.
- `ui/src/main.tsx` and `ui/src/styles.css`: node-scoped gate surface and copy.

</code_context>

<specifics>
## Specific Ideas

Use “Merge keeps protected edits and replans only replaceable drafts.” as the user-facing merge explanation.

</specifics>

<deferred>
## Deferred Ideas

Expert override protection is part of the detection contract, but full expert assignment fields are introduced in Phase 32.

</deferred>
