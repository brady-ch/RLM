---
phase: 31-protected-replan-ux
plan: 02
status: complete
completed: 2026-05-22
---

# Plan 31-02 Summary

Wired protected replan choices through API and CLI.

- `POST /api/nodes/:id/plan` and `/breakdown` parse `{ replan }` and pass valid choices to `planNode`.
- `rlm plan-node` now supports `--replan replace|merge|cancel`.
- CLI parsing rejects invalid replan choices.
- Missing-choice failures use the same structured `replan_requires_choice` mutation error path as the API.

Verification:

- Updated parser coverage for `--replan`.
- Existing control-server tests pass.
- `npm test` passed 181/181 outside the sandbox.
