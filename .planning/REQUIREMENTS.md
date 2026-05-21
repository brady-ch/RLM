# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-21  
**Milestone:** v1.5 Dynamic Graph Authoring  
**Core Value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## v1.5 Requirements

### Plan-from-Node

- [ ] **PLAN-01**: User opens the UI to a focused empty `root-composer` node and can submit a non-empty prompt without a separate global pre-run chat step.
- [ ] **PLAN-02**: Submitting on any editable node invokes model-driven planning that creates or refreshes direct child nodes from that node's prompt (replacing keyword `plannedChildrenFor` heuristics).
- [ ] **PLAN-03**: Submitting on a child node plans only that node's subtree, inheriting ancestor prompt context and existing plan-budget root semantics.
- [ ] **PLAN-04**: Resubmitting a parent replans descendant planned structure; pristine auto-planned descendants replan without a dialog.
- [ ] **PLAN-05**: When protected descendants exist (manual edits, pins, user model overrides, manual child adds, expert overrides), parent replan offers Replace subtree, Merge, or Cancel before applying changes.
- [ ] **PLAN-06**: Merge preserves protected nodes and regenerates or adjusts only non-protected planned descendants using parent plus pinned-child context.
- [ ] **PLAN-07**: Planning failures, invalid planner output, and plan-budget exhaustion surface explicit UI and CLI states (no silent fallback to heuristics).

### Graph Workflow Export

- [ ] **EXPORT-01**: User can save an approved graph as a lossless `kind: graph` workflow sidecar without converting to legacy agent-list workflows.
- [ ] **EXPORT-02**: Save dialog offers Playbook, Pipeline, or Both variants for the same workflow id.
- [ ] **EXPORT-03**: Playbook variant stores literal node prompts; Pipeline variant stores template prompts with `{{input}}` at least at the root.
- [ ] **EXPORT-04**: User can import a saved graph workflow into the editor and re-export after edits.
- [ ] **EXPORT-05**: Saved graph workflows run through a frozen graph executor without replan unless the user edits the graph.
- [ ] **EXPORT-06**: CLI and UI support explicit `--variant playbook|pipeline` override and display which variant ran at start.
- [ ] **EXPORT-07**: Missing agents, models, template variables, or invalid sidecar schema fail explicitly at run start.

### Expert Team

- [ ] **TEAM-01**: Model-driven planner assigns an expert preset (`agentId`) per graph node at plan time.
- [ ] **TEAM-02**: Node inspector shows expert preset and whether the node is custom (`assignmentMode`).
- [ ] **TEAM-03**: User can override expert preset, tool allowlist, purpose-to-tier map, or single-purpose model before run; overrides are protected for replan.
- [ ] **TEAM-04**: Expert presets use shared tool implementations with per-node allowlists (no duplicate adapters per role in v1.5).
- [ ] **TEAM-05**: Expert presets define purpose-to-tier maps in config and execution honors them via purpose routing.
- [ ] **TEAM-06**: Planner sets `runtime: rlm` on high-complexity nodes at plan time; user can override to single-pass or RLM explicitly.
- [ ] **TEAM-07**: Node execution binds expert tools, tiers, and runtime mode with explicit trace and UI metadata.
- [ ] **TEAM-08**: Graph workflow export includes expert assignment, custom overrides, tool allowlist snapshot, tier map snapshot, and runtime mode.

### Graph Execution

- [ ] **EXEC-01**: Approved graph runs walk planned node topology (not root-only `selectAgent` delegation) via a shared graph executor.
- [ ] **EXEC-02**: Each node resolves its expert profile and constrained tool allowlist at execution bind time.
- [ ] **EXEC-03**: Single-pass and RLM runtime modes execute with visible mode metadata and no silent runtime escalation.

### UI and CLI Surfaces

- [ ] **SURF-01**: CLI supports plan-from-node, replan with protection gate, graph workflow export/import, and frozen graph workflow run with the same semantics as the UI.
- [ ] **SURF-02**: Global chat-first pre-run authoring is demoted; graph node submit is the default authoring path (chat may remain as secondary refinement if kept).
- [ ] **SURF-03**: Session save/reopen preserves plan lineage, expert fields, and graph workflow export metadata introduced in v1.5.

## Future Requirements

### Specialized Tools and Authoring

- **TOOL-01**: Role-specific tool surfaces (narrower schemas per expert) when allowlist-only experts show reproducible small-model failures.
- **AUTH-02**: Per-node literal vs template flags beyond root pipeline substitution.
- **AUTH-03**: Visual expert-preset authoring UI in settings (config-file editing remains sufficient for v1.5).

### Platform

- **PLAT-01**: Multi-runner adapters (llama.cpp, vLLM, cloud APIs) beyond bundled Ollama.
- **PLAT-02**: Release hardening (signed artifacts, Windows/macOS packages, auto-update channel).

## Out of Scope

| Feature | Reason |
|---------|--------|
| LangGraph / deepagents adoption | Unused in codebase; v1.5 extends existing session + ports |
| Lossy export to `workflows.*` agent-list only | Destroys topology and expert metadata; conflicts with EXPORT-01 |
| Silent replan or heuristic planner fallback | Conflicts with PLAN-07 and core no-silent-failures value |
| Silent runtime escalation to RLM | Conflicts with TEAM-06; plan-time assignment only in v1.5 |
| n8n-class scheduling, triggers, credentials | Export bridge only; not a workflow automation platform |
| Specialized tool surfaces per role | Deferred to seed until expert v1 is measured |
| Removing chat-first entirely without migration path | SURF-02 demotes default; hard removal risks regressions |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAN-01 | Phase 30 | Pending |
| PLAN-02 | Phase 30 | Pending |
| PLAN-03 | Phase 30 | Pending |
| PLAN-04 | Phase 30 | Pending |
| PLAN-05 | Phase 31 | Pending |
| PLAN-06 | Phase 31 | Pending |
| PLAN-07 | Phase 30 | Pending |
| EXPORT-01 | Phase 34 | Pending |
| EXPORT-02 | Phase 34 | Pending |
| EXPORT-03 | Phase 34 | Pending |
| EXPORT-04 | Phase 34 | Pending |
| EXPORT-05 | Phase 34 | Pending |
| EXPORT-06 | Phase 34 | Pending |
| EXPORT-07 | Phase 34 | Pending |
| TEAM-01 | Phase 32 | Pending |
| TEAM-02 | Phase 32 | Pending |
| TEAM-03 | Phase 32 | Pending |
| TEAM-04 | Phase 32 | Pending |
| TEAM-05 | Phase 32 | Pending |
| TEAM-06 | Phase 32 | Pending |
| TEAM-07 | Phase 32 | Pending |
| TEAM-08 | Phase 34 | Pending |
| EXEC-01 | Phase 33 | Pending |
| EXEC-02 | Phase 33 | Pending |
| EXEC-03 | Phase 33 | Pending |
| SURF-01 | Phase 35 | Pending |
| SURF-02 | Phase 35 | Pending |
| SURF-03 | Phase 35 | Pending |

**Coverage:**
- v1.5 requirements: 28 total
- Mapped to phases: 28/28 ✓

---
*Requirements defined: 2026-05-21*
