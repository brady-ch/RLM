---
phase: 31-protected-replan-ux
plan: 03
status: complete
completed: 2026-05-22
---

# Plan 31-03 Summary

Added the protected replan gate to the UI.

- Node cards detect `replan_requires_choice` planning failures.
- A node-scoped protected replan panel offers Replace subtree, Merge, and Cancel.
- Merge copy uses: “Merge keeps protected edits and replans only replaceable drafts.”
- Gate actions call the existing plan endpoint with the selected replan choice.

Verification:

- `npm run build` passed.
- `npm run build:ui` passed.
- `npm test` passed 181/181 outside the sandbox.
