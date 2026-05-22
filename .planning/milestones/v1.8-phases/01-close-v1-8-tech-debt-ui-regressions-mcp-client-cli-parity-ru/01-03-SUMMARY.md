---
phase: 01-close-v1-8-tech-debt-ui-regressions-mcp-client-cli-parity-ru
plan: 03
subsystem: interop
tags: [mcp, stdio, json-rpc, plugins]
requires:
  - phase: 01-02
    provides: REG-01 sign-off baseline
provides:
  - Rust StdioMcpClient with Content-Length framing
  - MCP tool registration on ExtensionHost
  - Doctor warnings for disconnected optional servers
key-files:
  created:
    - crates/rlm-core/src/interop/mcp_stdio_client.rs
    - crates/rlm-core/src/interop/mcp_tools.rs
    - crates/rlm-core/tests/mcp_stdio.rs
    - crates/rlm-core/tests/mcp_doctor_warning.rs
  modified:
    - crates/rlm-core/src/plugins/runtime.rs
    - crates/rlm-core/src/control_server/routes.rs
requirements-completed: [PLUG-03]
duration: 25min
completed: 2026-05-22
---

# Phase 1 Plan 03: MCP stdio client Summary

**Ported TS StdioMcpClient to Rust and wired MCP tools into build_runtime_context with doctor disconnect warnings.**

## Task Commits

1. **Task 1: StdioMcpClient port and mock server test** - `abc0c8e`
2. **Task 2: MCP tool wrappers and runtime wiring** - `0ba7f02`
3. **Task 3: Doctor/interop disconnect warning** - `0ba7f02`

## Deviations from Plan

None.

## Self-Check: PASSED
