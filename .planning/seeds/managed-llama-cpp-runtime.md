---
title: Managed llama.cpp Runtime
planted_date: 2026-05-14
trigger_condition: "After local Hugging Face GGUF model browsing, installation, registry, and external-runtime handoff are stable"
status: active
---

## Intent

Move from downloading and registering local GGUF models to supervising a llama.cpp runtime process for one-click local model use.

The long-term experience should let a developer download a compatible Hugging Face GGUF model, start it through RLM, see runtime readiness, and use it in agent/model overrides without separately managing an external server.

## Notes

- Start with external llama.cpp or Ollama-compatible runtime handoff before bundling native runtime binaries.
- Keep runtime availability, model install status, and hardware suitability as separate visible states.
- Future managed runtime should support start, stop, restart, crash detection, idle unload, port selection, log capture, and readiness checks.
- Platform-specific GPU acceleration and native binary distribution should be treated as release-hardening work, not a prerequisite for the first Hugging Face installer.

