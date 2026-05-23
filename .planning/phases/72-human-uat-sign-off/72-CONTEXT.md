# Phase 72: Human UAT Sign-off — Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Source:** Auto-generated (--auto mode, infrastructure/verification phase)

<domain>
## Phase Boundary

Close REG-01 by having an operator complete the Phase 61 human UAT checklist on the Rust-served UI (with live Ollama where applicable), record evidence, and ratchet Phase 62 verification from `human_needed` to passed. No new product features — verification artifacts and targeted preflight only.

</domain>

<decisions>
## Implementation Decisions

### Checklist source (D-01)
- Canonical checklist: `.planning/milestones/v1.8-phases/61-ui-shell-rewrite/61-06-VERIFICATION.md` items 1–7
- Merge Phase 62 human items: pause future auto-approvals during run, HF model install from Advanced → Models, canvas-first shell unchanged (from `.planning/milestones/v1.9-phases/62-ui-regression-fixes/62-VERIFICATION.md`)

### Operator stack (D-02)
- Build UI: `npm run build:ui`
- Serve Rust control server with static assets: `RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --port 0`
- Open URL printed to stderr (`RLM UI listening at http://127.0.0.1:{port}`)
- Live Ollama required for Run/Stop and end-to-end workflow items where checklist says "if API keys configured" / "live Ollama"

### Evidence format (D-03)
- Record per-item results in `.planning/phases/72-human-uat-sign-off/72-UAT.md` using columns: `# | Item | Steps | Result | Notes | Evidence`
- Result values: `PASS`, `FAIL`, `SKIP` (SKIP requires reason — e.g. Ollama unavailable)
- Evidence: screenshot path, timestamp note, or equivalent operator note

### Ollama-dependent items (D-04)
- Items requiring live model host (Run/Stop, e2e workflow) must be `PASS` with live Ollama when operator has it available
- `SKIP` only when Ollama truly unavailable; document reason in Notes column
- Phase success requires all non-Ollama items PASS; Ollama items PASS when host available per REG-01 wording "where applicable"

### Verification ratchet (D-05)
- On operator sign-off, update frontmatter `status` to `passed` or `operator_signed` in:
  - `.planning/milestones/v1.8-phases/61-ui-shell-rewrite/61-06-VERIFICATION.md`
  - `.planning/milestones/v1.8-phases/61-ui-shell-rewrite/61-VERIFICATION.md` (REG-01 row)
  - `.planning/milestones/v1.9-phases/62-ui-regression-fixes/62-VERIFICATION.md`
  - `.planning/phases/72-human-uat-sign-off/72-VERIFICATION.md` (create)
  - `.planning/REQUIREMENTS.md` — REG-01 status Pending → Complete

### Test scope (D-06)
- Full test suite (`npm run check`) DEFERRED for this phase per workflow.test_command
- Targeted preflight only: `npm run build:ui`, `npm run lint -- ui/src`, `cargo check -p rlm-cli -p rlm-core`, approval-mode contract test, Rust route grep for Phase 62 endpoints

### Claude's Discretion
- Exact evidence filenames under `.planning/phases/72-human-uat-sign-off/evidence/` if operator attaches screenshots
- Whether to add a lightweight HTTP smoke script vs manual curl checks in preflight

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UAT checklists
- `.planning/milestones/v1.8-phases/61-ui-shell-rewrite/61-06-VERIFICATION.md` — Phase 61 REG-01 human steps (primary)
- `.planning/milestones/v1.9-phases/62-ui-regression-fixes/62-VERIFICATION.md` — Phase 62 deferred human items
- `.planning/milestones/v1.8-phases/01-close-v1-8-tech-debt-ui-regressions-mcp-client-cli-parity-ru/01-02-VERIFICATION.md` — evidence table pattern

### UI / server wiring
- `crates/rlm-cli/src/commands/ui.rs` — Rust UI server entry
- `crates/rlm-core/src/control_server/routes.rs` — `/api/pause-future-auto-approvals`, `/api/model-library/download`
- `ui/src/app/TopBar.tsx` — pause control
- `ui/src/legacy/panels.tsx` — HF download branch

### Requirements
- `.planning/REQUIREMENTS.md` — REG-01 definition

</canonical_refs>

<specifics>
## Specific Ideas

- Prior Phase 1 UAT (01-02-VERIFICATION.md) used auto-approved static verification for CI; Phase 72 requires genuine operator sign-off for REG-01 closure — do not auto-approve human checkpoint
- Phase 62 summary notes REG-01 partial (automated only); this phase completes the human portion

</specifics>

<deferred>
## Deferred Ideas

- Full `npm run check` gate in this phase
- UI resume wiring (Phase 73)
- Code fixes discovered during UAT — file as gap closure / follow-on phase, not scope here

</deferred>

---

*Phase: 72-human-uat-sign-off*
*Context gathered: 2026-05-22 via plan-phase --auto*
