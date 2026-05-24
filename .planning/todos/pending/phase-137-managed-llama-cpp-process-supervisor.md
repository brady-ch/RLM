---
created: 2026-05-24T00:00:00.000Z
title: Phase 137 — Managed llama.cpp process supervisor
area: inference
resolves_phase: 137
priority: medium
milestone: v1.21
---

## Problem

GGUF artifacts can be downloaded but no supervised llama.cpp process manages inference lifecycle.

## Solution

Implement child-process supervisor: start/stop/restart, crash detection, idle unload, port selection, readiness, log capture.

## Acceptance checks

- Lifecycle controls implemented and API-visible
- Readiness checks gate adapter use (Phase 138)
- GPU backend matrix documented per platform
- Crash recovery path tested
