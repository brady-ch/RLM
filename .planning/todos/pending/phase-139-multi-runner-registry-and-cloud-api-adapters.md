---
created: 2026-05-24T00:00:00.000Z
title: Phase 139 — Multi-runner registry and cloud API adapters
area: inference
resolves_phase: 139
priority: medium
milestone: v1.21
---

## Problem

Runner registry is Ollama-centric; cloud APIs and optional vLLM not unified under sampling cascade.

## Solution

Extend runner registry with cloud HTTP adapters and optional vLLM; uniform `runnerKind` metadata.

## Acceptance checks

- Cloud API adapters (OpenAI/Anthropic/OpenRouter) wired
- Optional vLLM behind advanced settings
- Sampling cascade uniform across runners
- Unsupported params surfaced in UI
