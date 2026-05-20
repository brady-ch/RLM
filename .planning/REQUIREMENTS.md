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

## Traceability

- Design note: `.planning/notes/node-centric-dynamic-planning.md`
- Follow-on seed: `.planning/seeds/save-graph-as-workflow.md` (fixed workflow export — explore A)
- Proposed phase: ROADMAP — Phase 18: Dynamic Graph Authoring
