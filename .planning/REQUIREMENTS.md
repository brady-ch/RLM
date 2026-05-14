# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-14
**Milestone:** v1.2 — Answer Quality Loops
**Core Value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## v1.2 Requirements

### Loop Runtime

- [ ] **LOOP-01**: User can run an answer-quality refinement loop as one collapsed top-level execution graph node with inspectable internal `draft -> critique -> refine -> gate -> best-of-progress` history.
- [ ] **LOOP-02**: User can configure hard loop bounds, including max iterations and model-call budget behavior, and every loop exits with an explicit stop reason.
- [ ] **LOOP-03**: User can inspect loop history including candidate text summaries, critiques, refinements, scores, unresolved issues, selected candidate, phase model, and token/model-call usage.

### Rubrics and Evaluation

- [ ] **RUBR-01**: System selects a visible default adaptive rubric from task context, with rubric types for general answer quality, code/engineering, planning/architecture, user-facing writing, and structured artifacts.
- [ ] **RUBR-02**: Critique, gate, and best-of-progress outputs are parsed through structured schemas, and parse failures surface as explicit degraded or failed loop states.
- [ ] **RUBR-03**: Gate decisions combine rubric fit, critique resolution, and meaningful-improvement checks before passing or continuing a loop.

### Refinement and Selection

- [ ] **REFN-01**: System produces refined candidates from the original prompt plus structured critique while preserving prior candidates for comparison.
- [ ] **REFN-02**: System returns the best-of-progress candidate rather than blindly returning the final iteration.
- [ ] **REFN-03**: System can stop early when critique is resolved, pass threshold is reached, or no meaningful improvement is detected.

### Model Routing and Overrides

- [ ] **MODL-04**: System supports phase-specific model routing for draft, critique, refine, gate, and best-of-progress loop phases.
- [ ] **MODL-05**: User can override models separately for draft, critique, refine, gate, and best-of-progress phases before execution resumes.
- [ ] **MODL-06**: UI/CLI trace shows planned and effective model assignment per loop phase, with explicit failure when a selected phase model is unavailable.

### UI, CLI, and Human Control

- [ ] **UXQL-01**: UI node cards summarize loop status, score, iteration count, selected candidate, and stop reason without expanding the graph into many top-level nodes.
- [ ] **UXQL-02**: UI inspector shows an expandable timeline of loop iterations, critique resolution, rubric details, phase model trail, and candidate selection rationale.
- [ ] **UXQL-03**: CLI and JSON output include loop metadata: rubric id, score, iterations, stop reason, selected candidate, and degraded/failure details.
- [ ] **UXQL-04**: User can manually accept or stop a paused quality loop without conflating human approval with the automatic quality gate.

### Verification

- [ ] **VERF-01**: Fake-model tests cover pass threshold, critique resolved, no meaningful improvement, max iterations, budget exhaustion, parse failure, cancellation, and best-of-progress selection.
- [ ] **VERF-02**: UI/API tests cover loop metadata rendering, phase override updates, human accept/stop actions, and stale-loop invalidation after prompt/model/rubric edits.
- [ ] **VERF-03**: Regression fixtures verify loops remain bounded, observable, and non-silent across CLI, UI, trace, and run-state outputs.

## Future Requirements

### Developer Launcher and Plugins

- **PLGN-01**: Developer can install, enable, disable, list, and diagnose plugins from local folders.
- **PLGN-02**: Plugin manifests support declarative contributions and optional executable entries.

### Local Hugging Face Models

- **HFMD-01**: Developer can browse and install local Hugging Face GGUF model artifacts.
- **HFMD-02**: Model browser can toggle runnable-only vs all discovered models.
- **HFMD-03**: llama.cpp runtime compatibility is represented separately from install status.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Best-of-N parallel fanout | More expensive and not needed for the base loop primitive. |
| Custom rubric builder UI | Default adaptive rubrics should prove useful first. |
| Tool-using factuality loops | Adds tool/retrieval complexity beyond answer-quality refinement. |
| Code/test-driven implementation loops | Seeded for later after answer-quality loops are stable. |
| Developer launcher/plugin manager | Captured for a future milestone. |
| Hugging Face local model installer | Captured for a future milestone. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOOP-01 | TBD | Pending |
| LOOP-02 | TBD | Pending |
| LOOP-03 | TBD | Pending |
| RUBR-01 | TBD | Pending |
| RUBR-02 | TBD | Pending |
| RUBR-03 | TBD | Pending |
| REFN-01 | TBD | Pending |
| REFN-02 | TBD | Pending |
| REFN-03 | TBD | Pending |
| MODL-04 | TBD | Pending |
| MODL-05 | TBD | Pending |
| MODL-06 | TBD | Pending |
| UXQL-01 | TBD | Pending |
| UXQL-02 | TBD | Pending |
| UXQL-03 | TBD | Pending |
| UXQL-04 | TBD | Pending |
| VERF-01 | TBD | Pending |
| VERF-02 | TBD | Pending |
| VERF-03 | TBD | Pending |

**Coverage:**
- v1.2 requirements: 19 total
- Mapped to phases: 0
- Unmapped: 19

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14 after research synthesis*
