---
phase: 31-protected-replan-ux
plan: 01
status: complete
completed: 2026-05-22
---

# Plan 31-01 Summary

Implemented core protected replan semantics.

- Added composer protection metadata.
- Manual child adds, manual prompt edits, and user model overrides now mark/provide protected reasons.
- Parent replan with protected descendants and no choice throws `replan_requires_choice`.
- `replace` deletes all descendants before fresh planner output.
- `merge` preserves protected descendants, removes replaceable drafts, and sends protected context to the planner.
- `cancel` returns without graph mutation or planner call.

Verification:

- Added backend tests for missing choice, replace, merge, and cancel.
- `npm test` passed 181/181 outside the sandbox.
