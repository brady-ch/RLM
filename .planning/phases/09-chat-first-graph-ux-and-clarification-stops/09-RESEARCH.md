# Phase 9: Chat-First Graph UX and Clarification Stops - Research

**Date:** 2026-05-11
**Phase:** 9
**Status:** Ready for planning

## Summary

Phase 9 should be planned as two MVP vertical slices:
- Wave 1 introduces chat-first pre-run graph authoring with explicit readiness gating, inline mutation preview, and disambiguation flow.
- Wave 2 introduces runtime clarification hard-stop semantics, answer-or-abort control flow, and dual-surface (UI + CLI json-stream) clarification history records.

This split preserves current execution infrastructure while isolating user-facing authoring logic from in-run pause/resume semantics.

## Existing System Findings

- `ui/src/main.tsx` already hosts graph/session rendering and is the primary integration point for chat UX, draft/ready states, and inline mutation preview cards.
- `src/application/control-server.ts` is the runtime/control transport seam for chat-intent and clarification prompt events.
- `src/application/execution-controller.ts` already enforces checkpoint authority and is the correct place to add clarification hard-stop state transitions.
- `src/application/runtime-events.ts` already has event identity/fingerprint helpers and should emit clarification question/answer/resume records.
- `src/domain/types.ts` is the contract layer for cross-surface record shape consistency (UI + CLI json-stream).

## Decision Constraints From Context

Must preserve decisions from `09-CONTEXT.md` and `09-UI-SPEC.md`:
- Explicit confirm action is required before run (`D-09-01`).
- Draft mode run control is disabled with reason text (`D-09-02`).
- Ambiguous edit requests must clarify before mutation (`D-09-03`).
- Label/name targeting with disambiguation is mandatory (`D-09-04`).
- Dependency-impacting delete requires explicit subtree-delete vs rewire choice (`D-09-05`).
- Mutation preview is inline in chat (`D-09-06`).
- Clarification prompts are hard blocking with no skip (`D-09-07`, `D-09-08`).
- Abort persists full snapshot + pending question (`D-09-09`).
- Clarification history must be shown in both UI and CLI json-stream with required fields (`D-09-10`, `D-09-11`).

## Risks and Mitigations

1. Risk: Chat-driven mutation path bypasses existing validation rules.
- Mitigation: route every applied mutation through controller-authoritative mutation handlers already used by checkpoint edits.

2. Risk: “No skip” clarification policy is weakened by implicit defaults.
- Mitigation: enforce two explicit actions only (`answer`, `abort`) in controller state machine and reject all other transitions.

3. Risk: UI and CLI histories diverge.
- Mitigation: use a single clarification record schema in shared types and emit from one runtime event source.

4. Risk: Delete/rewire UX causes graph integrity regressions.
- Mitigation: require dependency analysis before delete and apply structured user choice to validated graph rewrite paths only.

## Recommended Plan Shape

- Plan 09-01 (Wave 1): chat session + graph mutation authoring contract.
- Plan 09-02 (Wave 2): runtime clarification hard-stops + history persistence/visibility.

## Verification Priorities

- Build and test suite pass.
- Focused tests for draft readiness gate, disambiguation-before-mutation, dependency delete choice enforcement.
- Focused tests for clarification hard-stop transitions (`ask -> answer -> resume`, `ask -> abort`).
- CLI `--json-stream` and UI run history contain required clarification fields.

## Completion Marker

## RESEARCH COMPLETE
