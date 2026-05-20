---
phase: 23
title: Desktop Release Staging
status: passed
verified: 2026-05-20
---

# Phase 23 Verification

## Result

PASS. Phase 23 release staging and smoke verification passed.

## Requirement Checks

| Requirement | Result | Evidence |
|-------------|--------|----------|
| PROD-01 | PASS | Release folder includes launch shims, compiled CLI, and UI assets without requiring repo dev commands. |
| PROD-02 | PASS | Packaged `rlm ui` launches the existing control server/UI path and resolves staged `ui-dist`. |
| PROD-03 | PASS | `ensure-ollama.mjs` detects a compatible endpoint and can start managed `ollama serve` when explicitly enabled. |

## Verification Commands

```bash
npm run package:smoke
npm test
```

All commands passed on 2026-05-20.

## Residual Notes

- This phase produces installer-ready release folders, not signed native store installers.
- The helper does not kill separately managed user Ollama processes.
