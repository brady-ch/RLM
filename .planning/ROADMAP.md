# Roadmap: Recursive Language Model CLI

## Milestones

- 🚧 **v1.11 UI Product Hardening** — Phases 77-81 (planning)
- ✅ **v1.10 v1.9 Debt Closure** — Phases 72-76 (shipped 2026-05-23; archive: `.planning/milestones/v1.10-ROADMAP.md`)
- ✅ **v1.9 Rust Runtime Hardening** — Phases 62-71 (shipped 2026-05-22; archive: `.planning/milestones/v1.9-ROADMAP.md`)
- ✅ **v1.8 Rust Runtime Migration** — Phases 1, 52-61 (shipped 2026-05-22; archive: `.planning/milestones/v1.8-ROADMAP.md`)
- ✅ **v1.7 Adapter & Plugin Taxonomy** — Phases 43-51 (shipped 2026-05-22; archive: `.planning/milestones/v1.7-ROADMAP.md`)
- ✅ **v1.6 Architecture Cleanup** — Phases 36-42 (shipped 2026-05-22; archive: `.planning/milestones/v1.6-ROADMAP.md`)
- ✅ **v1.5 Dynamic Graph Authoring** — Phases 30-35 (shipped 2026-05-22; archive: `.planning/milestones/v1.5-ROADMAP.md`)
- ✅ **v1.4 Session Memory** — Phases 25-29, 29.1 (shipped 2026-05-21; archive: `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.3 Desktop Product** — Phases 21-24 (shipped 2026-05-21; archive: `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.2 Answer Quality Loops** — Phases 12-17 (shipped 2026-05-20; archive: `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.1 Interop, chat-first, plugins, constrained tools** — Phases 6-11 (shipped 2026-05-13; archive: `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-08; archive: `.planning/milestones/v1.0-ROADMAP.md`)

## Overview

**Current milestone:** v1.11 UI Product Hardening — Phases 77-81. Finish the Phase 61 shell vision (`ui-shell-architecture.md`), polish canvas/tier/run interactions, add first-run launcher, and close REG-01 operator browser UAT on the Rust-served UI.

**v1.10 (shipped 2026-05-23)** closed v1.9 debt: UI resume wiring, TS resume cursor parity, skill interop depth, packaging gate, architecture hygiene. REG-01 operator UAT accepted as tech_debt at close.

## Phases

### 🚧 v1.11 UI Product Hardening (Phases 77-81)

**Milestone Goal:** Deliver a reliable, complete UI product surface on the Rust control server — shell boundaries enforced, daily interactions polished, first-run guidance added, operator UAT signed.

- [x] **Phase 77: Interaction Polish** — Canvas, tier assignment, run/stop cancellation, UI server lifecycle (UX-01–04)
- [ ] **Phase 78: Legacy Panel Extraction** — Move domain panels out of `legacy/panels.tsx` into `advanced/*` (SHEL-01, SHEL-05)
- [ ] **Phase 79: Shell Boundaries & Context Menu** — Run panel scope, workflow-only view, context menu Variant B (SHEL-02–04)
- [ ] **Phase 80: First-Run Launcher** — Guided composer and session picker entry flow (LAUN-01–03)
- [ ] **Phase 81: Operator UAT Sign-off** — Complete `72-UAT.md` browser checklist and ratchet verification (REG-01)

## Phase Details

### Phase 77: Interaction Polish
**Goal:** Fix daily canvas and model interactions so the Rust-served UI is usable for planning and running workflows  
**Depends on:** v1.10 complete  
**Requirements:** UX-01, UX-02, UX-03, UX-04  
**Success Criteria:**
1. User opens Rust-served UI and sees a rendered, draggable graph canvas with editable node prompts
2. User assigns medium/default tiers to installed Ollama models and Plan/Run uses those models without stale-config errors
3. Stop aborts in-flight Ollama streams and background install jobs without server restart
4. Operator runbook documents `rlm ui --stop`/`--replace` and single-instance lock behavior  
**Plans:** TBD

### Phase 78: Legacy Panel Extraction
**Goal:** Eliminate `legacy/panels.tsx` as the source of domain UI — panels live in dedicated advanced views  
**Depends on:** Phase 77  
**Requirements:** SHEL-01, SHEL-05  
**Success Criteria:**
1. Models, Plugins, Sessions, Memory, and Settings views import only from `advanced/*` modules — not `legacy/panels`
2. Shared panel logic extracted to colocated components under `advanced/` or `shared/`
3. `legacy/panels.tsx` deleted or reduced to re-exports with zero Advanced view imports
4. `main.tsx` remains thin entry mounting AppShell only  
**Plans:** TBD

### Phase 79: Shell Boundaries & Context Menu
**Goal:** Enforce workflow vs Advanced separation and wire node context menu actions per Variant B  
**Depends on:** Phase 78  
**Requirements:** SHEL-02, SHEL-03, SHEL-04  
**Success Criteria:**
1. Workflow view shows top bar + canvas only — no sidebar domain panels
2. Run panel appears on node select with approve/clarify only — no edit fields or plan buttons
3. Right-click (or ⋮ / keyboard) context menu dispatches Plan children, Approve, Skip, Add child, Delete subtree, and Advanced expert link
4. `run-panel/` has no imports from `advanced/`  
**Plans:** TBD

### Phase 80: First-Run Launcher
**Goal:** Guide new users into the graph workspace with a composer and session entry flow  
**Depends on:** Phase 79  
**Requirements:** LAUN-01, LAUN-02, LAUN-03  
**Success Criteria:**
1. User starting fresh sees guided composer with prompt input before or overlaying empty canvas
2. User can open a saved session from a launcher list or start new workflow
3. After launcher, graph workspace is primary; Advanced remains secondary via TopBar
4. Existing deep-link / refresh restores session without losing graph state  
**Plans:** TBD

### Phase 81: Operator UAT Sign-off
**Goal:** Operator completes browser UAT on Rust-served UI and REG-01 verification ratchets to passed  
**Depends on:** Phase 80  
**Requirements:** REG-01  
**Success Criteria:**
1. Operator completes `72-UAT.md` items 2–10 in browser with live Ollama where applicable
2. All rows signed PASS or documented SKIP with evidence
3. `72-VERIFICATION.md` (or successor) status updated from `human_needed` to `passed`
4. No FAIL rows at sign-off unless explicitly accepted  
**Plans:** TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 77. Interaction Polish | v1.11 | 1/1 | Complete | 2026-05-23 |
| 78. Legacy Panel Extraction | v1.11 | 0/? | Not Started | — |
| 79. Shell Boundaries & Context Menu | v1.11 | 0/? | Not Started | — |
| 80. First-Run Launcher | v1.11 | 0/? | Not Started | — |
| 81. Operator UAT Sign-off | v1.11 | 0/? | Not Started | — |

---
*Roadmap created: 2026-05-22 — milestone v1.11 UI Product Hardening*
