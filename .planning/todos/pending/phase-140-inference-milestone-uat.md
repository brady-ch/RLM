---
created: 2026-05-24T00:00:00.000Z
title: Phase 140 — Inference milestone UAT
area: inference
resolves_phase: 140
priority: medium
milestone: v1.21
---

## Problem

v1.21 inference expansion needs operator sign-off before agent-primitives work.

## Solution

UAT covering HF install → llama.cpp supervise → adapter complete → cloud fallback; document GPU matrix and install size.

## Acceptance checks

- End-to-end UAT path passes on operator hardware
- GPU backend smoke tests documented
- Ollama + llama.cpp coexistence decision recorded
- VERIFICATION.md signed
