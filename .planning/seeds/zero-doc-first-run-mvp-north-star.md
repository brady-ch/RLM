---
title: Zero-Doc First Run MVP North Star
planted_date: 2026-05-11
trigger_condition: "Any MVP planning or tradeoff decision that could add setup friction for first-time users"
status: active
---

## Intent

Protect the primary MVP user journey:

1. Install tool (single executable or global CLI)
2. Run one command inside any folder
3. Open UI
4. Edit graph (spawn/edit/delete/drag, node-embedded chat)
5. Confirm and run recursive workflow

without requiring documentation-first onboarding.

## Evaluation checks

- Can a new user finish first run in under 5 minutes with no config-file edits?
- Are defaults safe and explicit (no silent failures)?
- Are next actions always visible in CLI/UI (launch URL, run state, mutation outcomes)?
- Does this decision improve or degrade first-run confidence?

## Notes

- Sequence preference: packaging/install reliability first, then node-embedded UX polish.
- Platform scope for binary path: macOS, Linux, Windows.
