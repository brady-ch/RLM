# Phase 121: UI Vision Audit and Cut List - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations accepted via --auto)

<domain>
## Phase Boundary

Score every UI surface under `ui/src/` against the locked product vision (graph-first, canvas-default, power features in Advanced hub). Produce a committed cut list artifact with keep/demote/delete verdicts that Phases 122–127 execute against. This phase is audit and documentation only — no component removals or refactors.

</domain>

<decisions>
## Implementation Decisions

### Audit Scope & Granularity
- Audit at **component/view level** — one row per `.tsx` file under `ui/src/`, grouped by directory in the cut list
- Include **styles.css sections** as a separate audit row (monolith ~1,800 lines) with split/defer guidance for Phase 124
- Exclude test files, `main.tsx` bootstrap, and shared primitives unless they carry domain fetch weight
- Every file gets exactly one verdict: **Keep**, **Demote**, or **Delete**

### Verdict Criteria Weighting
- **Graph-first** (weight: highest) — does it help inspect, edit, approve, or run a node graph on the workflow view?
- **Default path** — should a first-run user see this before first successful run?
- **Recoverable via Advanced** — if demoted/deleted from default, can power users still reach equivalent capability?
- **Vision match** — aligns with locked shell (no domain panels on workflow view; thin TopBar; Run panel approve/clarify only)
- **Weight cost** — LOC, CSS, bundle KB, mount-time fetches (tiebreaker for Demote vs Delete)

### Cut List Artifact Format
- Deliverable: `.planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md`
- Table columns: Surface | Path | Verdict | Rationale (1 line) | Phase owner (122–127)
- Summary section: counts by verdict, explicit callouts for mandatory scored surfaces
- Phase owner mapping: 122=Advanced hub deletes, 123=workflow chrome, 124=CSS, 125=AppShell fetches, 126=inspector/settings, 127=bundle impact

### Mandatory Explicit Scores
- **RefineGraphPanel** — initial hypothesis Demote or Delete (chat refine not default path)
- **QualityLoopInspector** — initial hypothesis Demote or Delete
- **NodeInspector** — Slim/Demote (prompt edit stays on node card)
- **WorkflowOverview** — Review (may overlap TopBar; likely Demote or trim)
- **GraphWorkflowPanel** — Review (settings overlap with workflow shell)
- **AppShell.tsx** — Keep structure but flag for decomposition (Phase 125)
- **styles.css** — Keep content, Demote monolith structure (split Phase 124)

### Claude's Discretion
- Exact Demote vs Delete for borderline Advanced panels when recoverable state exists
- Whether WorkflowOverview merges into TopBar status or stays demoted in Run panel
- Granularity of CSS section breakdown in cut list (section headers vs rule clusters)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- 27 `.tsx` files under `ui/src/` — complete inventory for audit
- Decision notes at `.planning/notes/ui-product-simplification-decisions.md` with initial hypotheses per surface
- Locked architecture refs: `ui-shell-architecture.md`, `product-shell-entry-model.md`, `ui-canvas-visual-polish-decision.md`

### Established Patterns
- Workflow view: `canvas/`, `nodes/`, `run-panel/`, `app/TopBar.tsx`, `app/FirstRunLauncher.tsx`
- Advanced hub: `advanced/AdvancedHub.tsx` with Models, Plugins, Sessions, Memory, Settings tabs
- Domain state concentrated in `app/AppShell.tsx` (decomposition target Phase 125)
- Monolithic `ui/src/styles.css` (~1,800 lines)

### Integration Points
- Cut list feeds Phase 122 (Advanced pruning) through Phase 127 (lazy routes)
- No new control-server endpoints in v1.19
- Rust-only stack post v1.18 — audit assumes HTTP API unchanged

</code_context>

<specifics>
## Specific Ideas

- Follow audit framework from ui-product-simplification-decisions.md (5 questions per surface)
- Explicit non-goals for v1.19: no shadcn adoption, no framework rewrite, no command palette
- Advanced hub keeps Models · Plugins · Sessions · Memory · Settings as power surface
- Workflow canvas, slim Run panel, FirstRunLauncher are Keep anchors

</specifics>

<deferred>
## Deferred Ideas

- Command palette (⌘K) — post Phase 128 if needed
- Full design-system adoption — out of v1.19 scope
- New backend endpoints for UI simplification — out of scope

</deferred>
