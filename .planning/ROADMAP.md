# Roadmap: Recursive Language Model CLI

## Overview
- Project mode: mvp
- v1 requirements: 15
- Roadmap phases: 5
- Coverage target: 100% of v1 requirements mapped exactly once

### Phase 1: Planned Graph and Approval Foundation ✅ (Completed 2026-05-08)
**Goal:** Produce a reliable prompt-to-plan graph and enforce approval pause semantics as a hard gate before child execution.
**Mode:** mvp
**Success Criteria**:
1. Running a prompt produces a visible plan graph before downstream execution.
2. Execution halts at approval checkpoints and does not continue without required user action.
3. Approval state is consistent between backend execution controller and UI.
4. Errors in plan generation or approval transitions are surfaced in CLI/UI.

**Requirements:** PLAN-01, APRV-01

### Phase 2: Interactive Graph Mutation at Checkpoints ✅ (Completed 2026-05-08)
**Goal:** Allow safe in-memory node edit/add/delete at every paused checkpoint.
**Mode:** mvp
**Success Criteria**:
1. User can edit node content at paused checkpoints and resumed runs use updated data.
2. User can delete nodes with structural validation preventing invalid graph state.
3. User can add nodes and connect them into valid execution flow.
4. Invalid graph mutations return explicit user-visible errors.

**Requirements:** APRV-02, APRV-03, APRV-04, ERRO-02

### Phase 3: Model-Aware Node Planning and Overrides ✅ (Completed 2026-05-08)
**Goal:** Make model assignment a first-class, visible, and overridable property per node.
**Mode:** mvp
**Success Criteria**:
1. Each node card displays planned model assignment.
2. User can override node model at approval checkpoints.
3. Runtime executes node with final assignment and logs assignment used.
4. Final-node cross-model handoff path works for result synthesis.

**Requirements:** PLAN-02, MODL-01, MODL-02, MODL-03

### Phase 4: Recursive Spawning with Run-Mode Controls
**Goal:** Preserve recursive expansion while honoring checkpoint controls and initial-plan-only override mode.
**Mode:** mvp
**Success Criteria**:
1. Recursive flow can spawn downstream nodes/agents when needed.
2. Spawned nodes follow active approval policy (full-checkpoint or initial-plan-only override).
3. Initial-plan-only override runs without further approvals after initial acceptance.
4. Run state remains observable across spawned nodes.

**Requirements:** RECR-01, RECR-02, APRV-05

### Phase 5: Reliability and No-Silent-Failure Hardening
**Goal:** Ensure all failure paths are explicit, actionable, and test-covered.
**Mode:** mvp
**Success Criteria**:
1. Model/tool/workflow failures are always visible in UI and CLI.
2. No silent execution failure paths remain in approval/edit/run loops.
3. Failure statuses and messages are consistent across node and run-level views.
4. Regression tests cover critical failure surfacing flows.

**Requirements:** ERRO-01, ERRO-03

## Requirement Mapping Table

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAN-01 | Phase 1 | Complete |
| PLAN-02 | Phase 3 | Complete |
| APRV-01 | Phase 1 | Complete |
| APRV-02 | Phase 2 | Complete |
| APRV-03 | Phase 2 | Complete |
| APRV-04 | Phase 2 | Complete |
| APRV-05 | Phase 4 | Pending |
| MODL-01 | Phase 3 | Complete |
| MODL-02 | Phase 3 | Complete |
| MODL-03 | Phase 3 | Complete |
| RECR-01 | Phase 4 | Pending |
| RECR-02 | Phase 4 | Pending |
| ERRO-01 | Phase 5 | Pending |
| ERRO-02 | Phase 2 | Complete |
| ERRO-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓
