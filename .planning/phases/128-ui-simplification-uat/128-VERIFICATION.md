---
status: human_needed
phase: 128
plan: 01
automated: passed
operator: pending
updated: "2026-05-25T05:58:00Z"
---

# Phase 128 Verification

## Goal

Operator UAT on Rust-only stack for v1.19 milestone sign-off; automated preflight green; interactive browser items documented for operator.

## Overall status

| Gate | Status | Notes |
|------|--------|-------|
| Automated preflight | **passed** | `verify:light` + all `tests/ui/*.test.ts` (36/36) |
| Static UAT contracts | **passed** | See static contract table |
| Interactive browser UAT | **human_needed** | Items 2–7 in [128-UAT-CHECKLIST.md](./128-UAT-CHECKLIST.md) |
| Tauri desktop smoke | **human_needed** | Deferred to v1.20 Phase 135 |
| Milestone timing (≤5 min) | **human_needed** | Operator records elapsed time on item 4 |

## Must-haves

| ID | Requirement | Status |
|----|-------------|--------|
| UI-128-01 | UAT checklist covers first-run → graph → run → Advanced → save/reopen | ✅ PASS — 8 items in checklist |
| UI-128-02 | Automated preflight passes | ✅ PASS — see Automated checks |
| UI-128-03 | Bundle comparison vs Phase 121 baseline documented | ✅ PASS — see Bundle comparison |
| UI-128-04 | human_needed documented for interactive/Tauri items | ✅ PASS — see Human verification |
| UI-128-05 | ui/src unchanged (UAT-only phase) | ✅ PASS — `git diff --quiet ui/src/` |

## Success criteria (ROADMAP)

1. UAT checklist covers first-run → graph → run → Advanced → save/reopen — ✅
2. First-run to successful run under 5 minutes (operator verified) — ⏳ human_needed
3. VERIFICATION.md signed — ⏳ automated signed; operator sign-off pending

## Bundle comparison

| Metric | Phase 121 baseline | Post-127 (workflow-first lazy) | Delta vs 121 |
|--------|-------------------|-------------------------------|--------------|
| Main JS | 522.60 kB | **480.34 kB** | **−42.26 kB (−8.1%)** |
| CSS | 45.52 kB | 42.22 kB | −3.30 kB |

Source: Phase 127 verification; Phase 121 bundle baseline from `121-VERIFICATION.md`.

### Deferred Advanced chunks (Phase 127)

| Chunk | Size (minified) |
|-------|-----------------|
| AdvancedHub | 2.68 kB |
| ModelsView | 3.93 kB |
| SessionsView | 3.34 kB |
| PluginsView | 5.64 kB |
| MemoryView | 2.89 kB |
| SettingsView | 14.33 kB |

## Automated checks

| Command | Result | Notes |
|---------|--------|-------|
| `npm run test:agent:verify:light` | PASS | 3/3 steps — 2026-05-25 |
| `node --import ./scripts/test-ram-preload.mjs --import tsx --test tests/ui/*.test.ts` | PASS | 36/36 tests |

### Static contract checks

| UAT item | Result | Evidence |
|----------|--------|------------|
| 1 First-run launcher wiring | PASS | `first-run-launcher.test.ts`, `reg01-static-wiring.test.ts` |
| 2 Guided composer APIs | PASS | `first-run-launcher.test.ts` (root-composer routes) |
| 3 Run panel approve/clarify only | PASS | `shell-boundaries.test.ts` RunPanel test |
| 4 TopBar run/stop routes | PASS | `reg01-static-wiring.test.ts`, `shell-boundaries.test.ts` |
| 5 Advanced tabs lazy-loaded | PASS | `shell-boundaries.test.ts` lazy Advanced tests |
| 6 Sessions save/reopen APIs | PASS | `appshell-decomposition.test.ts` SessionsView fetch |
| 7 Theme toggle in Advanced Settings | PASS | `shell-boundaries.test.ts` ThemeToggle test |
| 8 No domain panels on workflow | PASS | `shell-boundaries.test.ts`, `appshell-decomposition.test.ts` |
| Cut list completeness | PASS | `cut-list-completeness.test.ts` (includes AdvancedLoadingFallback) |
| AppShell decomposition | PASS | `appshell-decomposition.test.ts` (<200 lines, no domain fetches) |
| Styles modularization | PASS | `styles-modularity.test.ts` |

## Test drift fixes (Rule 3)

During preflight, 3 stale tests failed due to Phase 125–127 refactors:

| Test | Fix |
|------|-----|
| `cut-list-completeness.test.ts` | Added `AdvancedLoadingFallback.tsx` row to `121-CUT-LIST.md` |
| `first-run-launcher.test.ts` | Assert `isPristineFirstRunGraph` in `useViewRouter.ts`; styles in `workflow.css` |

## Human verification

**Status:** `human_needed`

Interactive browser session required for:

1. **End-to-end flow** — first-run launcher → guided composer → graph → select node → approve/run → stop
2. **Advanced navigation** — Models and Sessions tabs reachable; RefineGraphPanel and QualityLoopInspector absent
3. **Save/reopen** — persist session and restore from launcher picker
4. **Theme toggle** — visual confirmation in Advanced Settings
5. **Timing** — record first-run to successful run elapsed time (target ≤5 min)

**Tauri smoke (deferred):** Packaged desktop interactive smoke remains deferred to Phase 135 (v1.20). Phase 115 Tauri dev-window item stays in deferred backlog.

**Operator runbook:** [128-UAT-CHECKLIST.md](./128-UAT-CHECKLIST.md)

## Code review

See [128-REVIEW.md](./128-REVIEW.md) — documentation-only phase; test drift fixes only.
