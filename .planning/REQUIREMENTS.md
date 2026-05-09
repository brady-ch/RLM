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

---
*Requirements defined: 2026-05-08*
*Last updated: 2026-05-08 after Phase 5 completion*
