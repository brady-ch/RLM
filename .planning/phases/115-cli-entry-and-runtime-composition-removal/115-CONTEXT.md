# Phase 115: CLI Entry and Runtime Composition Removal - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — autonomous --auto)

<domain>
## Phase Boundary

Delete Node CLI entry and runtime composition. Rust `rlm-cli` is sole CLI. Delete `src/index.ts`, `src/cli/`, `src/runtime/`. Do not delete application/domain/adapters yet (Phase 116+).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Follow 113-AUDIT.md paths and 113-GATES.md verification. `scripts/rlm-runtime.mjs` already defaults to Rust. Ensure `npm rlm ask` and all shipped subcommands work via Rust CLI. Tauri must launch Rust server without Node child process.

</decisions>

<code_context>
## Existing Code Insights

- `scripts/rlm-runtime.mjs` dispatches to Rust by default
- `crates/rlm-cli/` is sole CLI implementation target
- Phase 114 removed TS control server

</code_context>

<specifics>
## Specific Ideas

ROADMAP success criteria:
1. `src/index.ts`, `src/cli/`, `src/runtime/` deleted
2. `npm rlm ask` invokes Rust CLI end-to-end
3. Tauri launches Rust server without Node child
4. All shipped subcommands via `rlm-cli`

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
