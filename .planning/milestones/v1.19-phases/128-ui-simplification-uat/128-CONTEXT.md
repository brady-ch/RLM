# Phase 128: UI Simplification UAT and Sign Off - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations accepted via --auto)

<domain>
## Phase Boundary

Operator UAT on Rust-only stack for v1.19 milestone sign-off. UAT checklist covers first-run → graph → run → Advanced → save/reopen. Produce signed VERIFICATION.md. Document first-run to successful run under 5 minutes (operator verified or automated proxy where possible).

</domain>

<decisions>
## Implementation Decisions

### UAT Checklist Scope
1. First-run launcher appears on empty state
2. Guided composer creates initial graph
3. Canvas displays nodes; select node shows Run panel approve/clarify
4. Run/stop from TopBar works against Rust control server
5. Advanced hub: Models, Sessions tabs reachable; deleted panels absent
6. Save session and reopen restores graph
7. Theme toggle in Advanced Settings works
8. No domain panels on workflow view

### Verification Artifact
- VERIFICATION.md with status passed/human_needed
- UAT checklist as markdown in phase dir (128-UAT-CHECKLIST.md)
- Bundle size comparison vs Phase 121 baseline

### Automated vs Manual
- Static tests in tests/ui/ cover wiring boundaries — run in verify:light
- Interactive Tauri smoke deferred to human_needed items if cannot automate
- Document operator steps for manual items clearly

### Milestone Sign-Off
- Mark phases 121–128 complete in ROADMAP
- Update STATE.md for v1.19 completion

### Claude's Discretion
- Which UAT steps can be covered by existing static tests vs marked human_needed
- REG-style checklist format matching prior milestones

</decisions>

<code_context>
## Prior Phases
- 121 cut list, 122–127 execution summaries
- npm run test:agent:verify:light as automated gate
- Rust-only stack post v1.18

</code_context>

<specifics>
## Specific Ideas

- First-run to successful run under 5 minutes (operator verified)
- Milestone success criteria from ui-product-simplification-decisions.md

</specifics>

<deferred>
## Deferred Ideas

- Full Tauri desktop packaging UAT — v1.20 Phase 135
- Screenshot/visual regression infra — out of scope

</deferred>
