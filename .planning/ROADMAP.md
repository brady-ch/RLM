# Roadmap: Recursive Language Model CLI

## Milestones

- 🚧 **v1.12 UI Canvas Visual Polish** — Phases 82-85 (planning)
- ✅ **v1.11 UI Product Hardening** — Phases 77-81 (shipped 2026-05-23)
- ✅ **v1.10 v1.9 Debt Closure** — Phases 72-76 (shipped 2026-05-23; archive: `.planning/milestones/v1.10-ROADMAP.md`)
- ✅ **v1.9 Rust Runtime Hardening** — Phases 62-71 (shipped 2026-05-22; archive: `.planning/milestones/v1.9-ROADMAP.md`)
- ✅ **v1.8 Rust Runtime Migration** — Phases 1, 52-61 (shipped 2026-05-22; archive: `.planning/milestones/v1.8-ROADMAP.md`)

## Overview

**Current milestone:** v1.12 UI Canvas Visual Polish — dark/light themes, high-contrast graph edges, and Figma/Miro-style canvas polish per approved `79-UI-SPEC.md`. No API or shell layout changes.

**v1.11 (shipped 2026-05-23)** delivered shell boundaries, interaction polish, first-run launcher, workflow overview, model RAM guards, and REG-01 operator UAT.

## Phases

### 🚧 v1.12 UI Canvas Visual Polish (Phases 82-85)

**Milestone Goal:** Canvas-first UI reads as a polished product — readable edges, dark/light mode, neutral dot-grid canvas, light node cards, Radix context menu.

- [ ] **Phase 82: Theme System & Edge Contrast** — Light/dark tokens, system + manual toggle, high-contrast React Flow edges (THEME-*, EDGE-*)
- [ ] **Phase 83: Canvas & Node Card Polish** — Dot-grid canvas, status chips, card chrome per 79-UI-SPEC in both themes (CANV-01, CANV-02, CANV-04)
- [ ] **Phase 84: Radix Context Menu** — Replace hand-rolled menu with Radix primitive; preserve all actions (CANV-03)
- [ ] **Phase 85: Operator Visual UAT** — Browser checklist for theme, edges, and polish; ratchet REG-02 (REG-02)

## Phase Details

### Phase 82: Theme System & Edge Contrast
**Goal:** User can switch light/dark (or follow system) and clearly see graph connection lines in both modes  
**Depends on:** v1.11 complete  
**Requirements:** THEME-01, THEME-02, THEME-03, EDGE-01, EDGE-02, EDGE-03  
**Success Criteria:**
1. User opens UI and sees theme matching system preference when no override stored
2. User toggles light/dark/system from TopBar; choice persists after refresh
3. Graph edges are visibly contrasting against canvas in light and dark modes
4. TopBar, Run panel, and Advanced hub inherit theme tokens without broken contrast  
**Plans:** TBD  
**Reference:** `.planning/research/SUMMARY.md`, `.planning/todos/pending/79-02-canvas-visual-polish.md` (edge contrast section)

### Phase 83: Canvas & Node Card Polish
**Goal:** Canvas and node cards match 79-UI-SPEC Figma/Miro aesthetic in both themes  
**Depends on:** Phase 82  
**Requirements:** CANV-01, CANV-02, CANV-04  
**Success Criteria:**
1. User sees neutral dot-grid canvas (not green prototype tint) in light and dark
2. Node cards use light header + status chips; no dark header bar
3. Selected, hover, and running card states match spec
4. MiniMap, handles, and React Flow controls remain usable in both themes  
**Plans:** TBD  
**Reference:** `.planning/milestones/v1.11-phases/79-shell-boundaries-context-menu/79-UI-SPEC.md`

### Phase 84: Radix Context Menu
**Goal:** Context menu meets a11y bar with Radix while preserving Variant B actions  
**Depends on:** Phase 83  
**Requirements:** CANV-03  
**Success Criteria:**
1. Right-click, ⋮, and keyboard open Radix context menu on node cards
2. All Plan/Run/Graph/Advanced menu items work unchanged
3. Menu renders correctly in light and dark themes
4. Shell boundary tests pass — no `advanced/` imports in run-panel  
**Plans:** TBD

### Phase 85: Operator Visual UAT
**Goal:** Operator signs browser checklist for v1.12 visual requirements  
**Depends on:** Phase 84  
**Requirements:** REG-02  
**Success Criteria:**
1. Operator verifies theme toggle and persistence in browser
2. Operator confirms edge visibility in both themes
3. Operator confirms canvas/card polish and context menu actions
4. Verification artifact ratcheted to passed  
**Plans:** TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 82. Theme System & Edge Contrast | v1.12 | 0/0 | Not started | — |
| 83. Canvas & Node Card Polish | v1.12 | 0/0 | Not started | — |
| 84. Radix Context Menu | v1.12 | 0/0 | Not started | — |
| 85. Operator Visual UAT | v1.12 | 0/0 | Not started | — |

---
*Roadmap created: 2026-05-23 — milestone v1.12 UI Canvas Visual Polish*
