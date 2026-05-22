---
phase: 30-plan-from-node-foundation
plan: 03
status: complete
completed: 2026-05-22
---

# Plan 30-03 Summary

Wired async plan-from-node through API and CLI surfaces.

- `POST /api/nodes/:id/plan` and `/breakdown` now await async `session.planNode`.
- UI sessions receive a `PurposeRoutingLanguageModel` as `planModel`, so planning uses configured purpose routing.
- Added `rlm plan-node --node-id <id> --prompt <text>` parsing and CLI execution path.
- `plan-node` prints JSON with planned node ids, budget, and graph node count; mutation failures print structured JSON errors.

Verification:

- Added parser coverage for `plan-node`.
- Existing control-server plan tests pass with injected mock plan model.
- `npm test` passed 177/177 outside the sandbox.
