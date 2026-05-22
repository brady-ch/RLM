# Phase 62: UI Regression Fixes - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous --auto)

<domain>
## Phase Boundary

Close Phase 61 integration regressions and sign REG-01 human UAT before deeper Rust parity work.

</domain>

<decisions>
## Implementation Decisions

### Pause auto-approvals
Restore TopBar control wired to `POST /api/pause-future-auto-approvals` when running with `initial-plan-recursive` approval mode.

### HF model download
ModelLibraryRow must call `/api/model-library/download` for `source=huggingface` entries; curated entries use `/api/model-library/install`.

### REG-01 contract test
Update approval-mode contract test to read labels from `ui/src/shared/api.ts` and quality-loop UI from `ui/src/legacy/panels.tsx` after Phase 61 shell moved code out of `main.tsx`.

### UAT
Update 61-06-VERIFICATION with Phase 62 automated gate results; human UAT deferred with operator sign-off note in 62-VERIFICATION.

</decisions>

<code_context>
## Existing Code Insights

- TopBar.tsx already contains pause-auto-approvals button (working tree)
- ModelLibraryRow already routes huggingface to download endpoint (working tree)
- Rust routes exist for both endpoints in control_server/routes.rs

</code_context>

<specifics>
## Specific Ideas

Fix failing `approval mode contract` test; run `npm run check` green.

</specifics>

<deferred>
## Deferred Ideas

Live Ollama human UAT sign-off — operator validates when control server available.

</deferred>
