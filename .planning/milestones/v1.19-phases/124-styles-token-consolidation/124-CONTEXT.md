# Phase 124: Styles and Token Consolidation - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations accepted via --auto)

<domain>
## Phase Boundary

Split monolithic `ui/src/styles.css` (~1,800 LOC) by concern OR reduce to modular imports. Remove dead CSS from Phases 122–123 deletions. Preserve canvas dot grid and light card visual polish unchanged.

</domain>

<decisions>
## Implementation Decisions

### Split Strategy
- Split by concern into multiple CSS files imported from main entry (e.g., canvas, nodes, run-panel, advanced, tokens/base)
- OR use CSS modules co-located with components where already established — prefer minimal disruption
- Keep single bundle output; Vite handles imports

### Dead CSS Removal
- Remove rules for deleted RefineGraphPanel, QualityLoopInspector, trimmed TopBar/RunPanel elements
- Grep for orphaned selectors after split

### Visual Preservation
- Canvas dot grid, node card styling, status chips unchanged (ui-canvas-visual-polish-decision.md)
- No redesign — structural CSS organization only

### Tokens
- Extract repeated colors/spacing to CSS variables at top of base/tokens file if not already present
- Do not adopt shadcn or external design system

### Verification
- npm run build:ui passes
- Visual regression: document manual check items in VERIFICATION.md (no screenshot infra required)

### Claude's Discretion
- Exact file split boundaries
- Whether to co-locate small component CSS vs central advanced.css

</decisions>

<code_context>
## Existing Code Insights

- styles.css: Demote verdict — split target Phase 124
- ~45 kB CSS bundle baseline from Phase 121
- Deleted component CSS already partially removed in Phase 122

</code_context>

<specifics>
## Specific Ideas

- Clusters from cut list: canvas grid, node cards, run panel, advanced hub
- Dead rules from deleted components must go

</specifics>

<deferred>
## Deferred Ideas

- Full design token system — out of scope
- shadcn adoption — explicit non-goal

</deferred>
