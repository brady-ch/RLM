---
phase: 08-model-host-extensibility-and-constrained-tool-calling
plan: 08-01
subsystem: model-hosts
tags: [hosts, routing, precedence, runtime]
requires:
  - phase: 07-mcp-and-skills-interoperability
    provides: runtime policy/config extension patterns
provides:
  - Typed host catalog schema and runtime host selection
  - `env > cli > config > default` host precedence resolver
  - Unavailable-host explicit decision policy (retry/switch/abort)
affects: [08-02, runtime-routing, cli]
tech-stack:
  added:
    - src/adapters/http-language-model.ts
  patterns: [typed-host-catalog, explicit-host-selection, no-silent-fallback]
key-files:
  created:
    - src/adapters/http-language-model.ts
    - tests/model-host-routing.test.ts
  modified:
    - src/application/project-config.ts
    - src/application/model-provider.ts
    - src/application/agent-runner.ts
    - src/application/workflow-runner.ts
    - src/cli/args.ts
    - src/index.ts
key-decisions:
  - "Host selection precedence is fixed to env > cli > config > defaults."
  - "Unavailable host requires explicit decision path; abort remains explicit and loud."
  - "Host choice is threaded through model-provider selection records for observability."
requirements-completed: [HOST-01]
duration: 45min
completed: 2026-05-10
---

# Phase 8 Plan 08-01 Summary

Implemented typed host catalog support, precedence-locked host selection, and explicit unavailable-host decision behavior.

## Verification

- `npm run build` - passed.
- `node --test dist/tests/model-host-routing.test.js` - passed.

## Notes

- Default host fallback remains `local_ollama` when no host catalog is defined, preserving existing tests and behavior.
