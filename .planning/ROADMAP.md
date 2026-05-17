# Roadmap: Recursive Language Model CLI

## Milestones

- 🚧 **v1.2 Answer Quality Loops** — Phases 12-17 (in progress)
- ✅ **v1.1 Interop, chat-first, plugins, constrained tools** — Phases 6-11, including inserted Phase 8.5 (shipped 2026-05-13; archive: `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-08; archive: `.planning/milestones/v1.0-ROADMAP.md`)

## Overview

v1.2 adds bounded answer-quality refinement loops to the existing recursive graph runtime. The milestone starts by making loop state, budgets, stop reasons, and evaluator schemas explicit; then it delivers refine and best-of-progress behavior, model routing controls, UI/CLI inspection, and regression coverage so loop quality gains remain observable rather than silent.

## Phases

**Phase Numbering:**
- Integer phases (12, 13, 14): Planned milestone work
- Decimal phases (12.1, 12.2): Urgent insertions if needed

<details>
<summary>✅ v1.1 Interop, chat-first, plugins, constrained tools (Phases 6-11) — SHIPPED 2026-05-13</summary>

- [x] Phase 6: Extension and Plugin Foundation (2/2 plans) — completed 2026-05-10
- [x] Phase 7: MCP and Skills Interoperability (2/2 plans) — completed 2026-05-10
- [x] Phase 8: Model Host Extensibility and Constrained Tool Calling (2/2 plans) — completed 2026-05-11
- [x] Phase 8.5: Typed Artifact + Stateful Workflow Runtime (2/2 plans) — completed 2026-05-11
- [x] Phase 9: Chat-First Graph UX and Clarification Stops (2/2 plans) — completed 2026-05-11
- [x] Phase 10: Cross-Platform Executable Packaging and Install UX (2/2 plans) — completed 2026-05-12
- [x] Phase 11: Node-Embedded Chat and Intuitive Graph Editing UX (1/1 plan) — completed 2026-05-12

</details>

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-05-08</summary>

See `.planning/milestones/v1.0-ROADMAP.md` and `.planning/milestones/v1.0-phases/`.

</details>

- [ ] **Phase 12: Loop Runtime Contract** - Make quality loops first-class, bounded execution graph nodes with explicit internal state and stop reasons.
- [ ] **Phase 13: Rubric and Evaluator Contract** - Select visible adaptive rubrics and parse critique/gate outputs through strict schemas.
- [ ] **Phase 14: Refine and Best-of-Progress Engine** - Run bounded draft/critique/refine/gate cycles and return the best candidate seen so far.
- [ ] **Phase 15: Loop Phase Model Routing and Overrides** - Route and override draft, critique, refine, gate, and best-of-progress models independently.
- [ ] **Phase 16: Inspectable UI, CLI, and Human Loop Control** - Surface loop summaries, timelines, CLI metadata, and manual accept/stop controls.
- [ ] **Phase 17: Quality Verification and Regression Harness** - Prove loops stay bounded, observable, and non-silent across runtime, UI, CLI, trace, and state outputs.

## Phase Details

### Phase 12: Loop Runtime Contract
**Goal**: Users can run a quality loop as one bounded top-level graph node with inspectable internal loop state and explicit exit semantics.
**Depends on**: Phase 11
**Requirements**: LOOP-01, LOOP-02, LOOP-03
**Success Criteria** (what must be TRUE):
  1. User can see a quality loop represented as one collapsed top-level execution graph node.
  2. User can inspect the loop's internal draft, critique, refine, gate, and best-of-progress history without expanding it into top-level nodes.
  3. User can configure max iterations and model-call budget behavior before the loop runs.
  4. Every completed, stopped, degraded, or failed loop reports a clear stop reason and usage summary.
**Plans**: 2 plans
Plans:
**Wave 1**
- [ ] 12-01-PLAN.md — Define typed loop metadata, config validation, and explicit CLI opt-in.

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 12-02-PLAN.md — Implement bounded loop runtime, terminal metadata, renderer output, and fake-model tests.

### Phase 13: Rubric and Evaluator Contract
**Goal**: Users can trust that loop evaluation is based on visible rubric selection and structured evaluator outputs.
**Depends on**: Phase 12
**Requirements**: RUBR-01, RUBR-02, RUBR-03
**Success Criteria** (what must be TRUE):
  1. User can see which default rubric was selected for the task and why it fits the prompt context.
  2. User can distinguish general answer quality, code/engineering, planning/architecture, user-facing writing, and structured artifact rubrics.
  3. Critique, gate, and best-of-progress evaluator outputs either parse into structured loop state or surface explicit degraded/failed states.
  4. Gate decisions visibly account for rubric fit, critique resolution, and meaningful improvement before passing or continuing.
**Plans**: TBD

### Phase 14: Refine and Best-of-Progress Engine
**Goal**: Users receive a refined answer selected from loop progress instead of blindly receiving the final iteration.
**Depends on**: Phase 13
**Requirements**: REFN-01, REFN-02, REFN-03
**Success Criteria** (what must be TRUE):
  1. User can see refined candidates produced from the original prompt and structured critique.
  2. Earlier candidates remain available for comparison after later refinements are generated.
  3. The loop final answer is selected from the best candidate seen so far, not automatically from the last iteration.
  4. The loop can stop early when critique is resolved, a pass threshold is reached, or no meaningful improvement is detected.
**Plans**: TBD

### Phase 15: Loop Phase Model Routing and Overrides
**Goal**: Users can control and audit model selection independently for each quality-loop phase.
**Depends on**: Phase 14
**Requirements**: MODL-04, MODL-05, MODL-06
**Success Criteria** (what must be TRUE):
  1. User can route draft, critique, refine, gate, and best-of-progress phases to distinct configured model tiers.
  2. User can override the model for any single loop phase before execution resumes.
  3. UI and CLI traces show planned and effective model assignment for every loop phase.
  4. A selected unavailable phase model fails explicitly instead of silently falling back.
**Plans**: TBD
**UI hint**: yes

### Phase 16: Inspectable UI, CLI, and Human Loop Control
**Goal**: Users can inspect loop quality state and manually accept or stop paused loops without confusing human control with automatic quality gates.
**Depends on**: Phase 15
**Requirements**: UXQL-01, UXQL-02, UXQL-03, UXQL-04
**Success Criteria** (what must be TRUE):
  1. UI node cards summarize loop status, score, iteration count, selected candidate, and stop reason in the collapsed graph.
  2. UI inspector views show an expandable iteration timeline with critique resolution, rubric details, model trail, and candidate selection rationale.
  3. CLI text and JSON outputs include rubric id, score, iterations, stop reason, selected candidate, and degraded/failure details.
  4. User can manually accept or stop a paused quality loop through controls that stay separate from automatic gate decisions.
**Plans**: TBD
**UI hint**: yes

### Phase 17: Quality Verification and Regression Harness
**Goal**: Users and maintainers can verify that quality loops remain bounded, observable, and non-silent across supported execution surfaces.
**Depends on**: Phase 16
**Requirements**: VERF-01, VERF-02, VERF-03
**Success Criteria** (what must be TRUE):
  1. Fake-model tests prove pass threshold, critique resolved, no meaningful improvement, max iterations, budget exhaustion, parse failure, cancellation, and best-of-progress selection.
  2. UI/API tests prove loop metadata rendering, phase override updates, human accept/stop actions, and stale-loop invalidation after prompt/model/rubric edits.
  3. Regression fixtures prove loop behavior remains bounded and observable in CLI output, UI state, trace events, and run-state records.
  4. Failures in loop parsing, budget handling, cancellation, or selected model routing produce explicit test-visible errors.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 12 → 13 → 14 → 15 → 16 → 17

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 12. Loop Runtime Contract | v1.2 | 0/TBD | Not started | - |
| 13. Rubric and Evaluator Contract | v1.2 | 0/TBD | Not started | - |
| 14. Refine and Best-of-Progress Engine | v1.2 | 0/TBD | Not started | - |
| 15. Loop Phase Model Routing and Overrides | v1.2 | 0/TBD | Not started | - |
| 16. Inspectable UI, CLI, and Human Loop Control | v1.2 | 0/TBD | Not started | - |
| 17. Quality Verification and Regression Harness | v1.2 | 0/TBD | Not started | - |
| v1.1 Interop, chat-first, plugins, constrained tools | v1.1 | 13/13 | Complete | 2026-05-13 |
| v1.0 MVP | v1.0 | archived | Complete | 2026-05-08 |
