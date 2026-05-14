# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-14
**Context:** Active requirements captured after v1.1 shipped; archived requirements live under `.planning/milestones/`.

## Refinement Loop Requirements

- [ ] **LOOP-01**: User can create a hybrid refinement loop node that appears as a single top-level graph node while exposing an inspectable internal `Draft -> Critique -> Refine -> Gate -> Best-of-Progress` workflow.
- [ ] **LOOP-02**: Refinement loop nodes use a default adaptive rubric that selects evaluation criteria from prompt and artifact context, with general answer quality as fallback and specialized rubrics for code, planning/architecture, user-facing writing, and structured artifacts.

## Developer Launcher and Plugin Requirements

- [ ] **LAUN-01**: Developer can start RLM by clicking an executable that launches the local control server, opens the browser UI, loads global plus project config, and surfaces startup diagnostics without requiring a terminal.
- [ ] **PLGN-01**: Developer can install, enable, disable, list, and diagnose plugins from local folders, with installed plugins stored under the user RLM data directory and project-local overrides still supported.
- [ ] **PLGN-02**: Plugin manifests support declarative contributions for agents, models, workflows, rubrics, and templates without requiring executable code; executable entries are optional and required only for contributions such as tools or model host adapters.

## Local Model Requirements

- [ ] **HFMD-01**: Developer can browse and install local Hugging Face GGUF model artifacts into the RLM user data directory, with clear metadata for repo, revision, artifact path, quantization, size, license, and installed status.
- [ ] **HFMD-02**: Hugging Face model browser can toggle between runnable-only results and all discovered results, showing non-runnable artifacts with explicit compatibility status instead of hiding the reason.
- [ ] **HFMD-03**: llama.cpp runtime compatibility is represented separately from download/install status, distinguishing states such as runnable, runtime missing, no GGUF artifact, unsupported architecture, gated/license required, insufficient RAM/VRAM, and unknown compatibility.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOOP-01 | TBD | Proposed |
| LOOP-02 | TBD | Proposed |
| LAUN-01 | TBD | Proposed |
| PLGN-01 | TBD | Proposed |
| PLGN-02 | TBD | Proposed |
| HFMD-01 | TBD | Proposed |
| HFMD-02 | TBD | Proposed |
| HFMD-03 | TBD | Proposed |
