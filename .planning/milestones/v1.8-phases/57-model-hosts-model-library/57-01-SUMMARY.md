---
phase: 57-model-hosts-model-library
plan: 01
subsystem: models
tags: [rust, ollama, model-library, huggingface]

requires:
  - phase: 54-recursive-engine-execution-controller
    provides: LanguageModel trait, RouterState
provides:
  - OllamaLanguageModel adapter with streaming and tool policy
  - ModelLibraryService with catalog, search, install jobs, tier selection
  - HfRegistry for HF search and GGUF download
affects: [58-plugins, 59-cli, 60-packaging]

requirements-completed: [MDLH-01, MDLH-02, MDLH-03]

duration: 45min
completed: 2026-05-22
---

# Phase 57 Plan 01: Model Hosts + Model Library Summary

**Rust Ollama adapter and model library routes deliver v1.7 parity with explicit unconfigured-state gating.**

## Accomplishments

- `OllamaLanguageModel` — streaming completions, constrained/unconstrained tool-calling policy
- `ModelLibraryService` — curated catalog, Ollama install jobs, tier selection, HF search
- `HfRegistry` — HTTP-only HF API, GGUF download with size/path validation
- `/api/model-library/*` routes in Axum control server
- Wiring gate: model library only when explicit project config + Ollama host resolved

## Fixes

- `control_server_fixtures`: model-library returns 404 on bare temp dir (no explicit config path)
- Clippy `question_mark` on model_library wiring
- Test assertion: replaced fragile trait-object type_name check

## Self-Check: PASSED

- `npm run check:rust` green
- `cargo test -p rlm-core` — 54 tests pass
