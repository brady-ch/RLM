# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-08
**Core Value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## v1 Requirements

### Planning

- [x] **PLAN-01**: User can submit a prompt and receive an execution node graph plan before child-node execution starts.
- [x] **PLAN-02**: Planned nodes include intended model assignment metadata.

### Approval and Graph Editing

- [x] **APRV-01**: Execution pauses at every approval checkpoint until explicit user action.
- [x] **APRV-02**: User can edit node prompt/details at a paused checkpoint and resume execution with updated node data.
- [x] **APRV-03**: User can delete a planned node at a paused checkpoint with graph integrity validation.
- [x] **APRV-04**: User can add a new node at a paused checkpoint and connect it into execution flow with validation.
- [x] **APRV-05**: User can choose an override mode that requires approval only for the initial plan and then auto-runs remaining checkpoints.

### Model Routing

- [x] **MODL-01**: Each node card displays planned model assignment in the UI.
- [x] **MODL-02**: User can override model assignment per node before resuming.
- [x] **MODL-03**: Runtime executes each node using the final assignment (planned or user-overridden) and supports cross-model handoff to final result node.

### Recursive Execution

- [x] **RECR-01**: Recursive flow can spawn additional downstream nodes/agents when needed after approvals.
- [x] **RECR-02**: Spawned nodes inherit approval/override behavior consistently with the active run mode.

### Error Visibility and Reliability

- [x] **ERRO-01**: Runtime failures surface explicitly in UI node status and CLI output.
- [x] **ERRO-02**: Graph mutation validation errors surface immediately and prevent invalid execution.
- [x] **ERRO-03**: System does not fail silently on model/tool/workflow errors.

## v2 Requirements

### Persistence and Collaboration

- **PERS-01**: User can persist graph edits/additions/deletions and reload them across process restarts.
- **PERS-02**: User can resume an interrupted approved plan from stored run state.
- **COLL-01**: Multiple users can review/approve/edit execution plans collaboratively.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Persistent graph edit history in v1 | Deferred to keep v1 approval/edit loop focused and lower risk |
| Multi-user collaborative approval sessions | Not required for local developer repo workflow |
| Silent auto-fallback behavior | Conflicts with explicit error visibility requirement |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAN-01 | Phase 1 | Complete |
| PLAN-02 | Phase 3 | Complete |
| APRV-01 | Phase 1 | Complete |
| APRV-02 | Phase 2 | Complete |
| APRV-03 | Phase 2 | Complete |
| APRV-04 | Phase 2 | Complete |
| APRV-05 | Phase 4 | Complete |
| MODL-01 | Phase 3 | Complete |
| MODL-02 | Phase 3 | Complete |
| MODL-03 | Phase 3 | Complete |
| RECR-01 | Phase 4 | Complete |
| RECR-02 | Phase 4 | Complete |
| ERRO-01 | Phase 5 | Complete |
| ERRO-02 | Phase 2 | Complete |
| ERRO-03 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

## Milestone v1.1 Requirements (active)

**Defined:** 2026-05-09  
**Research:** Tool-calling constraints — `.planning/research/TOOL-CALLING-CONSTRAINED-DECODING.md` (parallel domain research skipped; plan-phase may add MCP/skills ecosystem notes).

### Interoperability

- [x] **INT-01**: User can configure MCP servers using a documented import or parity path with at least one common MCP agent client layout (exact matrix TBD in plan).
- [x] **INT-02**: User can load or reference skills using a documented compatibility path with at least one common on-disk skill layout used by target agent hosts (exact layout TBD in plan).

### Chat-first planning

- [ ] **CHAT-01**: User can create and refine the execution node graph through a conversational UI session (not only a single-shot prompt submission).

### Extensibility

- [x] **PLUG-01**: System exposes a documented extension mechanism to register additional tools, skills, and model host adapters without forking core, including at least one reference registration path.

### Model hosts

- [ ] **HOST-01**: User can configure **local and remote** model endpoints with consistent selection and tier/routing semantics across CLI and UI.

### Human clarification

- [ ] **QUES-01**: Execution pauses with an explicit user-facing prompt when the runtime requires human answers; the run does not continue until the user responds or an explicit documented dismiss/skip policy applies (no silent continuation).

### Constrained tool calling

- [ ] **TCON-01**: Tool-calling rounds support constrained decoding for tool selection and arguments per `.planning/research/TOOL-CALLING-CONSTRAINED-DECODING.md` (JSON Schema / envelope approach appropriate to each host), integrated through `LanguageModelPort` and the recursive execution loop, without violating host constraints (e.g. Ollama `tools` + `format` mutual exclusion).

### Typed workflow continuity

- [x] **ARTF-01**: Node workflows support a typed artifact schema plus external run-state continuity for long-running pipelines (e.g. full-book processing), with code-only nodes allowed and state mutation guarded by optimistic concurrency, path-level ACL, and append-only audit events.

### Distribution and install UX

- [ ] **DIST-01**: System can be distributed as a single executable artifact for macOS, Linux, and Windows.
- [ ] **DIST-02**: System supports global install usage (`rlm`) and executes in the caller's current folder context.
- [ ] **DIST-03**: First-run UX is zero-doc: a new user can install, run one command, open UI, edit graph, and start execution without manual config editing.

### Graph editing UX

- [ ] **UXND-01**: UI supports direct node dragging and graph layout manipulation for planned/executing workflows.
- [ ] **UXND-02**: Each node includes embedded chat input for node-local authoring/refinement workflows.
- [ ] **UXND-03**: UI provides explicit controls to spawn a connected child node from any editable node and delete a node/subtree with safe validation.
- [ ] **UXND-04**: Recursive runtime can expand to N downstream nodes as determined by recursive planning logic without fixed node-count caps in normal operation.

### Traceability (v1.1)

| Requirement | Phase | Status |
|-------------|-------|--------|
| INT-01 | Phase 7 | Complete |
| INT-02 | Phase 7 | Complete |
| CHAT-01 | Phase 9 | Pending |
| PLUG-01 | Phase 6 | Complete |
| HOST-01 | Phase 8 | Pending |
| QUES-01 | Phase 9 | Pending |
| TCON-01 | Phase 8 | Pending |
| ARTF-01 | Phase 8.5 | Complete |
| DIST-01 | Phase 10 | Pending |
| DIST-02 | Phase 10 | Pending |
| DIST-03 | Phase 10 | Pending |
| UXND-01 | Phase 11 | Pending |
| UXND-02 | Phase 11 | Pending |
| UXND-03 | Phase 11 | Pending |
| UXND-04 | Phase 11 | Pending |

**Coverage (v1.1):** 15/15 requirements mapped ✓

---
*Requirements defined: 2026-05-08 (v1); 2026-05-09 (v1.1)*
*Last updated: 2026-05-11 — added distribution and node-embedded UX MVP requirements*
