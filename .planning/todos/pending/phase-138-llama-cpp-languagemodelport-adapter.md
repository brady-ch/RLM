---
created: 2026-05-24T00:00:00.000Z
title: Phase 138 — llama.cpp LanguageModelPort adapter
area: inference
resolves_phase: 138
priority: medium
milestone: v1.21
---

## Problem

No `LanguageModelPort` adapter routes agent completions through supervised llama.cpp.

## Solution

OpenAI-compatible HTTP adapter to supervised server; bind model library entries to running instances.

## Acceptance checks

- Adapter honors `constrainedToolCalling` and degraded-mode flags
- Model library entries bind GGUF registry to supervisor
- Integration tests cover readiness failure and recovery
- Sampling params applied where supported
