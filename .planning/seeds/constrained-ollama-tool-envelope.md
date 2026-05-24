---
title: Constrained Ollama Tool Envelope
planted_date: 2026-05-24
trigger_condition: "When Node runtime retirement completes (Phase 119) AND Ollama tool-call reliability on small models becomes a production concern"
status: dormant
---

## Intent

Implement Option A from `.planning/research/TOOL-CALLING-CONSTRAINED-DECODING.md`: single-call JSON envelope via Ollama `format: <JSONSchema>` with closed `enum` of tool names. Token-level masking replaces post-hoc `bindTools` parsing for tool rounds.

## Phase

**Phase 120: Constrained Ollama Tool Envelope Rust**

## Scope

- Add `response_format` (JSON Schema) to `LanguageModelCompleteOptions` in Rust ports
- Build envelope schema from registered tool definitions in `rlm-core`
- Branch in `OllamaLanguageModel::complete` — when envelope mode active, pass `format` not `tools` (mutually exclusive per Ollama)
- Parse assistant content as JSON; map to `ToolCallRequest` or final content
- Gate behind config flag; default off until validated on target models

## Out of scope

- TypeScript implementation (Node runtime retired)
- Python Outlines sidecar (Option D)
- vLLM guided decoding (Option E)

## References

- `.planning/research/TOOL-CALLING-CONSTRAINED-DECODING.md` §0.6 Option A
- `crates/rlm-core/src/adapters/ollama_language_model.rs`
- `crates/rlm-core/src/domain/recursion/tool_round_loop.rs`
