# Phase 34: Graph Workflow Export/Import - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations accepted)

<domain>
## Phase Boundary

Phase 34 freezes approved execution graphs as lossless `kind: graph` workflow sidecars with Playbook, Pipeline, or Both variants. Users save from the UI, import for edit/re-export, and run frozen graphs through the shared graph executor without replan. CLI and UI share variant selection, run-start validation, and explicit failure vocabulary.

</domain>

<decisions>
## Implementation Decisions

### Sidecar Format And Storage
- Store sidecars under `.rlm/workflows/<id>.yaml` with optional `workflows.<id>.kind: graph` + `path` pointer in `rlm.config.yaml`.
- Single file with `variants.playbook.graph` and `variants.pipeline.graph` sections (shared `graphId`, `schemaVersion`, `updatedAt`).
- Include per-node expert fields from Phase 32: `agentId`, `assignmentMode`, tool allowlist snapshot, purpose tier snapshot, `runtime`, model overrides, protection flags, composer metadata, positions best-effort.
- Do not convert to legacy agent-list `workflows.*` entries — graph kind is a parallel workflow type.

### Playbook vs Pipeline Variants
- **Playbook:** literal node prompts as stored at export time; replay without substitution.
- **Pipeline:** root prompt uses `{{input}}` template; child prompts remain literal role instructions unless already templated.
- **Both:** write both variant graphs under the same workflow id in one sidecar file.
- Save dialog default: **Both** when graph has a clear root task suitable for templating; otherwise Playbook.

### Export And Import UX
- UI save dialog: workflow name, optional description, Save as Playbook / Pipeline / Both.
- Export source: current session graph snapshot (approved or planned nodes with stable ids).
- Import loads sidecar into `InteractiveExecutionSession` for editing; re-export preserves round-trip fidelity.
- Version metadata (`schemaVersion`, `updatedAt`) on sidecar for future diff (minimal v1).

### Frozen Graph Execution
- New `runGraphWorkflow` path (or `runWorkflow` branch when `kind: graph`) uses existing `GraphExecutor` — no replan unless user edits graph in session.
- Pipeline runs apply `applyPipelineTemplate(graph, { input })` replacing root `{{input}}` only before execution.
- Validate missing agents, models, template variables, and invalid sidecar schema at run start with explicit errors (EXPORT-07).

### Variant Selection At Run
- Smart default: Pipeline when user provides new task input (CLI arg, UI run input); Playbook when replaying without input.
- Explicit override: `--variant playbook|pipeline` on CLI; UI toggle or run dialog choice.
- Surface selected variant in run status/metadata at start — no silent mode switch.

### Claude's Discretion
Exact module names (`graph-workflow-serializer.ts`, `graph-workflow-store.ts`, `graph-workflow-runner.ts`), Zod schema placement, and control-server route naming are at implementer discretion — follow research ARCHITECTURE.md layout. Per-node template flags beyond root deferred.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `executeGraph` in `src/application/graph-executor.ts` — frozen topology walk with expert binding (Phase 33).
- `InteractiveExecutionSession` in `execution-controller.ts` — graph state, expert fields, approval, events.
- `graph-planner.ts` — planner validation patterns for graph node schema.
- `workflow-runner.ts` — agent-list workflow dispatch; extend with `kind: graph` branch.
- `project-config.ts` — YAML parse/stringify, `WorkflowConfig`; extend union for graph kind.
- `yaml` + `zod` already in stack for config validation.

### Established Patterns
- Sidecar files under `.rlm/` (sessions, run state) — mirror for workflows.
- Control server routes delegate to session/application modules.
- CLI entry in `src/index.ts` and `src/cli/args.ts` for workflow flags.
- Tests in `tests/` with deterministic mocks.

### Integration Points
- `src/application/graph-workflow-serializer.ts` — export/import round-trip.
- `src/application/graph-workflow-store.ts` — resolve paths, read/write sidecars.
- `src/application/graph-workflow-runner.ts` — variant resolution + `executeGraph`.
- `src/application/workflow-runner.ts` — delegate when `kind: graph`.
- `src/application/project-config.ts` — `GraphWorkflowConfig` schema.
- `src/application/control-server.ts` — export/import API routes.
- `ui/src/main.tsx` — save dialog, import action, variant display at run.
- `src/cli/args.ts` / `src/index.ts` — `--variant`, workflow run with graph kind.
- `tests/graph-workflow-*.test.ts` — serializer round-trip, variant template, run validation.

</code_context>

<specifics>
## Specific Ideas

Follow `.planning/notes/graph-workflow-export.md` and `.planning/research/ARCHITECTURE.md` for sidecar shape and integration order. Phase 33 deferred frozen replay here — reuse `GraphExecutor` rather than root-only delegation.

</specifics>

<deferred>
## Deferred Ideas

- Per-node literal vs template flags beyond root pipeline substitution.
- CI discovery of `.rlm/workflows/*.yaml`.
- CLI graph run full parity polish — Phase 35.
- Scheduling, webhooks, credentials (n8n parity).

</deferred>
