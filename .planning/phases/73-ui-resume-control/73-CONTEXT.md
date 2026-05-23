# Phase 73: UI Resume Control — Context

**Goal:** Users can resume interrupted runs from the UI with an explicit confirm gate and automated HTTP coverage.

**Requirements:** RESU-01, RESU-02

**Depends on:** Phase 72 (Human UAT sign-off) — execution gate only; planning may proceed.

## Decisions

### D-01: Resume control placement (TopBar)

Wire resume in `ui/src/app/TopBar.tsx` alongside Run/Stop per ui-shell-architecture (thin top bar). Do **not** add resume to RunPanel — RunPanel stays node-scoped (approve/clarify only).

### D-02: Explicit confirm before resume

Reuse `GraphActionModal` in `mode="confirm"` (same pattern as delete-subtree in `NodeContextMenu.tsx`). Resume POST fires only after user confirms in modal — no silent resume, no `window.confirm`.

### D-03: Resume API contract

On confirm, call `POST /api/chat/resume-run` with body `{ confirm: true }` via existing `post()` / `runAction()` helpers in `ui/src/shared/api.ts`. Refresh session snapshot after success (same as confirm-run).

### D-04: Resumable visibility signal

Session snapshot must expose `runState.resumable: boolean` (and optional `runState.activeNodeId`) computed server-side from persisted run state — UI must not guess from status alone. Enrich both `GET /api/session` and SSE initial `snapshot` event.

**Resumable predicate (mirror resume-run acceptance):** session is not actively executing **and** `RunStatePersistence.load_resume_state()` finds a snapshot with a persisted `resumeCursor` for the current memory session id.

### D-05: HTTP integration test location

Add tests in `crates/rlm-core/tests/chat_routes.rs` (extend existing chat route HTTP patterns). Cover: reject without `confirm`, accept with `confirm: true`, executor skips completed nodes (single model call after partial run seed).

## Claude's Discretion

- Exact button label/styling (`Resume run` vs `Resume`) — match TopBar secondary button conventions.
- Whether to hoist `GraphActionModal` state in `TopBar` vs `AppShell` — prefer local state in TopBar if modal is self-contained.
- Optional `ServerConfig.exec_model` override for HTTP test — use if needed for deterministic QueueModel; otherwise construct RouterState in test.

## Deferred Ideas

- Full UI/component test suite (Vitest/Playwright) — explicitly deferred this phase; RESU-02 HTTP test only.
- Resume action in node context menu — post–Phase 73 if needed.
- Clearing run state after successful full completion — out of scope (backend behavior unchanged).

## Upstream

- Phase 64 shipped `POST /api/chat/resume-run` confirm gate and `run_state_resume.rs` executor test — backend ready; zero UI consumer (v1.9 audit tech debt).
- `ui/src/run-panel/RunPanel.tsx` — approve/skip/clarify only; no resume hooks today.
- `ui/src/app/TopBar.tsx` — confirm-run + stop wired; resume slot available.
