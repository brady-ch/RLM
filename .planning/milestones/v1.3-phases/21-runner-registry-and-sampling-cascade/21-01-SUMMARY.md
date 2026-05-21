---
phase: 21
plan: 01
title: Runner Registry and Sampling Cascade
status: completed
completed: 2026-05-20
requirements:
  - PROD-04
  - PROD-08
  - PROD-09
  - PROD-10
  - PROD-11
  - PROD-12
---

# Phase 21-01 Summary

Implemented the runner sampling foundation for v1.3.

## Delivered

- Added `LanguageModelSamplingOptions` and effective sampling/source metadata on completion options and responses.
- Added optional YAML config for global sampling defaults and per-model sampling profiles.
- Resolved sampling through the cascade: adapter default -> global -> model profile -> node override.
- Attached effective sampling metadata to provider selections, completion responses, graph nodes, compact CLI render output, and JSON render output.
- Wired Ollama sampling parameters (`temperature`, `topP`, `topK`, `repeatPenalty`, `maxTokens`, `seed`) and HTTP adapter forwarding.
- Added node-level sampling overrides via interactive session API, control-server endpoint, and compact UI inspector controls for temperature, top-p, and max tokens.
- Preserved existing model routing, host selection, constrained tool-calling behavior, approval flow, and quality-loop routing.

## Tests

- `npm run build`
- `node --test dist/tests/project-config-scopes.test.js dist/tests/recursive-language-model.test.js`
- `npm run build:ui`
- `npm test`
