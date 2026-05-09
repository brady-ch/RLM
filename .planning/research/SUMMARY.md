# Research Summary

## Stack
The existing Node/TypeScript + React + Ollama architecture is suitable for the requested v1 without stack replacement.

## Table Stakes
- Prompt-to-graph planning flow
- Approval-gated execution checkpoints
- Visible execution graph state
- Reliable error surfacing
- Config-driven model routing

## Key Differentiators for This Repo
- Node-card model visibility
- Graph edit/add/delete at every paused checkpoint
- Initial-plan-only approval override
- Cross-model final-node handoff support

## Watch Out For
- Keep graph mutation integrity strict (no broken edges/orphans).
- Maintain one authoritative approval/execution state machine.
- Ensure node model shown in UI matches actual execution model.
- Never hide runtime errors.
