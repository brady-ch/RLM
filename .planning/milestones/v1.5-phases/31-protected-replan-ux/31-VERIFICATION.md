---
phase: 31-protected-replan-ux
status: passed
verified: 2026-05-22
---

# Phase 31 Verification

status: passed

## Automated Verification

- `npm run build` passed.
- `npm run build:ui` passed.
- `npm test` passed 181/181 outside the sandbox.

## Must-Haves

- Protected descendants trigger `replan_requires_choice`: verified.
- Replace removes protected and pristine descendants before fresh planner output: verified.
- Merge preserves protected descendants and regenerates replaceable drafts: verified.
- Cancel makes no planner call and leaves the graph unchanged: verified.
- API routes accept replan choices: verified.
- CLI parser accepts `--replan replace|merge|cancel`: verified.
- UI exposes Replace subtree, Merge, and Cancel: verified by build and source.

## Human Verification

No manual verification required for this phase.
