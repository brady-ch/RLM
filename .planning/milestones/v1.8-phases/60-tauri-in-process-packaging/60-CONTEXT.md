# Phase 60: Tauri In-Process + Packaging - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — auto-accepted)

<domain>
## Phase Boundary

Embed Rust control server in Tauri (no Node child), update release packaging for Rust-only bundle, document Ollama readiness check.

</domain>

<decisions>
## Implementation Decisions

### Tauri Runtime
- `start_server` in-process on ephemeral port; navigate webview to loopback URL
- Graceful shutdown on window close via EmbeddedRuntime
- Ollama readiness check with optional `RLM_MANAGE_OLLAMA=1`

### Packaging
- `build-release.mjs` stages Rust binary + ui-dist (no Node bundle)
- Tauri package kept outside Cargo workspace (standalone `[workspace]`)

### Claude's Discretion
- Platform tag resolution for dev vs release roots

</decisions>

<code_context>
## Existing Code Insights

- Prior Tauri spawned Node child — replaced with rlm_core server
- `scripts/packaging/build-release.mjs` — updated for cargo build

</code_context>

<specifics>
## Specific Ideas

Full `.deb` smoke requires Linux desktop build deps (glib, dbus) — human verification on CI runner.

</specifics>

<deferred>
## Deferred Ideas

Windows/macOS signed packages (INFR-06)

</deferred>
