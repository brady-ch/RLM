# Phase 9: Chat-First Graph UX and Clarification Stops - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 9-chat-first-graph-ux-and-clarification-stops
**Areas discussed:** Chat Session Shape, Message-to-Graph Edits, Clarification Prompt Policy, Clarification History Surface

---

## Chat Session Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit confirm button | User must execute a clear run confirmation action before ready state. | ✓ |
| Intent-based auto-ready | Natural-language intent phrase marks graph ready. | |
| Always draft until checkpoint screen | Transitioning to checkpoint UI marks readiness. | |

**User's choice:** Explicit confirm button.
**Notes:** User corrected an accidental earlier selection and locked explicit confirmation as the readiness trigger.

| Option | Description | Selected |
|--------|-------------|----------|
| Ask a one-line confirmation | Ambiguous readiness phrases trigger a yes/no follow-up. | |
| Stay draft silently | Ambiguous phrases do not alter state. | |
| Auto-ready with undo window | Ambiguous readiness marks ready with quick cancellation window. | |

**User's choice:** N/A (superseded by explicit confirm-button readiness model).
**Notes:** Not needed once explicit confirmation action became required.

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled Run button with reason text | While draft, run control is disabled and explains missing conditions. | ✓ |
| Enabled Run button with confirm modal | Run opens modal describing draft issues. | |
| No Run button until ready | Run control hidden until ready. | |

**User's choice:** Disabled Run button with reason text.
**Notes:** Keeps readiness explicit and visible.

---

## Message-to-Graph Edits

| Option | Description | Selected |
|--------|-------------|----------|
| Ask clarifying question before mutating | Ambiguous follow-up message requires clarification before edits. | ✓ |
| Apply best-guess edit and show diff for approval | Mutate first with confirmation. | |
| Queue as suggestion only | No direct mutation without manual apply. | |

**User's choice:** Ask clarifying question before mutating.
**Notes:** Prevents unintended graph changes.

| Option | Description | Selected |
|--------|-------------|----------|
| Target by node ID only | Strict but less natural command style. | |
| Target by node label/name with disambiguation prompt | Natural targeting with ambiguity guard. | ✓ |
| Target by position/order | Position-based targeting with fallback prompt. | |

**User's choice:** Target by node label/name with disambiguation prompt.
**Notes:** Balances conversational UX and safety.

| Option | Description | Selected |
|--------|-------------|----------|
| Block delete and require user choice for rewire | Dependency-impacting delete requires explicit path. | ✓ |
| Cascade delete descendants automatically | Remove downstream nodes with warning. | |
| Soft-delete | Mark inactive until later confirmation. | |

**User's choice:** Block delete; offer choice to delete subtree or rewire dependents.
**Notes:** User explicitly requested both options in prompt flow.

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in chat | Mutation diff preview shown in conversation. | ✓ |
| Side panel only | Details shown outside chat. | |
| Both inline + side panel | Summary in chat plus persistent panel. | |

**User's choice:** Inline in chat.
**Notes:** Keeps conversational flow central.

---

## Clarification Prompt Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Hard pause with blocking prompt | Run cannot advance until explicit action. | ✓ |
| Soft pause with timeout | Auto-continue on timeout policy. | |
| Background pause | Pause while allowing unrelated edits/chat. | |

**User's choice:** Hard pause with blocking prompt.
**Notes:** Maintains explicit human gate behavior.

| Option | Description | Selected |
|--------|-------------|----------|
| No skip | Only answer or abort is allowed. | ✓ |
| Allow skip with reason | Continue with recorded skip reason. | |
| Allow skip silently | Continue without skip metadata. | |

**User's choice:** No skip.
**Notes:** Silent or policy-based continuation rejected.

| Option | Description | Selected |
|--------|-------------|----------|
| Full checkpoint snapshot + pending question | Preserve complete resume context at abort. | ✓ |
| Question text only | Persist only prompt content. | |
| Abort event only | Minimal abort marker. | |

**User's choice:** Full checkpoint snapshot + pending question.
**Notes:** Ensures reliable resume and auditability.

---

## Clarification History Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Both CLI json-stream and UI run history | Unified visibility across interfaces. | ✓ |
| UI only | Visible in UI, omitted from CLI stream. | |
| CLI only | Visible in CLI stream, omitted from UI. | |

**User's choice:** Both CLI json-stream and UI run history.
**Notes:** Cross-surface parity required.

| Option | Description | Selected |
|--------|-------------|----------|
| question_id, node_id, prompt_text, user_answer, asked_at, answered_at, resume_event_id | Minimum clarification record schema. | ✓ |
| prompt_text + user_answer + timestamp only | Minimal record. | |
| Configurable fields by verbosity level | Schema varies by mode. | |

**User's choice:** Full minimum schema (question_id, node_id, prompt_text, user_answer, asked_at, answered_at, resume_event_id).
**Notes:** Field set locked as non-optional minimum.

---

## the agent's Discretion

- UI wording/style for controls and prompts.
- Internal enum/event code naming as long as required behavior and schema are preserved.

## Deferred Ideas

- None.
