# Phase 9: Chat-First Graph UX and Clarification Stops - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver conversational graph authoring before execution and explicit human-clarification hard stops during execution, with visible question/answer history and no silent continuation.

</domain>

<decisions>
## Implementation Decisions

### Chat session shape
- **D-09-01:** A chat-authored graph becomes ready-to-run only via an explicit confirm button/action.
- **D-09-02:** While graph is draft, Run is disabled and must show reason text explaining what is missing.

### Message-to-graph edits
- **D-09-03:** If a follow-up message is ambiguous, ask a clarifying question before any graph mutation.
- **D-09-04:** Explicit edit targeting uses node label/name, with disambiguation prompt when multiple matches exist.
- **D-09-05:** For delete requests that impact downstream dependencies, block direct delete and require user choice: delete subtree or rewire dependents.
- **D-09-06:** Proposed graph mutations are previewed inline in chat before apply.

### Clarification prompt policy
- **D-09-07:** Runtime clarification uses hard blocking pause semantics.
- **D-09-08:** Skip/dismiss is not allowed at clarification checkpoints; only answer-and-continue or abort.
- **D-09-09:** On abort at clarification stop, persist full checkpoint snapshot plus pending question.

### Clarification history surface
- **D-09-10:** Clarification question/answer history must be visible in both CLI `--json-stream` output and UI run history.
- **D-09-11:** Minimum clarification record fields: `question_id`, `node_id`, `prompt_text`, `user_answer`, `asked_at`, `answered_at`, `resume_event_id`.

### the agent's Discretion
- Exact UI copy and component styling for draft-reason text and clarification prompt framing.
- Exact event code names and internal enums, as long as required fields and visibility guarantees are preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and requirement locks
- `.planning/ROADMAP.md` — Phase 9 goal, dependencies, and success criteria.
- `.planning/REQUIREMENTS.md` — `CHAT-01` and `QUES-01` requirement definitions.
- `.planning/PROJECT.md` — v1.1 milestone scope and explicit no-silent-failure stance.

### Prior phase decisions that constrain behavior
- `.planning/phases/07-mcp-and-skills-interoperability/07-CONTEXT.md` — pause/recovery and auditable event expectations.
- `.planning/phases/08-model-host-extensibility-and-constrained-tool-calling/08-CONTEXT.md` — explicit pause on runtime uncertainty and no silent fallback norms.
- `.planning/phases/08.5-typed-artifact-stateful-workflow-runtime/08.5-CONTEXT.md` — checkpoint/state persistence and auditability patterns for run continuity.

### Existing architecture and integration surfaces
- `AGENTS.md` — architecture boundaries and extension points.
- `src/application/control-server.ts` — control-plane events and UI/runtime bridge.
- `src/application/execution-controller.ts` — checkpoint lifecycle and mutation authority.
- `src/application/runtime-events.ts` — event identity/fingerprint and runtime event shaping.
- `src/domain/types.ts` — shared execution, node, and event contract types.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/application/execution-controller.ts`: existing checkpoint pause/resume and graph mutation controls can anchor chat-driven pending-edit workflows.
- `src/application/control-server.ts`: current runtime/control API path can host chat session and clarification prompt transport.
- `src/application/runtime-events.ts`: event id/fingerprint helpers can back clarification history records and resume linkage.
- `ui/src/main.tsx`: existing graph/status UI integration point for chat-first editing and run-history display.

### Established Patterns
- Controller-authoritative mutation flow with explicit validation errors (no hidden fallback paths).
- Structured runtime events with explicit severity/code identity and replay-safe metadata.
- Ports/adapters layering; behavior should remain composed through application/domain boundaries.

### Integration Points
- Add chat session state and message-to-graph mutation intent handling before execution start.
- Add runtime clarification prompt state machine in execution path (hard pause, answer-or-abort only).
- Persist clarification records into run history payloads consumed by both CLI json-stream and UI timeline surfaces.

</code_context>

<specifics>
## Specific Ideas

- Inline chat diff preview is the default review surface for pending graph mutations.
- Disambiguation prompts are mandatory for label collisions before edit/delete actions.
- Clarification records should directly tie to resume event ids to make pause→answer→resume traceable.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 9-Chat-First Graph UX and Clarification Stops*
*Context gathered: 2026-05-11*
