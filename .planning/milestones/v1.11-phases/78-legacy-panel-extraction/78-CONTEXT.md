# Phase 78 Context: Legacy Panel Extraction

**Phase:** 78 — Legacy Panel Extraction  
**Milestone:** v1.11 UI Product Hardening  
**Requirements:** SHEL-01, SHEL-05

## Goal

Move domain panels from `ui/src/legacy/panels.tsx` into colocated modules under `ui/src/advanced/*` and `ui/src/nodes/`. Advanced views must not import the legacy monolith.

## Decisions (auto)

| Area | Decision |
|------|----------|
| Layout | One panel module per Advanced domain: `advanced/models/`, `plugins/`, `sessions/`, `memory/`, `settings/` |
| Settings helpers | Shared `inspectorHelpers.tsx` for SamplingRows, PortRows, PolicyRows, parsers |
| Canvas | `QualityLoopCardSummary` lives in `nodes/` (used by ExecutionNodeCard) |
| Legacy file | Delete `legacy/panels.tsx` entirely — no re-export shim |
| Contract test | Point quality-loop grep at `advanced/settings/QualityLoopInspector.tsx` |

## Out of scope

- Run panel / workflow boundary enforcement (Phase 79)
- Context menu wiring (Phase 79)
- Backend or API changes

## References

- `.planning/notes/ui-shell-architecture.md`
- `.planning/phases/77-interaction-polish/77-CONTEXT.md`
