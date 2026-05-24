---
phase: 120-constrained-ollama-tool-envelope-rust
plan: 02
subsystem: api
tags: [rust, ollama, format, constrained-decoding]

requires:
  - phase: 120-constrained-ollama-tool-envelope-rust
    provides: tool_envelope schema builder and parser
provides:
  - Ollama chat body format-only path (no tools+format)
  - complete() envelope branch with temperature 0
  - Envelope content mapped to LanguageModelResponse
affects: [120-03, tool_round_loop]

tech-stack:
  added: []
  patterns:
    - "format and tools mutually exclusive in build_chat_body (ollama#8095)"
    - "Envelope path takes priority over two-phase constrained path"

key-files:
  created: []
  modified:
    - crates/rlm-core/src/adapters/ollama_language_model/mod.rs
    - crates/rlm-core/src/adapters/ollama_language_model/request.rs
    - crates/rlm-core/src/adapters/ollama_language_model/response.rs
    - crates/rlm-core/tests/adapters/ollama_language_model.rs

key-decisions:
  - "Envelope requests use temperature 0; default temperature unchanged for legacy path"
  - "Parse errors surface as failed inference content, empty tool_calls"

patterns-established:
  - "response_format Some triggers single chat_stream with format, never tools"

requirements-completed: [RETIRE-120-03]

duration: 12min
completed: 2026-05-24
---

# Phase 120 Plan 02: Ollama Adapter Envelope Path Summary

**Ollama adapter sends JSON Schema format without tools array and maps envelope JSON to content or tool_calls**

## Performance

- **Duration:** 12 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extended `build_chat_body` with exclusive format vs tools
- Added highest-priority envelope branch in `complete()`
- Mapped parsed envelope to `LanguageModelResponse` via `map_envelope_content`
- Eight adapter unit tests including format/tools exclusivity and parse mapping

## Task Commits

1. **Task 1+2: Adapter envelope path** - `72f138d` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- All modified adapter files: FOUND
- Commit 72f138d: FOUND

---
*Phase: 120-constrained-ollama-tool-envelope-rust*
*Completed: 2026-05-24*
