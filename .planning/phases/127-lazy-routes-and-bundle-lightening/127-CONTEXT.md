# Phase 127: Lazy Routes and Bundle Lightening - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations accepted via --auto)

<domain>
## Phase Boundary

Code-split Advanced hub routes with React.lazy. Document before/after bundle size vs Phase 121 baseline. Workflow-first load must not download Advanced chunks until user navigates to Advanced.

</domain>

<decisions>
## Implementation Decisions

### Lazy Loading Scope
- React.lazy + Suspense for AdvancedHub and/or individual tab views (ModelsView, PluginsView, SessionsView, MemoryView, SettingsView)
- Workflow route (canvas, TopBar, RunPanel) stays in main chunk

### Baseline Comparison
- Phase 121 baseline: 522.60 kB JS / 45.52 kB CSS (pre-v1.19)
- Record post-127 build output in phase SUMMARY
- Target: measurable main chunk reduction on workflow-first load

### AdvancedHub Eager Imports
- Cut list flagged AdvancedHub eager-imports all tabs — replace with lazy tab loading

### Fallback UI
- Simple loading fallback for Suspense (spinner or skeleton — minimal)

### Verification
- npm run build:ui passes
- Document chunk names/sizes from build output
- tests/ui/ static tests still pass

### Claude's Discretion
- Lazy at hub level vs per-tab granularity
- Prefetch strategy (none for v1.19 — load on navigate only)

</decisions>

<code_context>
## Baseline
- 121-CUT-LIST.md bundle baseline section
- AdvancedHub.tsx current eager imports

</code_context>

<specifics>
## Specific Ideas

- Workflow-first load skips Advanced chunks until navigated (success criterion)

</specifics>

<deferred>
## Deferred Ideas

- Route-based prefetch on hover — post-128

</deferred>
