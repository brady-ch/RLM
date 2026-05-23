# Phase 79 Context: Shell Boundaries & Context Menu

**Phase:** 79 — Shell Boundaries & Context Menu  
**Milestone:** v1.11 UI Product Hardening  
**Requirements:** SHEL-02, SHEL-03, SHEL-04

## Goal

Verify and ratchet the Phase 61 shell vision: workflow view stays canvas-only; Run panel is approve/clarify on select; node context menu Variant B is wired with keyboard access; `run-panel/` boundary enforced.

## Baseline (Phase 61 + 78)

| Area | Status |
|------|--------|
| `AppShell` workflow vs advanced routing | Implemented |
| `RunPanel` approve/clarify/readiness only | Implemented |
| `NodeContextMenu` Plan/Run/Graph/Advanced sections | Implemented |
| `ExecutionNodeCard` ⋮ + Shift+F10 menu access | Implemented |
| Domain panels in `advanced/*` only | Phase 78 complete |
| Automated boundary enforcement | **Gap — Phase 79 adds ESLint + contract test** |

## Decisions (auto)

| Area | Decision |
|------|----------|
| Boundary enforcement | ESLint `no-restricted-imports` on `ui/src/run-panel/**`; contract test in `tests/ui/shell-boundaries.test.ts` |
| Depcruise | Not used for UI — dependency-cruiser config targets `src/` only |
| Verification | Grep + node:test contract checks + `npm run build:ui` |

## Out of scope

- First-run launcher (Phase 80)
- Operator UAT (Phase 81)
- Backend/API changes

## References

- `.planning/notes/ui-shell-architecture.md`
- `.planning/milestones/v1.8-phases/61-ui-shell-rewrite/61-UI-SPEC.md`
- `.planning/sketches/002-context-menu-node-editing/`
