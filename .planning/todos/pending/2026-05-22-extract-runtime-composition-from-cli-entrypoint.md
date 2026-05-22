---
created: 2026-05-22T00:00:00.000Z
title: Extract runtime composition from CLI entrypoint
area: architecture
resolves_phase: 68
files:
  - src/index.ts
  - src/application/runtime-composition.ts
---

## Problem

`src/index.ts` is acting as both CLI entrypoint and composition root. It currently wires first-run behavior, config loading, stores, memory, model selection, extension/plugin loading, interop tools, run state, execution control, UI/control server setup, and final agent/workflow dispatch.

That makes architecture boundaries harder to see and makes future plugin/tool growth more likely to accumulate in the entrypoint.

## Solution

Extract runtime construction into focused application/runtime builders while keeping `index.ts` responsible for command parsing and dispatch.

Candidate extraction areas:

- Store creation: session, memory, run state, vector index.
- Extension/plugin host setup: built-ins, external load, allowlist handling.
- Tool resolution: configured tools plus interop/MCP/skill tools.
- Model factory and cleanup tracking.
- Execution control, runtime events, cancellation, and shutdown wiring.
- Memory/run manifest initialization.

## Acceptance checks

- `src/index.ts` reads primarily as CLI flow and dispatch.
- Runtime builders are testable without invoking the full CLI.
- Existing CLI, UI, session, memory, agent, and workflow behavior remains unchanged.
- No plugin/tool registration logic is duplicated.

