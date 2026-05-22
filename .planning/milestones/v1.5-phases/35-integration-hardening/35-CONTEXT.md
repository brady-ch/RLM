# Phase 35: Integration Hardening - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations accepted)

<domain>
## Phase Boundary

Phase 35 hardens v1.5 flows across UI, CLI, and session memory: CLI parity for plan-from-node, protected replan, graph workflow export/import/run; graph node submit as default authoring; session save/reopen preserving plan lineage, expert fields, and graph workflow metadata; integration tests with aligned error vocabulary.

</domain>

<decisions>
## Implementation Decisions

### CLI Surface Parity (SURF-01)
- Extend CLI with graph workflow subcommands or flags: export sidecar from session snapshot, import sidecar, run frozen graph workflow with `--workflow` + `--variant`.
- `plan-node` command already exists — ensure error messages match UI `MutationError` vocabulary for replan protection gate (`replan_requires_choice`).
- Auto-register or resolve graph workflows from `.rlm/workflows/` when `--workflow <id>` used without explicit config entry (closes Phase 34 gap).
- Frozen run uses same `runGraphWorkflow` path as UI confirm-run.

### Graph-Primary UX (SURF-02)
- Node card submit remains primary CTA for planning; global chat panel labeled secondary refinement.
- Demote chat prominence in inspector (move below graph workflow section or collapse by default when graph has planned nodes).
- Empty-state copy directs users to root-composer submit, not chat.

### Session Memory (SURF-03)
- Extend saved session payload with v1.5 metadata section: plan lineage fields on nodes, expert assignment fields, linked graph workflow id/variant if imported or exported.
- Restore path must rehydrate expert fields and workflow metadata without silent loss.
- Backward compatible: older sessions without metadata section restore with degraded status note, not silent drop.

### Integration Tests
- Add `tests/integration-v15.test.ts` (or extend existing) covering: plan→approve→run mock path, export sidecar→CLI run, protected replan error vocabulary alignment.
- Use deterministic mocks; no live Ollama required.

### Claude's Discretion
Exact CLI command shape (`workflow export` vs flags), metadata section schema version, and chat panel collapse behavior at implementer discretion — prefer minimal additive changes.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `plan-node` CLI in `src/index.ts` + `execution-controller.planNode`
- Graph workflow modules from Phase 34
- `buildSavedSessionPayload` / session restore in `session-memory-bridge.ts`
- UI graph submit on node cards in `ui/src/main.tsx`

### Integration Points
- `src/cli/args.ts`, `src/index.ts` — new workflow export/import commands
- `src/application/graph-workflow-store.ts` — auto-resolve sidecars for CLI run
- `src/application/session-memory-bridge.ts` — v1.5 metadata section
- `src/adapters/file-session-store.ts` — verify restored sections
- `ui/src/main.tsx` — chat demotion layout
- `tests/integration-v15.test.ts` — new integration coverage

</code_context>

<specifics>
## Specific Ideas

Close Phase 34 follow-up: CLI `--workflow` should run graph sidecars from disk without manual config registration when `.rlm/workflows/<id>.yaml` exists.

</specifics>

<deferred>
## Deferred Ideas

- CI discovery of workflow sidecars
- Full removal of chat-first authoring
- Windows/macOS release smoke

</deferred>
