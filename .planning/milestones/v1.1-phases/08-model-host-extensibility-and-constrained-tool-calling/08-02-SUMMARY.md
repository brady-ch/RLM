---
phase: 08-model-host-extensibility-and-constrained-tool-calling
plan: 08-02
subsystem: constrained-tool-calling
tags: [tools, constraints, ollama, host-observability]
requires:
  - phase: 08-model-host-extensibility-and-constrained-tool-calling
    provides: host selection/runtime routing substrate
provides:
  - Adapter-level constrained tool-calling option surface
  - Ollama two-step constrained-selection + tool-execution path
  - Host metadata emitted on model responses and compact/json rendering paths
affects: [execution-observability, adapter-contracts]
tech-stack:
  added:
    - tests/constrained-tool-calling.test.ts
  patterns: [adapter-owned-constrained-calling, two-step-ollama-tool-round, host-metadata-tracing]
key-files:
  created:
    - tests/constrained-tool-calling.test.ts
  modified:
    - src/ports/language-model-port.ts
    - src/domain/types.ts
    - src/domain/recursive-language-model.ts
    - src/adapters/ollama-language-model.ts
    - src/adapters/http-language-model.ts
    - src/cli/render.ts
key-decisions:
  - "Constrained tool-calling signal is passed from domain orchestration to adapters."
  - "Ollama tool rounds use explicit two-step behavior when constrained mode is active."
  - "Host metadata is attached to responses and surfaced through selection traces."
requirements-completed: [HOST-01, TCON-01]
duration: 40min
completed: 2026-05-10
---

# Phase 8 Plan 08-02 Summary

Implemented adapter-owned constrained tool-calling controls and host metadata observability, including explicit Ollama two-step handling under constrained mode.

## Verification

- `npm run build` - passed.
- `node --test dist/tests/constrained-tool-calling.test.js` - passed.
- `node dist/tests/recursive-language-model.test.js` - 58 passed / 1 failed.

## Outstanding

- Remaining failure is environment-specific: `listen EPERM 127.0.0.1` in `approval mode contract is consistent across cli api and ui labels`. This is a sandbox/network bind restriction, not a logic regression in Phase 8 code paths.
