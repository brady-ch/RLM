---
title: Multi-Runner Adapters Beyond Bundled Ollama
planted_date: 2026-05-20
trigger_condition: "When v1.3 desktop product (bundled Ollama) ships and users request direct GGUF control, llama.cpp server, vLLM, or cloud API runners without Ollama as intermediary"
status: active
---

## Intent

v1.3 bundles **Ollama** as the sole managed runner. This seed captures when to add **additional `LanguageModelPort` adapters** and optional second-runner install paths — without breaking the simple default for install-and-run users.

## Candidate adapters

| Runner | Adapter shape | User-facing trigger |
|--------|---------------|---------------------|
| **llama.cpp server** | HTTP OpenAI-compatible or native llama.cpp API | Power users want specific GGUF quants; HF GGUF repos not Ollama-importable |
| **vLLM** | HTTP OpenAI-compatible | Local multi-GPU or high-throughput serving |
| **Cloud APIs** | Extend `HttpLanguageModelAdapter` | OpenAI/Anthropic/OpenRouter keys in settings |
| **Existing Ollama** | Already shipped | Detect external install vs bundled |

## Evaluation checks (before building)

- User cannot achieve goal with bundled Ollama + curated/HF catalog (document concrete model or format gap).
- Adapter can implement `LanguageModelPort.complete` including tool calling policy flags (`constrainedToolCalling`, degraded mode).
- Model library can tag entries with `runnerKind` + `runnerModelId` without confusing default users (advanced tab only until stable).
- Startup/lifecycle story exists per OS or runner is external-only (detect, don’t bundle).

## Constraints

- Ollama remains one adapter among many; no Ollama-specific logic in domain layer.
- Do not bundle llama.cpp + Ollama in the same installer unless install size and test matrix are explicitly accepted.
- Sampling cascade (global → model → node) must apply uniformly across adapters where parameters are supported; unsupported params ignored with UI hint.

## Depends on

- Phase 21 runner registry + sampling schema (`.planning/notes/desktop-product-vision.md`).
- Phase 22 model library metadata shape (compatibility tags).

## References

- `src/ports/language-model-port.ts`
- `src/adapters/ollama-language-model.ts`
- `src/adapters/http-language-model.ts`
- `src/application/runtime-composition.ts` (`createModelFactory`)
