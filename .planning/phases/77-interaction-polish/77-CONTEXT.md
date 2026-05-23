# Phase 77: Interaction Polish - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations accepted)

<domain>
## Phase Boundary

Verify and ratchet daily canvas/model/run interactions on the Rust-served UI. Recent commits landed canvas rendering, tier assignment UI, tier model refresh, run-stop cancellation, and UI server lock — this phase confirms UX-01–04 via automated tests, operator runbook updates, and verification artifacts. No shell restructure (Phase 78+) or browser UAT sign-off (Phase 81).

</domain>

<decisions>
## Implementation Decisions

### Verification Strategy
- Treat landed commits as the implementation baseline — verify, test, document; do not re-implement working fixes
- Automated gates: `npm run build:ui`, `cargo test` for ui_lock + tier refresh + session seed fixture
- Browser checklist remains Phase 81; Phase 77 only updates runbook prerequisites

### Tier Assignment UX
- Keep editable tier dropdowns in Models panel (legacy/panels for now; extraction deferred to Phase 78)
- Default medium tier should use installed models — document operator step to assign tiers before Plan/Run

### Runbook & Documentation
- Primary serve path: `RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --port 0`
- Document `--stop` and `--replace` for single-instance UI server management
- Update `docs/UI.md` to reflect Rust-first control server (not Node-only narrative)

### Stop / Cancellation
- `stop_run` must call `cancel_running_tasks()` without permanent process shutdown
- Ollama streams check session cancellation controller

### Claude's Discretion
- Exact test placement (unit vs integration) and minimal doc diff scope

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ui/src/main.tsx`, `styles.css`, `ExecutionNodeCard.tsx` — canvas + nodrag fixes
- `ui/src/legacy/panels.tsx` — tier dropdown UI
- `crates/rlm-cli/src/ui_lock.rs` — lock tests (2/2)
- `crates/rlm-core/src/control_server/mod.rs` — `refresh_language_models`, session seed
- `tests/fixtures/control-server/session-idle.json` — seeded root-composer golden

### Established Patterns
- Control-server integration tests in `crates/rlm-core/tests/`
- UAT runbook in `.planning/milestones/v1.10-phases/72-human-uat-sign-off/72-UAT.md`
- Phase verification frontmatter: `status: passed | human_needed | gaps_found`

### Integration Points
- `POST /api/model-library/select-tier` → `refresh_language_models`
- `POST /api/chat/stop-run` → `cancel_running_tasks`
- `rlm ui --stop` / `--replace` via `UiServerLock`

</code_context>

<specifics>
## Specific Ideas

- Operator OOM history: emphasize single UI instance and `rlm ui --stop` in runbook
- WSL memory cap example lives in `scripts/wslconfig.example` — reference in docs

</specifics>

<deferred>
## Deferred Ideas

- Extract panels from legacy/ → Phase 78
- Browser UAT sign-off → Phase 81
- First-run launcher → Phase 80

</deferred>
