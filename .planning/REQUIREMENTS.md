# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-22  
**Milestone:** v1.10 — v1.9 Debt Closure  
**Core Value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## v1.10 Requirements

Requirements close documented v1.9 tech debt from `.planning/milestones/v1.9-MILESTONE-AUDIT.md` and STATE.md deferred items.

### Verification (REG)

- [ ] **REG-01**: Operator completes and signs Phase 61 human UAT checklist (`61-06-VERIFICATION.md`) on Rust-served UI with live Ollama where applicable; Phase 62 verification updated from `human_needed` to passed

### Resume UX (RESU / PERS)

- [ ] **RESU-01**: User can resume an interrupted run from the UI — control calls `POST /api/chat/resume-run` with `{ confirm: true }` after explicit confirmation; session reflects resumed execution state
- [ ] **RESU-02**: HTTP integration test covers resume-run confirm gate (reject without confirm; accept with confirm; executor skips completed nodes)
- [ ] **PERS-04**: TypeScript graph executor invokes `persistResumeCursor` at node transitions so Node runtime writes the same cursor shape as Rust

### Skill Interop Depth (PLUG)

- [ ] **PLUG-04**: Rust skill runtime emits structured `SKILL_PARSE_ERROR` lifecycle events (not warning strings only) when skill load/parse fails
- [ ] **PLUG-05**: `ManifestSkillLoader` implements async `load()` for declarative skill paths (remove stub behavior)

### Packaging & CI (PACK)

- [ ] **PACK-04**: `test:packaging` runs as part of default `npm test` gate (deb-smoke-lib unit tests included in CI developer loop)

### Architecture Hygiene (ARCH / META)

- [ ] **ARCH-07**: `71-DECISION.md` refreshed — Phase 70 prerequisite language accurate; `measure-rust-compile-baseline.sh` preserves cargo exit status per 71-REVIEW finding
- [ ] **ARCH-08**: Transitional boundary arcs documented with ratchet plan — either reduce baseline count with code moves or publish explicit defer rationale in AGENTS.md; default `check:rust:boundaries` behavior unchanged unless arcs eliminated
- [ ] **META-01**: Stale v1.9 wave todos (`rust-functional-debt-wave1`, `rust-structural-architecture-wave2`) archived or cancelled; `66-01-SUMMARY.md` frontmatter includes `requirements-completed`

## Future Requirements

Deferred beyond v1.10 — not in this milestone roadmap.

### Product Shell

- **SHEL-01**: UI component extraction per `ui-shell-architecture.md` (app/canvas/nodes/run-panel/advanced split)
- **SHEL-02**: Node context menu (Variant B) wired to existing `/api/nodes/*` mutations

### Infrastructure

- **INFR-01**: Managed llama.cpp runtime (supervised process, GPU backends)
- **INFR-02**: Multi-runner adapters beyond Ollama (vLLM, cloud APIs)

### Release

- **REL-01**: Signed/reproducible release artifacts
- **REL-02**: Windows/macOS packages and auto-update channel

### Quality Meta

- **NYQT-01**: Nyquist `*-VALIDATION.md` artifacts for v1.9 phases 62–71 (optional retroactive coverage)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full UI shell rewrite (`ui-component-extraction` seed) | Product milestone (v2.0 candidate); REG-01 UAT uses current Phase 61 shell |
| Optional crate split (ARCH-06) | Evaluated defer at v1.9 close — compile iteration acceptable |
| New control-server endpoints | Debt closure only; resume API already exists |
| Nyquist retroactive validation for all v1.9 phases | Meta overhead; tracked as NYQT-01 future |
| Strict boundary mode as default CI gate | Only if transitional arcs eliminated in ARCH-08 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REG-01 | Phase 72 | Pending |
| RESU-01 | Phase 73 | Pending |
| RESU-02 | Phase 73 | Pending |
| PERS-04 | Phase 74 | Pending |
| PLUG-04 | Phase 75 | Pending |
| PLUG-05 | Phase 75 | Pending |
| PACK-04 | Phase 76 | Pending |
| ARCH-07 | Phase 76 | Pending |
| ARCH-08 | Phase 76 | Pending |
| META-01 | Phase 76 | Pending |

**Coverage:**
- v1.10 requirements: 10 total
- Mapped to phases: 10/10 ✓
- Unmapped: 0

---
*Requirements defined: 2026-05-22*
*Last updated: 2026-05-22 after v1.10 roadmap (Phases 72-76)*
