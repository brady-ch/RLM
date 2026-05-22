---
created: 2026-05-22T00:00:00.000Z
title: Rust functional debt — Wave 1
area: rust-runtime
priority: high
source: "$gsd-explore rust architecture"
---

## Problem

v1.8 shipped Rust runtime with documented partial deferrals: simplified quality loop, write-only resume cursor, MCP-only interop (no skills), partial CLI, UI regressions from Phase 61 shell, PACK-03 CI gap.

## Recommended order

F5 → F1 → F2 → F3 → F4 → F6 (F6 can run in parallel with F3/F4).

---

### F5 — UI regressions (Phase 62)

- [ ] Restore TopBar pause-auto-approvals control → `POST /api/pause-future-auto-approvals`
- [ ] Wire ModelLibraryRow install to `POST /api/model-library/download` (fix curated source path)
- [ ] Complete and sign `61-06-VERIFICATION.md` REG-01 human UAT checklist

**Acceptance:** v1.8 audit integration gaps for ENGN-02 pause control and MDLH-03 download closed; REG-01 UAT signed.

---

### F1 — Quality loop parity (Phase 63 / ENGN-01 debt)

- [ ] Port `src/domain/recursion/quality-loop.ts` to `crates/rlm-core/src/domain/recursion/quality_loop.rs`
- [ ] Replace draft-only `run_quality_loop_path` with full phase loop (draft, critique, refine, gate, best-of)
- [ ] Preserve per-phase model routing, iteration metadata, manual exit, budget behavior
- [ ] Fix session readiness JSON drift (`"empty"` string vs TS structured object)
- [ ] Add parity tests against Node strangler fixtures

**Acceptance:** Quality-loop-enabled agents show inspectable iteration/phase history in graph UI; golden tests pass.

---

### F2 — Cross-session resume consumer (Phase 64 / PERS-03)

- [ ] Introduce `RunStateStorePort` in `ports/` (feeds A1 boundary fix)
- [ ] Resume loader at graph execution entry: read `resumeCursor` + `nodeStatuses`, skip completed nodes
- [ ] Detect run variant (`playbook` vs `pipeline`) from session metadata
- [ ] Control-server resume endpoint with explicit user confirmation
- [ ] Align TS `RunStatePersistence` to write same cursor shape
- [ ] Integration test: partial run → process restart → resume → complete

**Acceptance:** User can continue interrupted run after app restart without re-executing completed nodes. See `PERS-03-GAP.md`.

---

### F3 — Skill interop depth (Phase 65 / PLUG-03)

- [ ] Port skill discovery + path policies from `src/runtime/interop/mcp-skill-runtime.ts`
- [ ] Add `crates/rlm-core/src/interop/skill_runtime.rs` (or equivalent module)
- [ ] Register `skill` tool in interop init (preserve `COMPOSITION_INIT_ORDER`)
- [ ] Wire manifest `skillLoaders` through extension host
- [ ] Doctor warnings for invalid skill paths
- [ ] Tests: load fixture skill; reject policy violation

**Acceptance:** `rlm.config.yaml` skills block works in Rust runtime matching Node behavior.

---

### F4 — Full CLI parity (Phase 66 / CLI-01)

- [ ] Port Node `args.ts` flag surface to `rlm-cli` clap (approval modes, plan-only, workflow, agent, session/memory flags)
- [ ] Implement `plan-node`, `workflow-export`, `workflow-import` (remove `not_implemented` stubs)
- [ ] Extend `ask` with full config/execution flags
- [ ] Expand `ask_smoke` and add per-command integration tests
- [ ] Update parity CI gate for new commands

**Acceptance:** All README run modes work with `RLM_RUNTIME=rust` without Node fallback.

---

### F6 — PACK-03 packaging smoke (Phase 67)

- [ ] Add headless CI job (Docker or `xvfb-run`) for `.deb` install + binary smoke
- [ ] Document skip behavior for dev hosts without GTK/dbus

**Acceptance:** Release CI validates `.deb` artifact without manual GTK setup.
