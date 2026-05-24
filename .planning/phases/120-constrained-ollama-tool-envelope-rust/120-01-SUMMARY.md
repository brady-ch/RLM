---
phase: 120-constrained-ollama-tool-envelope-rust
plan: 01
subsystem: api
tags: [rust, ollama, json-schema, tool-calling, serde]

requires:
  - phase: 119-npm-toolchain-and-ci-rust-only-cleanup
    provides: Rust-only runtime and test gates
provides:
  - response_format on LanguageModelCompleteOptions
  - build_tool_envelope_schema Option A JSON Schema builder
  - parse_envelope_response with typed EnvelopeError
affects: [120-02, 120-03, ollama adapter, tool_round_loop]

tech-stack:
  added: []
  patterns:
    - "Per-tool oneOf branches with const tool name for GBNF discrimination"
    - "Closed allowlist validation at parse time before tool dispatch"

key-files:
  created:
    - crates/rlm-core/src/domain/recursion/tool_envelope.rs
    - crates/rlm-core/tests/domain/recursion/tool_envelope.rs
  modified:
    - crates/rlm-core/src/ports/language_model.rs
    - crates/rlm-core/src/domain/recursion/mod.rs

key-decisions:
  - "Per-tool const branches in choice.oneOf instead of single tool enum (cleaner args discrimination per TOOL-CALLING Option A)"
  - "EnvelopeError typed variants; no silent fallback on malformed JSON"

patterns-established:
  - "Option A envelope: choice.oneOf with final branch and per-tool tool_call branches"

requirements-completed: [RETIRE-120-01, RETIRE-120-02]

duration: 15min
completed: 2026-05-24
---

# Phase 120 Plan 01: Tool Envelope Module Summary

**JSON Schema envelope builder and parser with response_format port field for Ollama constrained decoding**

## Performance

- **Duration:** 15 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `response_format: Option<Value>` to `LanguageModelCompleteOptions`
- Implemented `build_tool_envelope_schema` with final and per-tool tool_call branches
- Implemented `parse_envelope_response` rejecting unknown tools and invalid JSON
- Five unit tests covering schema shape and parse behavior

## Task Commits

1. **Task 1+2: Envelope module (RED/GREEN)** - `8eb23c1` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- crates/rlm-core/src/domain/recursion/tool_envelope.rs: FOUND
- crates/rlm-core/tests/domain/recursion/tool_envelope.rs: FOUND
- Commit 8eb23c1: FOUND

---
*Phase: 120-constrained-ollama-tool-envelope-rust*
*Completed: 2026-05-24*
