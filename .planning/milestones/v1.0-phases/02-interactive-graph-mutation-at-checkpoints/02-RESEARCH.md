# Phase 2 Research: Interactive Graph Mutation at Checkpoints

## Scope
- Phase: 2
- Requirements: `APRV-02`, `APRV-03`, `APRV-04`, `ERRO-02`
- Goal: safe in-memory graph mutation at paused checkpoints with explicit validation failures.

## Existing Surfaces
- Core mutation authority point already exists in `src/application/execution-controller.ts`.
- API transport is `src/application/control-server.ts`.
- UI mutation affordance exists in `ui/src/main.tsx` inspector pattern.
- Recursive engine uses execution graph + approval checkpoints in `src/domain/recursive-language-model.ts`.

## Gaps for Phase 2
1. No first-class controller methods for add/delete/connect operations.
2. No formal mutation validation model (parent existence/depth constraints/error codes).
3. No subtree re-evaluation contract after mutation before resume.
4. No structured mutation error schema currently shared across API/UI.

## Research Conclusions
- Keep mutation authority fully in controller (consistent with Phase 1 invariants).
- Introduce typed mutation request + structured error object with `code/message/nodeIds/details/suggestedFix`.
- Implement cascade delete and parent/depth validation in controller.
- Allow cycles per locked decision; avoid cycle-rejection logic in this phase.
- For checkpoint resume, maintain current paused boundary but force recalculation of affected descendants before execution continuation.

## Execution Strategy
- Wave 1: backend mutation primitives + validation + tests.
- Wave 2: control-server endpoints + UI mutation actions + error handling + tests.

## Risks
- Mutation APIs can desync node/edge indexes if not centralized.
- Re-evaluation semantics can become ambiguous without clear affected-subtree boundaries.
- UI optimism can hide backend rejection unless all mutation actions use explicit response handling.

## Mitigations
- Controller-only write path.
- Deterministic mutation result payloads.
- Regression tests for delete cascade, invalid parent/depth, and resume behavior after mutation.
