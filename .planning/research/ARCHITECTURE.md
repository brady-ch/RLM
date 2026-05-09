# Architecture Research

## Target Component Boundaries
- Planning + recursive policy: `src/domain/recursive-language-model.ts`
- Execution control + approvals: `src/application/execution-controller.ts`
- Workflow orchestration: `src/application/workflow-runner.ts`
- Agent/model selection: `src/application/agent-runner.ts`, `src/application/model-provider.ts`
- UI control surface: `src/application/control-server.ts`, `ui/src/main.tsx`

## Data Flow for Approval Editing
1. Domain/application emits planned nodes.
2. Execution controller enters paused checkpoint state.
3. UI fetches current graph; user edits/adds/deletes nodes.
4. Mutations are validated and applied to in-memory execution graph.
5. User approves; execution resumes using updated graph.

## Model Routing Flow
1. Planner assigns intended model/tier per node.
2. Node cards render planned model label.
3. User may override assignment at checkpoint.
4. Runner uses final assignment during node execution.

## Build-Order Implications
1. Stabilize approval checkpoint contract.
2. Implement graph mutation APIs + validation.
3. Expose/render model assignment per node card.
4. Add initial-plan-only approval override.
5. Harden error propagation and tests.
