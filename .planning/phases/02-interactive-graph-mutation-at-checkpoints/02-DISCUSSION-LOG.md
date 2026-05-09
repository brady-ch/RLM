# Discussion Log: Phase 2

## Session
- Phase: 2
- Name: Interactive Graph Mutation at Checkpoints
- Date: 2026-05-08

## Areas Discussed

### 1) Mutation boundary model
- Selected: controller-only mutations.
- Outcome: all edit/add/delete/connect logic implemented in `execution-controller`; transport layers proxy only.

### 2) Graph integrity rules
- Cycle policy: allow cycles.
- Delete behavior: cascade-delete descendants.
- Parent/depth constraints: valid parent required; enforce max depth when configured.

### 3) Resume semantics after mutation
- Selected: re-evaluate affected subtree before resuming.

### 4) Error contract
- Selected: structured error contract `{code,message,nodeIds,details?,suggestedFix?}`.

## Deferred
- Consider optional no-max-depth mode with stronger stopping guardrails in a later phase.
