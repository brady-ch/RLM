# Phase 114: Control Server and UI Bootstrap Removal - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped in autonomous --auto mode)

<domain>
## Phase Boundary

Delete TypeScript control server and TS UI bootstrap paths. Rust Axum server becomes sole HTTP transport for UI. Do not delete CLI, application, domain, or other layers — those are Phase 115+.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices at Claude's discretion. Follow `113-AUDIT.md` for deletion paths and `113-GATES.md` for verification commands.

Key constraints:
- Delete `src/application/control-server/` and related TS bootstrap wiring
- Remove parity scripts that boot TS server
- Golden fixtures (`control_server_matches_golden_fixtures`) must pass after deletion
- `RLM_UI_DIST=ui/dist cargo run -p rlm-cli -- ui` must serve all UI API routes
- Keep `ui/` React source intact

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Rust Axum control server in `crates/rlm-core/src/control_server/`
- Golden fixtures test in rlm-core
- Phase 113 audit inventory at `113-AUDIT.md`

### Established Patterns
- Incremental deletion with cargo test gate after each step
- UI dev proxy may need update to point at Rust server only

### Integration Points
- Tauri uses in-process Rust server
- Vite dev server proxy configuration
- CI parity scripts referencing TS server

</code_context>

<specifics>
## Specific Ideas

Success criteria from ROADMAP:
1. `src/application/control-server/` deleted
2. Rust UI command serves all API routes
3. Golden fixtures pass
4. No TS server boot in parity scripts

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
