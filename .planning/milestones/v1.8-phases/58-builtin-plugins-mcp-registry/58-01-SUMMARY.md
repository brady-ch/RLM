---
phase: 58-builtin-plugins-mcp-registry
plan: 01
subsystem: plugins
tags: [rust, plugins, extension-host, registry, builtins]

requires:
  - phase: 57-model-hosts-model-library
    provides: RouterState wiring pattern
provides:
  - ExtensionHost + builtin tools (shell, write_file, web_search, web_fetch)
  - PluginRegistryService with catalog, remote fetch, doctor
  - /api/plugins/* control-server routes
  - RuntimeContext with COMPOSITION_INIT_ORDER
affects: [59-cli, 60-packaging]

requirements-completed: [PLUG-01, PLUG-02, PLUG-03, PLUG-04]

duration: 120min
completed: 2026-05-22
---

# Phase 58 Plan 01: Built-in Plugins + MCP + Registry Summary

**Rust plugin system with builtin tools, registry service, and control-server admin routes.**

## Accomplishments

- `ExtensionHost` + builtin tools with guarded shell, workspace write, web search/fetch
- `PluginRegistryService` — manifest validation, discovery order, install/enable/disable/uninstall/doctor
- `remote_fetch` — HTTPS archive + git fetch with zip-slip and size limits
- `/api/plugins/*` routes wired in Axum
- `build_runtime_context` with v1.7 init order test
- Tools wired into graph executor via `resolve_tools_for_agent`

## Fixes During Recovery

- Replaced const `BUILTIN_PLUGINS` with runtime `builtin_plugins()` fn
- Plugin registry wiring gated on explicit config path (golden fixture parity)
- Clippy/fmt cleanup

## Self-Check: PASSED

- `npm run check:rust` green
- `cargo test -p rlm-core` — 67+ tests pass
