---
status: pending_operator
phase: 128-ui-simplification-uat
milestone: v1.19
updated: "2026-05-24T00:00:00Z"
operator_signed: null
---

# Phase 128 — v1.19 UI Product Simplification Operator UAT

Operator checklist for milestone sign-off on the Rust-only stack (Phases 121–127 deliverables).

## Operator Runbook

### Prerequisites

- Linux host with Ollama at `http://127.0.0.1:11434`
- `rlm.config.yaml` with at least one agent and a small model (e.g. `granite4.1:3b`)
- Fresh or pristine session (empty graph triggers first-run launcher)

### Build and serve

```bash
npm run build:ui
RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --port 0
```

Note the printed URL (e.g. `http://127.0.0.1:PORT`). Open in browser.

### Automated preflight (run before manual session)

```bash
npm run test:agent:verify:light
node --import ./scripts/test-ram-preload.mjs --import tsx --test tests/ui/*.test.ts
```

See [128-VERIFICATION.md](./128-VERIFICATION.md) for latest automated results.

## Checklist

| # | Item | Steps | Coverage | Result | Notes | Evidence |
|---|------|-------|----------|--------|-------|----------|
| 1 | First-run launcher | Open UI with pristine session — overlay launcher appears | `first-run-launcher.test.ts`, `reg01-static-wiring.test.ts` | | | |
| 2 | Guided composer | Enter goal in guided composer → Continue to graph creates initial graph | `first-run-launcher.test.ts` (API routes) | human_needed | Browser flow | |
| 3 | Canvas + Run panel | Canvas shows nodes; select node → Run panel shows approve/clarify only | `shell-boundaries.test.ts` | human_needed | Browser flow | |
| 4 | Run/stop TopBar | Run and Stop from TopBar against Rust control server | `reg01-static-wiring.test.ts`, `shell-boundaries.test.ts` | human_needed | Requires Ollama | |
| 5 | Advanced hub tabs | Advanced → Models and Sessions reachable; deleted panels absent (RefineGraph, QualityLoop) | `shell-boundaries.test.ts`, `cut-list-completeness.test.ts` | human_needed | Browser navigation | |
| 6 | Save and reopen | Save session in Advanced → reopen from launcher restores graph | `appshell-decomposition.test.ts`, `first-run-launcher.test.ts` | human_needed | Browser flow | |
| 7 | Theme toggle | Advanced → Settings → theme toggle changes appearance | `shell-boundaries.test.ts` | human_needed | Browser visual | |
| 8 | No domain panels on workflow | Workflow view has no Models/Plugins/Memory/Sessions panels | `shell-boundaries.test.ts`, `appshell-decomposition.test.ts` | automated | Static wiring PASS | See VERIFICATION |

## Milestone timing

**Target:** First-run → successful run under 5 minutes (operator verified).

Record elapsed time in Notes column for item 4.

## Deferred (out of scope v1.19)

| Item | Owner | Notes |
|------|-------|-------|
| Tauri packaged desktop smoke | Phase 135 (v1.20) | Interactive dev-window smoke deferred from Phase 115 |
| Screenshot/visual regression | — | Out of scope per CONTEXT |

## Sign-off

**Operator:** _pending_  
**Date:** _pending_  
**Result:** _pending_

Automated preflight must be green before operator sign-off. Interactive items 2–7 require browser session.
