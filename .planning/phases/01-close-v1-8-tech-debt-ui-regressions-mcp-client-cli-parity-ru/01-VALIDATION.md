---
phase: 01
slug: close-v1-8-tech-debt-ui-regressions-mcp-client-cli-parity-ru
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-22
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for v1.8 tech debt closure.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Rust `cargo test` (rlm-core, rlm-cli) + `npm run build:ui` / `npm run lint -- ui/src` |
| **Config file** | `crates/rlm-core/Cargo.toml`, `crates/rlm-cli/Cargo.toml` |
| **Quick run command** | `cargo test -p rlm-core -- --nocapture` |
| **Full suite command** | `npm run check:rust && npm run build:ui` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` verify command from the Per-Task Verification Map
- **After every plan wave:** Run `npm run check:rust` (+ `npm run build:ui` after Wave 1)
- **Before phase verification:** `npm run check:rust` + REG-01 operator sign-off (Plan 01-02)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | ENGN-02 | integration | `npm run build:ui && npm run lint -- ui/src` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | MDLH-03 | integration | `npm run build:ui` | ✅ | ⬜ pending |
| 01-01-03 | 01 | 1 | REG-01 | integration | `npm run build:ui && npm run lint -- ui/src` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 2 | REG-01 | manual | Checklist in `61-06-VERIFICATION.md` (archived path) | ✅ | ⬜ pending |
| 01-02-02 | 02 | 2 | REG-01 | doc | Operator sign-off recorded in `01-VERIFICATION.md` | ❌ | ⬜ pending |
| 01-03-01 | 03 | 3 | PLUG-03 | integration | `cargo test -p rlm-core mcp_stdio -- --nocapture` | ❌ Wave 0 | ⬜ pending |
| 01-03-02 | 03 | 3 | PLUG-03 | integration | `cargo test -p rlm-core mcp_stdio -- --nocapture` | ❌ Wave 0 | ⬜ pending |
| 01-03-03 | 03 | 3 | PLUG-03 | integration | `cargo test -p rlm-core mcp_doctor_warning -- --nocapture` | ❌ Wave 0 | ⬜ pending |
| 01-04-01 | 04 | 4 | CLI-01 | integration | `cargo test -p rlm-cli ask -- --nocapture` | ❌ Wave 0 | ⬜ pending |
| 01-04-02 | 04 | 4 | CLI-01 | integration | `cargo test -p rlm-cli ask_smoke -- --nocapture` | ❌ Wave 0 | ⬜ pending |
| 01-04-03 | 04 | 4 | CLI-01 | unit | `cargo test -p rlm-cli -- --nocapture` | ✅ | ⬜ pending |
| 01-05-01 | 05 | 5 | PERS-03 | unit | `cargo test -p rlm-core run_state_persistence -- --nocapture` | ✅ partial | ⬜ pending |
| 01-05-02 | 05 | 5 | PERS-03 | integration | `cargo test -p rlm-core run_state_execution -- --nocapture` | ✅ | ⬜ pending |
| 01-05-03 | 05 | 5 | PERS-03 | doc | `grep -q 'resumeCursor' .planning/phases/01-close-v1-8-tech-debt-ui-regressions-mcp-client-cli-parity-ru/01-VERIFICATION.md` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Scaffold before implementation (TDD where noted in plans):

- [ ] `crates/rlm-core/tests/mcp_stdio.rs` — mock MCP server, tool registration
- [ ] `crates/rlm-core/tests/mcp_doctor_warning.rs` — optional server fail → doctor warning payload
- [ ] `crates/rlm-core/tests/pause_auto_approvals.rs` — 409 on terminal session + pause field
- [ ] `crates/rlm-cli/tests/ask_smoke.rs` — non-stub exit code with QueueModel fixture
- [ ] Extend `run_state_persistence` tests for `resumeCursor` shape

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full REG-01 UI regression on Rust-served shell | REG-01 | Browser/Tauri operator workflow | Follow archived `61-06-VERIFICATION.md` checklist; sign off in `01-02` |

---

## Explicit Deferrals (not phase blockers)

| Item | Requirement | Disposition |
|------|-------------|-------------|
| Session CLI execution | CLI-01 | Remains Node-only (`RLM_RUNTIME=node`) — documented in Plan 01-04 |
| YAML workflow CLI | CLI-01 | Deferred post-phase |
| MCP reload consumer | PERS-03 | Cursor persisted; reload not implemented |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 / manual mapping
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 gaps enumerated
- [x] Feedback latency < 60s for automated tasks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
