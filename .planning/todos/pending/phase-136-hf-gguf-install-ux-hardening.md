---
created: 2026-05-24T00:00:00.000Z
title: Phase 136 — HF GGUF install UX hardening
area: inference
resolves_phase: 136
priority: medium
milestone: v1.21
---

## Problem

HF GGUF download/registry exists in Rust but install UX, doctor flows, and `runnerKind` metadata are not ready for llama.cpp binding.

## Solution

Harden model library browse/install/doctor; tag registry records with runner metadata for Phase 137 supervisor.

## Acceptance checks

- Model library UI covers search, install progress, failures, doctor
- Registry records include `runnerKind` and artifact path
- Install size and RAM suitability surfaced pre-download
- `cargo test -p rlm-core` model_library tests pass
