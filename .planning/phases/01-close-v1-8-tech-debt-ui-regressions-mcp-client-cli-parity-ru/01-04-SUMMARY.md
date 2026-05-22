---
phase: 01-close-v1-8-tech-debt-ui-regressions-mcp-client-cli-parity-ru
plan: 04
subsystem: cli
tags: [ask, bootstrap, recursive-engine]
requires:
  - phase: 01-03
    provides: MCP-enabled build_runtime_context
provides:
  - prepare_ask_execution bootstrap helper
  - Working rlm ask command on Rust path
key-files:
  created:
    - crates/rlm-core/src/bootstrap/cli_runtime.rs
    - crates/rlm-cli/tests/ask_smoke.rs
  modified:
    - crates/rlm-cli/src/commands/ask.rs
    - crates/rlm-cli/src/main.rs
requirements-completed: [CLI-01]
duration: 20min
completed: 2026-05-22
---

# Phase 1 Plan 04: Rust CLI ask Summary

**Replaced ask stub with RecursiveLanguageModel execution via shared CLI bootstrap; workflow CLI remains staged.**

## Task Commits

1. **Task 1: Extract CLI bootstrap helper** - `bda3d9a`
2. **Task 2: Implement rlm ask command** - `a43b441`
3. **Task 3: Ask smoke test** - `a43b441`

## Deviations from Plan

Workflow full parity deferred — use `rlm ui` or `RLM_RUNTIME=node` for graph workflows (documented in plan scope).

## Self-Check: PASSED
