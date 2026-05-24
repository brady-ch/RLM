---
phase: 120-constrained-ollama-tool-envelope-rust
plan: 03
subsystem: api
tags: [rust, config, ollama, tool-calling]

requires:
  - phase: 120-constrained-ollama-tool-envelope-rust
    provides: adapter envelope path and schema builder
provides:
  - useToolEnvelope host config flag (default false)
  - tool_round_loop response_format wiring when enabled
  - ModelCompletionHost.use_tool_envelope() trait method
affects: [v1.19 UI simplification, operator config]

tech-stack:
  added: []
  patterns:
    - "Opt-in envelope mode disables two-phase constrained_tool_calling"
    - "LanguageModel.use_tool_envelope() default false; Ollama overrides from config"

key-files:
  created: []
  modified:
    - crates/rlm-core/src/domain/recursion/tool_round_loop.rs
    - crates/rlm-core/src/domain/recursive_language_model/engine_hosts.rs
    - crates/rlm-core/src/control_server/mod.rs
    - crates/rlm-core/src/adapters/ollama_language_model/mod.rs
    - crates/rlm-core/tests/domain/recursion/tool_round_loop.rs
    - tests/fixtures/persistence/default-project-config.json

key-decisions:
  - "useToolEnvelope default false preserves existing two-phase behavior"
  - "constrained_tool_calling false when envelope enabled to avoid double constraint"

patterns-established:
  - "Host YAML useToolEnvelope plumbed through resolve_ollama_host to OllamaLanguageModel"

requirements-completed: [RETIRE-120-04, RETIRE-120-05]

duration: 10min
completed: 2026-05-24
---

# Phase 120 Plan 03: Config Gate and Orchestration Summary

**useToolEnvelope config gates envelope mode through tool_round_loop while preserving legacy two-phase path when off**

## Performance

- **Duration:** 10 min
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `useToolEnvelope` to host config and `OllamaLanguageModel`
- Wired `build_tool_envelope_schema` into `run_completion_with_tool_rounds` when enabled
- Added `ModelCompletionHost::use_tool_envelope()` with EngineHost delegation
- Integration tests for envelope on/off options and unknown-tool error path

## Task Commits

1. **Task 1+2: Config gate and orchestration** - `cf09b85` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- tests/fixtures/persistence/default-project-config.json useToolEnvelope: FOUND
- Commit cf09b85: FOUND

---
*Phase: 120-constrained-ollama-tool-envelope-rust*
*Completed: 2026-05-24*
