---
phase: 17
name: quality-verification-and-regression-harness
status: discussed
created_at: 2026-05-19
autonomous: true
requirements:
  - VERF-01
  - VERF-02
  - VERF-03
---

# Phase 17 Context

## Goal

Users and maintainers can verify that quality loops remain bounded, observable, and non-silent across supported execution surfaces.

## Smart Discuss Decisions

### 1. Verification harness scope

Decision: add a targeted regression matrix over existing fake-model/unit tests plus a small fixture helper for loop scenarios. Cover boundedness, stop reasons, parser failures, model routing failures, CLI output, UI/API state, and run-state records without adding a new test framework.

### 2. UI/API stale-loop invalidation

Decision: prompt/model edits on a quality-loop node invalidate prior loop metadata in session graph mutation tests. Add API/UI source assertions for the invalidation path.

### 3. Run-state and trace observability

Decision: assert that lifecycle events, phase completion events, graph `node.loop` metadata, compact CLI output, JSON output, and run-state persistence expose non-silent terminal state for success, degraded, stopped, and failed cases.

### 4. Failure strictness

Decision: every parse failure, budget exhaustion, cancellation/manual stop, and selected-model routing failure must assert explicit status, stop reason, error or issue text, and no silent fallback.

## Existing Code Facts

- Quality-loop tests already cover most runtime stop reasons and parser/routing failures.
- UI/API tests already cover loop control API and UI source hooks from Phase 16.
- Run-state persistence currently records node status transitions, not full loop metadata.
- `InteractiveExecutionSession.editNodePrompt()` and `setNodeModelOverride()` currently mutate prompt/model state without invalidating existing `node.loop` metadata.

## Must-Haves

- Add focused helper coverage that makes loop scenario assertions easier to keep consistent.
- Add stale-loop invalidation behavior and tests.
- Add observability tests for trace/events, graph metadata, compact/JSON render output, and run-state mutation records.
- Strengthen strict failure assertions where current tests only check terminal status.
