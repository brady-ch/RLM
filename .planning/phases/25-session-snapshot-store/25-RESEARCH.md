# Phase 25 Research: Session Snapshot Store

**Date:** 2026-05-21  
**Inputs:** v1.4 milestone research, Phase 25 context, UI-SPEC, existing run-state/session code.

## Existing Patterns

- `FileRunStateStore` already provides local JSON persistence with per-run locks and atomic temp-file writes.
- `InteractiveExecutionSession.snapshot()` already exposes the graph, approval mode, auto-approval pause, run summary, pending mutation, clarification history, and abort snapshot.
- `control-server.ts` already owns the UI HTTP API and should receive new session persistence endpoints.
- The UI already polls `/api/session` and renders the inspector/control surface from `SessionSnapshot`.

## Recommended Implementation

Build a Phase 25 session snapshot layer with:

- `SessionStorePort` for saved-session list/save/load/verify.
- `FileSessionStore` adapter using `.rlm/sessions/<session-id>/manifest.json` plus section files.
- Manifest section versions and per-section verification.
- Placeholder/contract sections for structured memory, preferences, and vector index metadata.
- Control-server APIs for list/save/open/inspect.
- UI inspector controls for save/open and restore status.
- CLI flags for list/save/open/inspect in UI mode.

## Constraints

- Do not overload `MemoryManager`; it is RAM budgeting.
- Do not inline artifact payloads.
- Do not claim mid-model-call resume.
- Do not silently drop missing memory/vector sections.

## Verification Focus

- Unit-test file store save/load/verify, including degraded states.
- API-test list/save/open/inspect.
- UI build must pass after adding controls.
- Existing full test suite must continue passing.
