# Requirements: Next Milestone (Candidate)

**Defined:** 2026-05-19  
**Source:** `$gsd-explore` — node-centric dynamic planning (B)  
**Core value (unchanged):** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## Dynamic graph authoring

- [ ] **PLAN-01**: UI loads with a seeded empty `root-composer` node focused for input; user can submit a non-empty prompt without a separate global chat step.
- [ ] **PLAN-02**: Submitting on any editable node invokes model-driven planning that creates or refreshes child nodes from that node’s prompt (replacing heuristic-only `plannedChildrenFor` for default paths).
- [ ] **PLAN-03**: Submitting on a child node plans only that node’s subtree, inheriting ancestor prompt context and the existing plan budget root semantics.
- [ ] **PLAN-04**: Resubmitting a parent replans the descendant planned structure; if no protected descendants exist, replan proceeds without a dialog.
- [ ] **PLAN-05**: If protected descendants exist (manual prompt edit, user model override, pin, or node not from last auto-plan), UI prompts **Replace subtree**, **Merge**, or **Cancel** before applying changes.
- [ ] **PLAN-06**: Merge preserves protected nodes and regenerates or adjusts only non-protected planned descendants to satisfy the updated parent intent.
- [ ] **PLAN-07**: Planning failures and budget exhaustion surface explicit UI/CLI states (no silent empty graphs or stuck draft readiness).

## Graph workflow export

- [ ] **EXPORT-01**: User can save an approved/planned graph as a `kind: graph` workflow sidecar (`.rlm/workflows/<id>.yaml`) without lossy conversion to agent-list-only config.
- [ ] **EXPORT-02**: Save dialog offers **Playbook**, **Pipeline**, or **Both**; default **Both** when the graph is suitable for templating.
- [ ] **EXPORT-03**: **Playbook** variant stores literal per-node prompts; **Pipeline** variant stores template prompt(s) with `{{input}}` at least at the root (same topology for both).
- [ ] **EXPORT-04**: User can import a saved graph workflow into the graph editor for edit and re-export (round-trip).
- [ ] **EXPORT-05**: Running a saved workflow uses a graph executor (topological, no replan unless edit-plan); smart default selects **Pipeline** when new input is provided and **Playbook** when replaying without input.
- [ ] **EXPORT-06**: CLI and UI support explicit `--variant playbook|pipeline` override and display which variant ran.
- [ ] **EXPORT-07**: Missing agents, models, or template variables fail explicitly at run start (no silent fallback to a different workflow shape).

## Traceability

- Design note (B): `.planning/notes/node-centric-dynamic-planning.md`
- Design note (A): `.planning/notes/graph-workflow-export.md`
- Seed: `.planning/seeds/save-graph-as-workflow.md`
- Proposed phases: ROADMAP — Phase 18 (authoring), Phase 19 (export & replay)
