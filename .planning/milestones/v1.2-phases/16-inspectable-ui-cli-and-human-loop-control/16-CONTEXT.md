---
phase: 16
name: inspectable-ui-cli-and-human-loop-control
status: discussed
created_at: 2026-05-18
autonomous: true
requirements:
  - UXQL-01
  - UXQL-02
  - UXQL-03
  - UXQL-04
---

# Phase 16 Context

## Goal

Users can inspect loop quality state and manually accept or stop paused loops without confusing human control with automatic quality gates.

## Smart Discuss Decisions

### 1. Collapsed graph node summary

Decision: show a compact operational summary on quality-loop node cards: status, score, iterations, stop reason, selected candidate, and degraded/failed indicator.

Rationale: this satisfies collapsed-graph observability without turning the graph into a dense timeline.

### 2. Inspector timeline

Decision: add an expandable per-iteration timeline in the inspector with phase rows for draft, critique, refine, gate, and best-of-progress, including critique resolution, rubric/gate details, model trail, and selection rationale.

Rationale: the inspector is the right place for full auditability.

### 3. CLI output depth

Decision: keep compact CLI concise, but include explicit rubric id, score, iterations, stop reason, selected candidate, model summary, and degraded/failure issue count. Leave full per-iteration detail in JSON.

Rationale: terminal output remains scannable while JSON retains complete metadata.

### 4. Manual accept/stop controls

Decision: add explicit loop-scoped controls in the UI inspector and control API, separate from node approval and automatic gate decisions. Manual actions should use stop reasons `human_accepted` or `stopped` and persist as user control events.

Rationale: human loop control must not be conflated with graph node approval or automatic quality gates.

## Existing Code Facts

- UI code lives primarily in `ui/src/main.tsx`, with `ExecutionNodeCard` and `NodeInspector` already separated.
- UI node type currently omits `quality-loop` from `ExecutionNode.kind` and does not type `node.loop`.
- Control API is in `src/application/control-server.ts`.
- Interactive session state and cancellation live in `src/application/execution-controller.ts`.
- Quality-loop runtime already writes `node.loop` and top-level `metadata.qualityLoop`.
- Quality-loop runtime checks `execution.isCancelled()` but does not yet check loop-scoped manual accept/stop decisions.

## Must-Haves

- Quality-loop nodes render a compact loop summary in the graph.
- Inspector renders loop summary, rubric/gate details, selected candidate, model trail, issue list, and expandable iteration timeline.
- Compact CLI includes score and issue count in addition to existing loop lines.
- Control API exposes loop accept/stop endpoints separate from approval endpoints.
- Runtime honors manual loop accept/stop decisions with `human_accepted` or `stopped` stop reasons.
