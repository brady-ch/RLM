# Roadmap: Recursive Language Model CLI

## Milestones

- ✅ **v1.13 Runtime Safety & WSL Hardening** — Phases 86-89 (shipped 2026-05-23; REG-03 signed)
- ✅ **v1.12 UI Canvas Visual Polish** — Phases 82-85 (shipped 2026-05-23; archive: `.planning/milestones/v1.12-phases/`)
- ✅ **v1.11 UI Product Hardening** — Phases 77-81 (shipped 2026-05-23)
- ✅ **v1.10 v1.9 Debt Closure** — Phases 72-76 (shipped 2026-05-23; archive: `.planning/milestones/v1.10-ROADMAP.md`)
- ✅ **v1.9 Rust Runtime Hardening** — Phases 62-71 (shipped 2026-05-22; archive: `.planning/milestones/v1.9-ROADMAP.md`)
- ✅ **v1.8 Rust Runtime Migration** — Phases 1, 52-61 (shipped 2026-05-22; archive: `.planning/milestones/v1.8-ROADMAP.md`)

## Overview

**Current milestone:** v1.13 shipped 2026-05-23 — RAM guardrails, execution concurrency, UI memory visibility, REG-03 operator sign-off (native Linux; WSL item 7 SKIP).

**v1.12 (shipped 2026-05-23)** delivered theme system, canvas polish, Radix context menu, initial RAM guards, and workflow overview fixes. REG-02 visual UAT checklist archived but not operator-signed.

## Phases

### ✅ v1.13 Runtime Safety & WSL Hardening (Phases 86-89)

**Milestone Goal:** Operators can plan and run workflows without OOM from stacked model loads — memory budget enforced end-to-end with visible UI feedback.

- [x] **Phase 86: RAM Guard Completion** — Live Ollama ps in guards, config validation, TS parity (MEM-*)
- [x] **Phase 87: Execution Concurrency & Model Lifecycle** — Single-run mutex, keep_alive ratchet, stop unload (SAFE-01–03)
- [x] **Phase 88: Memory Visibility & WSL Runbook** — Live resourceGuard in UI, budget panel, docs (SAFE-04, MEM-05)
- [x] **Phase 89: Operator Safety UAT** — REG-03 signed 2026-05-23 (Brady; items 1–6 PASS, item 7 SKIP D-05)

## Phase Details

### Phase 86: RAM Guard Completion
**Goal:** Memory budget enforced consistently across Rust and TypeScript paths with config validation  
**Depends on:** v1.12 RAM guard foundation (`8680496`)  
**Requirements:** MEM-01, MEM-02, MEM-03, MEM-04, MEM-06  
**Success Criteria:**
1. Plan/run/resume/tier/install blocked when peak tier exceeds budget (with Ollama ps subtracted)
2. Invalid config (tier estimate > maxRamMb) rejected at load with clear error
3. WSL auto cap applied when maxRamMb is auto
4. Node runtime path matches Rust guard behavior in tests  
**Plans:** TBD

### Phase 87: Execution Concurrency & Model Lifecycle
**Goal:** Prevent stacked model loads and duplicate executions from exhausting memory  
**Depends on:** Phase 86  
**Requirements:** SAFE-01, SAFE-02, SAFE-03  
**Success Criteria:**
1. Second Run/Resume while running returns HTTP 409
2. Tests ratchet keep_alive: 0 on Ollama chat/generate
3. Stop triggers model unload when Ollama reachable  
**Plans:** TBD

### Phase 88: Memory Visibility & WSL Runbook
**Goal:** Operator sees memory budget state and has documented WSL setup guidance  
**Depends on:** Phase 87  
**Requirements:** SAFE-04, MEM-05  
**Success Criteria:**
1. resourceGuard on session poll reflects live Ollama loaded MB
2. UI shows available/peak/blocked state in overview or TopBar
3. docs/UI.md or dedicated runbook covers WSL + Ollama host memory limits  
**Plans:** TBD

### Phase 89: Operator Safety UAT
**Goal:** Operator signs WSL safety checklist  
**Depends on:** Phase 88  
**Requirements:** REG-03  
**Success Criteria:**
1. Operator verifies tier block when model exceeds cap
2. Operator verifies Run blocked with clear message when over budget
3. Operator verifies Stop clears running state without WSL freeze
4. Verification artifact ratcheted to passed  
**Plans:** TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 86. RAM Guard Completion | v1.13 | 1/1 | Complete | 2026-05-23 |
| 87. Execution Concurrency & Model Lifecycle | v1.13 | 1/1 | Complete | 2026-05-23 |
| 88. Memory Visibility & WSL Runbook | v1.13 | 1/1 | Complete | 2026-05-23 |
| 89. Operator Safety UAT | v1.13 | 1/1 | Complete | 2026-05-23 |

---
*Roadmap created: 2026-05-23 — milestone v1.13 Runtime Safety & WSL Hardening*
