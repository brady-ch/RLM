# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-23  
**Milestone:** v1.13 — Runtime Safety & WSL Hardening  
**Core Value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## v1.13 Requirements

### Memory Budget (MEM)

- [x] **MEM-01**: Rust control server enforces `memory.maxRamMb` before plan, run, resume, tier select, and model install (extends initial `ram_guard.rs`)
- [x] **MEM-02**: Available budget accounts for Ollama `/api/ps` loaded model VRAM on plan/run (not snapshot-only)
- [x] **MEM-03**: WSL environments apply conservative cap (`wslAutoCapMb`) when `maxRamMb` is `auto`; documented in operator runbook
- [x] **MEM-04**: Config validation fails fast when any configured tier `estimatedRamMb` exceeds `maxRamMb`
- [x] **MEM-05**: Session `resourceGuard` refreshes on poll/SSE with live Ollama loaded memory (not static zero)
- [x] **MEM-06**: TypeScript execution path (`RLM_RUNTIME=node`) uses equivalent RAM guard for model selection and agent reservation

### Execution Safety (SAFE)

- [x] **SAFE-01**: Only one confirmed graph execution may run at a time; duplicate Run/Resume requests return conflict
- [x] **SAFE-02**: Ollama requests use `keep_alive: 0` (unload after call) — verified and ratcheted in tests
- [x] **SAFE-03**: Stop run unloads active Ollama models via explicit unload API where reachable
- [x] **SAFE-04**: UI surfaces memory guard state — Run/Resume disabled with actionable reason; overview shows budget summary

### Operator Verification (REG)

- [ ] **REG-03**: Operator completes WSL safety checklist (memory cap, tier block, plan/run guard, stop behavior); evidence recorded

## Carried Forward

| ID | From | Status |
|----|------|--------|
| REG-02 | v1.12 Phase 85 | Optional — visual UAT checklist exists at `.planning/milestones/v1.12-phases/85-operator-visual-uat/85-UAT.md`; not blocking v1.13 |

## Future Requirements

Deferred beyond v1.13.

### Infrastructure

- **INFR-01**: Managed llama.cpp runtime (supervised process, GPU backends)
- **INFR-02**: Multi-runner adapters beyond Ollama (vLLM, cloud APIs)

### Release

- **REL-01**: Signed/reproducible release artifacts
- **REL-02**: Windows/macOS packages and auto-update channel

### UX Enhancements

- **UX-05**: Command palette (`⌘K`) for power-user navigation
- **UX-06**: Execution trace/output panel surfacing LLM results on nodes
- **NYQT-01**: Nyquist `*-VERIFICATION.md` artifacts for v1.10 phases 73–76

## Out of Scope

| Feature | Reason |
|---------|--------|
| Managed llama.cpp / multi-runner | Infrastructure milestone (INFR-*) |
| Full system memory manager daemon | Config cap + Ollama ps sufficient for v1.13 |
| Windows-native Ollama in WSL | Operator runs Ollama on host; guardrails assume that layout |
| REG-02 visual re-verification | Checklist archived; re-run opportunistically |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MEM-01 | Phase 86 | Complete |
| MEM-02 | Phase 86 | Complete |
| MEM-03 | Phase 86 | Complete |
| MEM-04 | Phase 86 | Complete |
| MEM-05 | Phase 88 | Complete |
| MEM-06 | Phase 86 | Complete |
| SAFE-01 | Phase 87 | Complete |
| SAFE-02 | Phase 87 | Complete |
| SAFE-03 | Phase 87 | Complete |
| SAFE-04 | Phase 88 | Complete |
| REG-03 | Phase 89 | Pending operator |

**Coverage:**
- v1.13 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-23*
