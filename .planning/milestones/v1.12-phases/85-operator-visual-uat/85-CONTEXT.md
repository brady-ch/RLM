# Phase 85 Context: Operator Visual UAT

**Phase:** 85 — Operator Visual UAT  
**Milestone:** v1.12 UI Canvas Visual Polish  
**Requirements:** REG-02

## Goal

Operator completes browser checklist for v1.12 visual requirements: theme toggle, edge visibility, canvas/card polish, Radix context menu. Ratchet REG-02 to passed on sign-off.

## Decisions

| Area | Decision |
|------|----------|
| Checklist | `85-UAT.md` — visual-focused rows for theme, edges, canvas, menu |
| Operator stack | Same as v1.11: `npm run build:ui` → `RLM_UI_DIST=... cargo run -p rlm-cli -- ui --port 0` |
| Preflight | `npm run test:uat:preflight` before browser work |
| Autonomous | Browser rows stay PENDING until operator signs |

## References

- `.planning/milestones/v1.11-phases/81-operator-uat-sign-off/81-UAT.md`
- Phases 82–84 VERIFICATION.md
