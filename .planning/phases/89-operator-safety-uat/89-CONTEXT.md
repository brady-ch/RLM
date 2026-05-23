# Phase 89: Operator Safety UAT - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations accepted)

<domain>
## Phase Boundary

Close REG-03 by having an operator complete the WSL memory safety checklist on the Rust-served UI (with live Ollama where applicable), record evidence, and ratchet verification to `passed`. Phases 86–88 landed RAM guards, concurrency mutex, stop unload, and UI memory visibility — this phase consolidates those into an operator checklist without faking sign-off.

</domain>

<decisions>
## Implementation Decisions

### Checklist & Evidence
- Canonical REG-03 checklist in `89-UAT.md` — 7 WSL memory safety rows covering config validation, tier block, plan/run guards, duplicate run, stop unload, WSL stability
- Prior artifacts (86–88 SUMMARYs) remain historical; `89-UAT.md` is the operator-facing checklist for v1.13
- Per-row Result/Notes/Evidence columns; optional screenshots under `evidence/`

### Operator Stack
- `npm run build:ui` → `RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --port 0`
- WSL2 + Ollama on Windows host at `http://127.0.0.1:11434`
- `memory.maxRamMb: 4096` (or lower for testing) in `rlm.config.yaml`

### Autonomous Executor Scope
- Preflight + HTTP smoke + static wiring only; browser rows stay PENDING until operator signs
- Targeted preflight per Phase 72 D-06 pattern — NOT full `npm run check`
- `89-VERIFICATION.md` stays `human_needed` until operator approves; REG-03 not marked Complete in REQUIREMENTS until sign-off

### Verification Ratchet
- Do not auto-approve browser checklist rows or fake operator sign-off
- Resume signal: operator fills Sign-off section and sets `89-UAT.md` frontmatter `operator_signed`

### Claude's Discretion
- Extend `test:reg03:preflight` gate mirroring Phase 81 `test:uat:preflight` pattern
- Add `reg03_uat_smoke.rs` and `reg03-static-wiring.test.ts` for memory guard static contracts

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `crates/rlm-core/src/application/memory/ram_guard.rs` — budget validation and runtime eligibility
- `crates/rlm-core/tests/reg01_uat_smoke.rs` — HTTP smoke pattern for UAT preflight
- `tests/ui/reg01-static-wiring.test.ts` — static UI wiring test pattern
- `tests/application/config/validation.unit.test.ts` — tier estimate vs maxRamMb validation
- `ui/src/run-panel/WorkflowOverview.tsx` — memory budget summary panel
- `ui/src/app/TopBar.tsx` — Run/Resume disabled with `resourceGuard` reason

### Established Patterns
- Phase 81 operator UAT: checklist + preflight + VERIFICATION at `human_needed`
- Phase 72 D-06: targeted preflight, defer full check suite
- Golden fixtures in `tests/fixtures/control-server/session-idle.json` include `resourceGuard`

### Integration Points
- GET `/api/session` returns live `resourceGuard` snapshot
- POST `/api/chat/confirm-run` and `/api/chat/resume-run` return 409 when execution already running
- POST stop triggers `unload_session_models`

</code_context>

<specifics>
## Specific Ideas

- Preflight command block already listed in `89-UAT.md` Automated preflight section
- Operator runbook references `docs/UI.md` WSL memory section (Phase 88)

</specifics>

<deferred>
## Deferred Ideas

- Production code fixes discovered during UAT (gap closure follow-on)
- Full `npm run check` gate for this phase

</deferred>
