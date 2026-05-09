---
phase: "01"
plan: "01-02"
status: completed
key_files:
  - src/application/control-server.ts
  - ui/src/main.tsx
  - ui/src/styles.css
commits:
  - b3dd61d
---

# Summary: 01-02

## Objective
Align control-server and UI behavior with backend hard-gate semantics and explicit error surfacing.

## Completed Work
- Updated control-server approval/skip endpoints to accept optional approval token and return duplicate metadata.
- Added normalized API error mapping:
  - 404 unknown node
  - 409 stale/not-awaiting approval transitions
  - 400 generic invalid request
- Updated UI to send node approval tokens for approve/skip actions.
- Added explicit in-UI error surface for checkpoint/control failures.
- Routed node and stop actions through an error-aware action wrapper to prevent silent failures.

## Verification
- `npm run build` passed.
- `npm test` passed.

## Notes
- UI now reflects backend-authoritative transitions and exposes action failures immediately.
