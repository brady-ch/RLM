---
phase: 17
status: complete
created_at: 2026-05-19
---

# Phase 17 Research

## Relevant Patterns

- `tests/recursive-language-model.test.ts` is the main integration-style test harness.
  - It uses `QueueModel`, `ThrowingModel`, `InMemoryTrace`, `createInteractiveExecutionSession`, `startControlServer`, and `FileRunStateStore`.
  - Quality-loop tests are already grouped near the top of the file.
- `renderResult()` tests validate compact and JSON CLI output without invoking a subprocess.
- `FileRunStateStore` records accepted `nodeStatuses.*` mutations and exposes operational replay.
- UI source assertions are already used for approval labels and Phase 16 loop controls.

## Implementation Guidance

- Keep tests in the existing Node test runner.
- Add a small `assertQualityLoopTerminal()` helper rather than a separate fixture framework.
- Invalidate stale loop metadata by clearing `node.loop` in prompt/model edit mutations and publishing explicit messages.
- Add tests that check:
  - loop metadata exists on graph node and lifecycle events include started/phase completed/stopped messages;
  - compact and JSON render outputs expose terminal loop details;
  - run-state replay includes accepted running/completed status records for a quality-loop node;
  - prompt/model edits clear stale loop metadata;
  - parse failure, budget exhaustion, manual stop, cancellation, and selected-model routing failures include diagnosable text.

## Risks

- Avoid brittle golden snapshots; assert specific semantic fields and key output lines.
- Avoid browser E2E. UI source assertions plus API/session tests fit the current harness style.
- Run-state coverage should not overclaim full metadata persistence; Phase 17 needs proof that terminal state is visible in run-state records.
