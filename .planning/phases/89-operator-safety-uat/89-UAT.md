---
status: pending_operator
phase: 89-operator-safety-uat
requirement: REG-03
updated: "2026-05-23T22:00:00Z"
operator_signed: null
---

# Phase 89 — REG-03 Operator Safety UAT Checklist (v1.13)

WSL memory safety checklist for milestone v1.13 Runtime Safety & WSL Hardening.

## Operator Runbook

### Prerequisites

- WSL2 with Ollama on Windows host (`http://127.0.0.1:11434`)
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
cargo test -p rlm-core ram_guard
cargo test -p rlm-core --test chat_routes
node --import tsx --test tests/application/config/validation.unit.test.ts
npm run build:ui
```

## Checklist

| # | Item | Steps | Result | Notes | Evidence |
|---|------|-------|--------|-------|----------|
| 1 | Config validation | Set a tier `estimatedRamMb` above `maxRamMb`; start UI — config load fails with clear error | PENDING | | |
| 2 | Tier block in Advanced | Open Advanced → Models; oversized curated model shows disabled with RAM reason | PENDING | | |
| 3 | Plan guard | With Ollama model loaded near cap, Plan on a node — blocked or warned if over budget | PENDING | | |
| 4 | Run blocked | Workflow overview shows memory budget summary; Run disabled with `resourceGuard` reason when over budget | PENDING | | |
| 5 | Duplicate run | While running, second Run/Resume returns conflict (409) — UI shows error | PENDING | | |
| 6 | Stop unloads | Stop run — execution stops; Ollama `/api/ps` shows reduced loaded VRAM (or models unloaded) | PENDING | | |
| 7 | WSL stability | After stop, WSL remains responsive (no freeze/OOM kill) | PENDING | | |

## Sign-off

Operator name: _______________  
Date: _______________  
Result: PASS / FAIL
