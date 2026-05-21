---
phase: 16
status: complete
created_at: 2026-05-18
---

# Phase 16 Research

## Relevant Patterns

- `ui/src/main.tsx`
  - `ExecutionNodeCard` renders graph cards.
  - `NodeInspector` renders editable node details, model trail, approval controls, and graph mutations.
  - Existing UI actions call `post()` through `runAction()` and refresh the snapshot.
- `ui/src/styles.css`
  - Cards use restrained dense styling and fixed widths.
  - Inspector panels use `meta-row`, `composer-panel`, and compact grid/list patterns.
- `src/application/control-server.ts`
  - Adds API routes directly in `handleRequest()`.
  - Mutation failures are converted to HTTP status codes through existing catch handling.
- `src/application/execution-controller.ts`
  - `InteractiveExecutionSession.control` supplies runtime hooks to `RecursiveLanguageModel`.
  - `stop()` already cancels running executions and publishes a cancellation event.
  - Session snapshot already exposes graph nodes and loop metadata through `node.loop`.
- `src/domain/recursive-language-model.ts`
  - `runQualityLoop()` has one loop body and a `finish()` helper.
  - `finish()` already supports `human_accepted` and `stopped` stop reasons at the type level.

## Implementation Guidance

- Add an optional loop control hook to `ExecutionControl`, returning a loop decision for a node id.
- Store loop manual decisions in `InteractiveExecutionSession` keyed by node id.
- `acceptQualityLoop(nodeId)` should set a pending accept decision and annotate node loop metadata if present; runtime should finish with `human_accepted` once a candidate exists.
- `stopQualityLoop(nodeId)` should set a stop decision, cancel execution if needed, and annotate loop metadata with `stopped`.
- Runtime should check loop control decisions at safe boundaries: start of iteration, after each phase, and before gate continuation.
- UI controls should only appear for `quality-loop` nodes and remain separate from approve/skip buttons.
- Use native `<details>` for expandable iteration timeline to keep interaction simple and accessible.

## Risks

- Manual accept before any candidate exists cannot return a useful answer. Runtime should wait until a selected candidate exists before honoring accept; stop can happen immediately.
- The current run loop is fast under fake models, so manual-control tests should exercise session methods/API state rather than require race-prone UI timing.
- Keep card text compact and avoid increasing node dimensions too much.
