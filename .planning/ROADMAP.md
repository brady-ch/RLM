# Roadmap: Recursive Language Model CLI

## Milestones

- ✅ **v1.13 Runtime Safety & WSL Hardening** — Phases 86-89 (shipped 2026-05-24; archive: `.planning/milestones/v1.13-ROADMAP.md`)
- ✅ **v1.12 UI Canvas Visual Polish** — Phases 82-85 (shipped 2026-05-23; archive: `.planning/milestones/v1.12-phases/`)
- ✅ **v1.11 UI Product Hardening** — Phases 77-81 (shipped 2026-05-23)
- ✅ **v1.10 v1.9 Debt Closure** — Phases 72-76 (shipped 2026-05-23; archive: `.planning/milestones/v1.10-ROADMAP.md`)
- ✅ **v1.9 Rust Runtime Hardening** — Phases 62-71 (shipped 2026-05-22; archive: `.planning/milestones/v1.9-ROADMAP.md`)
- ✅ **v1.8 Rust Runtime Migration** — Phases 1, 52-61 (shipped 2026-05-22; archive: `.planning/milestones/v1.8-ROADMAP.md`)

## Overview

**Current milestone:** None — v1.13 shipped 2026-05-24. Start next milestone with `/gsd-new-milestone`.

## Phases

<details>
<summary>✅ v1.13 Runtime Safety & WSL Hardening (Phases 86-89) — SHIPPED 2026-05-24</summary>

**Milestone Goal:** Operators can plan and run workflows without OOM from stacked model loads — memory budget enforced end-to-end with visible UI feedback.

- [x] **Phase 86: RAM Guard Completion** — Live Ollama ps in guards, config validation, TS parity (MEM-*) — completed 2026-05-23
- [x] **Phase 87: Execution Concurrency & Model Lifecycle** — Single-run mutex, keep_alive ratchet, stop unload (SAFE-01–03) — completed 2026-05-23
- [x] **Phase 88: Memory Visibility & WSL Runbook** — Live resourceGuard in UI, budget panel, docs (SAFE-04, MEM-05) — completed 2026-05-23
- [x] **Phase 89: Operator Safety UAT** — REG-03 signed 2026-05-23 (Brady; items 1–6 PASS, item 7 SKIP D-05) — completed 2026-05-23

Full phase details: `.planning/milestones/v1.13-ROADMAP.md`

</details>

---
*Roadmap updated: 2026-05-24 after v1.13 milestone archive*
