# Phase 38 Verification: Runtime Bootstrap

**status:** passed

**Date:** 2026-05-22

## Automated gate

- `npm run check` — exit 0 (typecheck, eslint, prettier, dependency-cruise, tests)

## Tests

- **Count:** 211 (`node --test dist/tests/*.test.js` after `npm run build`)
- **Added:** `tests/bootstrap-runtime.unit.test.ts` — asserts `buildRuntimeContext` exposes `default`/`coding` agent profiles and registers the `skill` interop tool in a temporary project root without starting the HTTP control server.

## Regression (Phase 38 scope)

**REG-01 / REG-02:** Full suite green with one additive unit test; no intentional CLI flag, config semantics, UI server, graph, session, or memory behavior changes reviewed against extracted `agent-workflow`, `plan-node`, and `ui` run modes.

## Init order note (BOOT-04)

Bootstrap preserves the composition order inherited from monolithic `index.ts`: `CancellationController`, `createExecutionControl`, `installShutdownHandlers` are created before `ExtensionHost`/`McpSkillRuntime` extension/tool registration—a deliberate match to existing shutdown+MCP choreography.
