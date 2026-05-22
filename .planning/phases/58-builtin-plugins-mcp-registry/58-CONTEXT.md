# Phase 58: Built-in Plugins + MCP + Registry - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations auto-accepted)

<domain>
## Phase Boundary

Port builtin tools, plugin registry service, and MCP/skill interop init to Rust with v1.7 trust, discovery order, and `/api/plugins/*` parity.

</domain>

<decisions>
## Implementation Decisions

### Builtin Tools
- Implement shell, write_file, web_search, web_fetch as Rust `ToolPort` adapters under `crates/rlm-core/src/plugins/builtin/`
- Match v1.7 guard semantics: path policies for write_file, command allowlists for shell, HTTP timeouts for web tools

### Plugin Registry
- Port `PluginRegistryService` semantics from TS: list/install/enable/disable/uninstall/doctor/inspect/validate
- Discovery order: builtins → configured → installed catalog at `~/.rlm/plugins/`
- Manifest validation before load; `requiresRestart: true` on state-changing ops

### Control Server Routes
- Expand `/api/plugins` beyond empty stub to full admin surface matching TS handlers
- Golden fixture `plugins-list-empty.json` preserved for unconfigured/minimal state

### MCP/Interop
- Wire init order test: plugins → interop → tools resolver → agent registry → models
- MCP client can be minimal stub if full port exceeds phase scope; document in VERIFICATION

### Claude's Discretion
- Remote fetch security (zip-slip, size limits) — port from TS `src/plugins/` fetch logic
- Exact route path mapping from TS control-server handlers

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- TS: `src/plugins/builtin/`, `src/application/plugins/`, `src/runtime/interop/`
- Rust stub: `plugins_list_empty()` in control_server/routes.rs
- Engine tool rounds: `domain/recursion/tool_round_loop.rs`

### Established Patterns
- Port/adapter split in `crates/rlm-core/src/ports/` and `adapters/`
- RouterState wires services from project config

</code_context>

<specifics>
## Specific Ideas

No React changes. Plugin panel consumes same JSON as v1.7.

</specifics>

<deferred>
## Deferred Ideas

- WASM/subprocess external plugin bridge (INFR-02)

</deferred>
