---
status: operator_signed
phase: 89-operator-safety-uat
requirement: REG-03
updated: "2026-05-23T23:59:00Z"
operator_signed: "2026-05-23T23:59:00Z"
operator: Brady
environment_note: "Native Linux — item 7 SKIP (D-05)"
---

# Phase 89 — REG-03 Operator Safety UAT Checklist (v1.13)

WSL memory safety checklist for milestone v1.13 Runtime Safety & WSL Hardening.

## Operator environment (2026-05-23)

**D-05:** Operator is not on WSL and cannot exercise WSL VM stability (checklist item 7). Items **1–6** verified on **native Linux** with local Ollama (`http://127.0.0.1:11434`). WSL auto-cap behavior (MEM-03) covered by automated `ram_guard` tests.

## Operator Runbook

### Prerequisites

- Linux host with Ollama (`http://127.0.0.1:11434`)
- `rlm.config.yaml` with `memory.maxRamMb: 4096` (or lower for testing)
- Models: `granite4.1:3b` installed for small/medium tiers

### Build and serve

```bash
npm run build:ui
RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --port 0
```

See also: [docs/UI.md](../../../docs/UI.md) — WSL memory section.

### Automated preflight

```bash
npm run test:reg03:preflight
```

## Checklist

| # | Item | Steps | Result | Notes | Evidence |
|---|------|-------|--------|-------|----------|
| 1 | Config validation | Set a tier `estimatedRamMb` above `maxRamMb`; start UI — config load fails with clear error | PASS | Native Linux | Operator sign-off 2026-05-23 |
| 2 | Tier block in Advanced | Open Advanced → Models; oversized curated model shows disabled with RAM reason | PASS | | Operator sign-off 2026-05-23 |
| 3 | Plan guard | With Ollama model loaded near cap, Plan on a node — blocked or warned if over budget | PASS | | Operator sign-off 2026-05-23 |
| 4 | Run blocked | Workflow overview shows memory budget summary; Run disabled with `resourceGuard` reason when over budget | PASS | | Operator sign-off 2026-05-23 |
| 5 | Duplicate run | While running, second Run/Resume returns conflict (409) — UI shows error | PASS | | Operator sign-off 2026-05-23 |
| 6 | Stop unloads | Stop run — execution stops; Ollama `/api/ps` shows reduced loaded VRAM (or models unloaded) | PASS | Native Linux + Ollama | Operator sign-off 2026-05-23 |
| 7 | WSL stability | After stop, WSL remains responsive (no freeze/OOM kill) | SKIP | D-05: operator not on WSL | Automated `ram_guard` + preflight PASS |

## Sign-off

**Operator:** Brady  
**Date:** 2026-05-23  
**Result:** PASS (items 1–6; item 7 SKIP per D-05)

Approved: 2026-05-23 — manual verification on native Linux; memory guard behavior confirmed in browser.
