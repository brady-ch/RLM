# Phase 121: UI Vision Audit and Cut List - Research

**Researched:** 2026-05-24
**Domain:** React UI product audit, cut-list artifact design, v1.19 simplification gate
**Confidence:** HIGH

## Summary

Phase 121 is a **documentation-only gate** for milestone v1.19: score every `.tsx` surface under `ui/src/` (26 files excluding `main.tsx`) plus `styles.css` as a 27th row, assign exactly one verdict (**Keep**, **Demote**, **Delete**), and commit `121-CUT-LIST.md` so Phases 122–127 execute against a single source of truth. No component removals, refactors, or CSS edits occur in this phase.

The codebase is already post–Phase 61 shell rewrite: 26 component files (~3,960 LOC TSX), monolithic `styles.css` (1,803 LOC, ~279 top-level rules), and `AppShell.tsx` at 453 LOC holding all domain refresh callbacks and view routing. [VERIFIED: codebase grep + wc]

Several **spec drifts** against locked shell architecture are audit-critical and should drive Demote/Delete hypotheses—notably `RunPanel.tsx` rendering `WorkflowOverview` when no node is selected (contradicts “Run panel on select only / hidden when no selection” in `ui-shell-architecture.md`), `NodeInspector.tsx` duplicating prompt edit and plan/graph actions already on node cards and context menu (461 LOC), and `TopBar.tsx` carrying run-variant, resume, pause-auto-approvals, approval-mode pill, and theme toggle beyond the thin-bar contract. [VERIFIED: source read]

Prior UI work established reusable patterns: **5-question audit framework** (`ui-product-simplification-decisions.md`), **6-pillar UI-REVIEW** scoring (`61-UI-REVIEW.md`), and **static boundary tests** in `tests/ui/shell-boundaries.test.ts` that encode shell contracts without a browser. Phase 121 should reuse the 5-question framework for per-surface rationale and add a completeness verifier (script or checklist) so every `.tsx` file maps to exactly one cut-list row. [VERIFIED: repo files]

**Primary recommendation:** Execute audit as a structured spreadsheet pass—inventory → score each surface on 5 weighted questions → assign verdict + phase owner → write `121-CUT-LIST.md` with summary counts and mandatory callouts—then verify completeness with a static test or grep checklist before marking phase done.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-surface vision scoring | Documentation / planning artifact | — | No runtime tier; output is `121-CUT-LIST.md` consumed by execution phases |
| Graph workflow canvas & node cards | Browser / Client | API (session SSE) | Core product identity; workflow view default |
| Run panel (approve/clarify) | Browser / Client | API (`/api/nodes/*`, chat) | Selection-gated execution UX |
| Advanced hub (Models/Plugins/Sessions/Memory/Settings) | Browser / Client | API (domain endpoints) | Power surface; full-screen takeover |
| Domain data fetching | Browser state (today: AppShell) | API | Today centralized in AppShell; Phase 125 moves to Advanced views |
| CSS / tokens | Browser static assets | — | Monolith today; Phase 124 splits by concern |
| Cut-list verification | CI / static tests | — | `tests/ui/` can assert artifact completeness without E2E |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Audit Scope & Granularity
- Audit at **component/view level** — one row per `.tsx` file under `ui/src/`, grouped by directory in the cut list
- Include **styles.css sections** as a separate audit row (monolith ~1,800 lines) with split/defer guidance for Phase 124
- Exclude test files, `main.tsx` bootstrap, and shared primitives unless they carry domain fetch weight
- Every file gets exactly one verdict: **Keep**, **Demote**, or **Delete**

#### Verdict Criteria Weighting
- **Graph-first** (weight: highest) — does it help inspect, edit, approve, or run a node graph on the workflow view?
- **Default path** — should a first-run user see this before first successful run?
- **Recoverable via Advanced** — if demoted/deleted from default, can power users still reach equivalent capability?
- **Vision match** — aligns with locked shell (no domain panels on workflow view; thin TopBar; Run panel approve/clarify only)
- **Weight cost** — LOC, CSS, bundle KB, mount-time fetches (tiebreaker for Demote vs Delete)

#### Cut List Artifact Format
- Deliverable: `.planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md`
- Table columns: Surface | Path | Verdict | Rationale (1 line) | Phase owner (122–127)
- Summary section: counts by verdict, explicit callouts for mandatory scored surfaces
- Phase owner mapping: 122=Advanced hub deletes, 123=workflow chrome, 124=CSS, 125=AppShell fetches, 126=inspector/settings, 127=bundle impact

#### Mandatory Explicit Scores
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

### Deferred Ideas (OUT OF SCOPE)
- Command palette (⌘K) — post Phase 128 if needed
- Full design-system adoption — out of v1.19 scope
- New backend endpoints for UI simplification — out of scope
</user_constraints>

## Standard Stack

Phase 121 is audit/documentation-only. No new libraries are introduced. Execution phases inherit the existing UI stack.

### Core (existing — do not replace)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.1 | UI runtime | Project standard [VERIFIED: package.json] |
| Vite | ^7.3.3 | Build/dev | `npm run build:ui` [VERIFIED: build output] |
| @xyflow/react | ^12.8.7 | Graph canvas | Core workflow surface [VERIFIED: package.json] |
| @radix-ui/react-context-menu | ^2.2.16 | Node context menu | Accessibility baseline [VERIFIED: package.json] |
| lucide-react | ^0.468.0 | Icons | Used across TopBar/Advanced [VERIFIED: package.json] |

### Supporting (audit tooling — use existing repo infra)

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `node --test tests/ui` | Node built-in | Static shell contract tests | Regression guard; no code changes in 121 |
| `npm run build:ui` | Vite 7 | Bundle size baseline | Weight-cost column; record in cut list summary |
| `wc -l`, ripgrep | — | LOC / import / fetch inventory | Per-surface scoring evidence |
| 61-UI-REVIEW 6-pillar model | — | Prior audit rubric | Reference for vision-match gaps, not duplicate full review |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual cut list | Automated dependency graph tool | Overkill for 26 files; manual scoring matches product vision weighting |
| Full gsd-ui-review (6 pillars) | 5-question product audit | UI-REVIEW grades visuals; Phase 121 grades product fit — use 5-question framework per CONTEXT |
| rollup-plugin-visualizer | Vite build output only | Visualizer not installed; Vite size table sufficient for baseline [VERIFIED: vite.config.ts has no visualizer] |

**Version verification:** React 19.2.1, Vite 7.3.3 from root `package.json` and successful `npm run build:ui` on 2026-05-24.

## Architecture Patterns

### System Architecture Diagram

```text
                    ┌─────────────────────────────────────┐
                    │         Phase 121 (audit only)       │
                    │  ui/src inventory → 5 questions    │
                    │  → verdict → 121-CUT-LIST.md         │
                    └─────────────────┬───────────────────┘
                                      │ feeds
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
   Phase 122 (Advanced)      Phase 123 (workflow)         Phase 124 (CSS)
   delete/demote panels      trim TopBar/RunPanel         split styles.css
          │                           │                           │
          └───────────────────────────┼───────────────────────────┘
                                      ▼
                    Phase 125 (AppShell) → 126 (inspector) → 127 (lazy routes)
```

### Recommended Project Structure (audit targets)

```text
ui/src/
  app/              AppShell (453 LOC), TopBar (173), FirstRunLauncher (170)
  canvas/           GraphCanvas (63)
  nodes/            ExecutionNodeCard (268), NodeContextMenu (218), GraphActionModal (104), QualityLoopCardSummary (29)
  run-panel/        RunPanel (157), WorkflowOverview (125)
  advanced/         AdvancedHub (197) + tab views + domain panels + settings/*
  shared/           ThemeToggle (54) — only .tsx in shared/
  styles.css        1,803 LOC monolith (27th audit row)
  main.tsx          EXCLUDED from cut list
```

**Shared `.ts` files excluded from cut list** (per CONTEXT): `api.ts`, `types.ts`, `graph-utils.ts`, `labels.ts`, `session-utils.ts`, `theme.ts`, `tokens.css`.

### Pattern 1: Five-Question Audit Worksheet

**What:** Score each surface on locked questions; derive verdict from weighted answers.
**When to use:** Every cut-list row before writing rationale.

| # | Question | Weight | Keep signal | Demote signal | Delete signal |
|---|----------|--------|-------------|---------------|---------------|
| 1 | Graph-first? | Highest | Core canvas/run/node path | Advanced-only graph tooling | Chat/refine duplicate of card authoring |
| 2 | Default path? | High | First-run → graph → run | Power user only | Never needed post-prune |
| 3 | Recoverable via Advanced? | High | N/A for Keep on workflow | Capability preserved in hub | Redundant with card/menu/API |
| 4 | Vision match? | High | Thin shell, no domain on workflow | Violates default but fixable in Advanced | Permanent shell violation |
| 5 | Weight cost? | Tiebreaker | Low LOC/fetch | Heavy but valuable | Heavy + low value |

**Verdict rules:**
- **Keep:** Q1 yes on workflow OR essential Advanced tab anchor
- **Demote:** Q1 no on default path but Q3 yes (move/hide/collapse)
- **Delete:** Q3 no OR duplicate capability with no unique API surface

Source: `.planning/notes/ui-product-simplification-decisions.md` [VERIFIED]

### Pattern 2: Phase Owner Assignment

**What:** Map each row to exactly one execution phase (122–127).

| Owner | Surfaces (typical) | Examples from inventory |
|-------|-------------------|-------------------------|
| **122** | Advanced hub deletes, tab order, panel removal | RefineGraphPanel, QualityLoopInspector if Delete; thin wrapper views |
| **123** | Workflow chrome: TopBar, RunPanel, WorkflowOverview, FirstRunLauncher | TopBar trim; RunPanel no-selection behavior |
| **124** | `styles.css` split, dead CSS, tokens | styles.css row; orphaned rules after deletes |
| **125** | AppShell decomposition, fetch relocation | AppShell.tsx row; domain state props |
| **126** | NodeInspector, GraphWorkflowPanel, settings slim | NodeInspector, inspectorHelpers, SettingsView composition |
| **127** | Lazy Advanced chunks, bundle impact | AdvancedHub eager imports; heavy panels |

Multiple phases may *touch* one file across the milestone, but each cut-list row gets **one primary owner** for the main verdict action.

### Pattern 3: Cut List Artifact Template

```markdown
# Phase 121: UI Cut List

**Audited:** YYYY-MM-DD
**Baseline bundle:** {js_kb} kB JS / {css_kb} kB CSS (gzip: …)

## Summary
| Verdict | Count |
|---------|-------|
| Keep | n |
| Demote | n |
| Delete | n |

### Mandatory callouts
- RefineGraphPanel: {verdict} — …
- …

## app/
| Surface | Path | Verdict | Rationale | Phase |
|---------|------|---------|-----------|-------|

## styles.css (monolith)
| Surface | Path | Verdict | Rationale | Phase |
| styles.css | ui/src/styles.css | Demote | … | 124 |
```

Source: `121-CONTEXT.md` [VERIFIED]

### Anti-Patterns to Avoid

- **Scoring without reading imports/fetches:** AppShell defines six domain refresh callbacks; surfaces that only consume props still affect Phase 125/127 — note fetch mount site in rationale.
- **Deleting shared helpers in 121:** `inspectorHelpers.tsx` verdict applies to Phase 126; no code deletion in 121.
- **Treating UI-REVIEW as cut list:** Visual polish gaps (61-UI-REVIEW) ≠ product fit; cross-reference only.
- **Bundling ThemeToggle into TopBar row:** One row per `.tsx` file — ThemeToggle is its own row (likely Keep).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shell boundary enforcement | Custom lint DSL | Extend `tests/ui/shell-boundaries.test.ts` | Already encodes RunPanel/Advanced separation [VERIFIED] |
| Cut-list completeness check | Manual eyeball only | Small Node test: glob `ui/src/**/*.tsx` minus exclusions vs CUT-LIST paths | Prevents orphan files before 122 starts |
| Bundle baseline | Custom analyzer | `npm run build:ui` Vite size table | 522.60 kB JS / 45.52 kB CSS pre-milestone [VERIFIED: build 2026-05-24] |
| Product vision source of truth | New vision doc | Locked notes: `ui-shell-architecture.md`, `product-shell-entry-model.md`, `ui-product-simplification-decisions.md` | CONTEXT defers to these |

**Key insight:** Phase 121 value is **decision traceability**—each Demote/Delete must cite which of the five questions failed, not subjective “feels heavy.”

## Complete UI Inventory (audit rows)

26 `.tsx` files + `styles.css`. LOC from `wc -l` 2026-05-24. [VERIFIED]

### app/

| Surface | Path | LOC | Mount / fetch notes | Initial hypothesis |
|---------|------|-----|---------------------|-------------------|
| AppShell | `app/AppShell.tsx` | 453 | Mount: `/api/session`, SSE `/api/events`; defines all domain refresh fns | Keep structure; flag 125 |
| TopBar | `app/TopBar.tsx` | 173 | Run/stop/resume/pause APIs | Keep core; Demote extras → 123 |
| FirstRunLauncher | `app/FirstRunLauncher.tsx` | 170 | `refreshSavedSessions` on mount | Keep |

### canvas/

| Surface | Path | LOC | Notes | Initial hypothesis |
|---------|------|-----|-------|-------------------|
| GraphCanvas | `canvas/GraphCanvas.tsx` | 63 | ReactFlow wrapper | Keep |

### nodes/

| Surface | Path | LOC | Notes | Initial hypothesis |
|---------|------|-----|-------|-------------------|
| ExecutionNodeCard | `nodes/ExecutionNodeCard.tsx` | 268 | Inline prompt, context menu, plan CTA | Keep |
| NodeContextMenu | `nodes/NodeContextMenu.tsx` | 218 | Variant B sections | Keep |
| GraphActionModal | `nodes/GraphActionModal.tsx` | 104 | In-app modals for graph mutations | Keep |
| QualityLoopCardSummary | `nodes/QualityLoopCardSummary.tsx` | 29 | Card-level loop summary | Keep (Demote detail to Advanced if inspector deleted) |

### run-panel/

| Surface | Path | LOC | Notes | Initial hypothesis |
|---------|------|-----|-------|-------------------|
| RunPanel | `run-panel/RunPanel.tsx` | 157 | Shows WorkflowOverview when `!selectedNode` | Keep slim selected mode; Demote overview branch → 123 |
| WorkflowOverview | `run-panel/WorkflowOverview.tsx` | 125 | Status counts, node list, memory budget — overlaps TopBar | Demote or Delete → 123 |

### advanced/ (hub + tabs)

| Surface | Path | LOC | Notes | Initial hypothesis |
|---------|------|-----|-------|-------------------|
| AdvancedHub | `advanced/AdvancedHub.tsx` | 197 | Eager imports all tab views | Keep; 127 lazy-load |
| ModelsView | `advanced/ModelsView.tsx` | 22 | onMount → refreshModelLibrary | Keep |
| ModelLibraryPanel | `advanced/models/ModelLibraryPanel.tsx` | 221 | HF search/install | Keep |
| PluginsView | `advanced/PluginsView.tsx` | 20 | onMount → refreshPlugins | Keep |
| PluginPanel | `advanced/PluginPanel.tsx` | 271 | Install/doctor | Keep |
| SessionsView | `advanced/SessionsView.tsx` | 20 | onMount → refreshSavedSessions | Keep |
| SavedSessionPanel | `advanced/sessions/SavedSessionPanel.tsx` | 141 | Save/reopen | Keep |
| MemoryView | `advanced/MemoryView.tsx` | 18 | onMount → refreshMemory | Keep |
| MemoryPanel | `advanced/memory/MemoryPanel.tsx` | 131 | Scopes/preferences | Keep |
| SettingsView | `advanced/SettingsView.tsx` | 89 | Composes settings panels; default Advanced tab is `settings` | Keep container |

### advanced/settings/

| Surface | Path | LOC | Notes | Initial hypothesis |
|---------|------|-----|-------|-------------------|
| GraphWorkflowPanel | `advanced/settings/GraphWorkflowPanel.tsx` | 205 | Run variant, pipeline input, workflow save/load | Demote — review overlap with TopBar/shell → 126 |
| RefineGraphPanel | `advanced/settings/RefineGraphPanel.tsx` | 106 | Chat refine `/api/chat/message` | Demote or Delete → 122 |
| NodeInspector | `advanced/settings/NodeInspector.tsx` | 461 | Duplicate prompt, plan, graph actions | Demote (slim) → 126 |
| QualityLoopInspector | `advanced/settings/QualityLoopInspector.tsx` | 159 | Full loop drill-down | Demote or Delete → 122/126 |
| inspectorHelpers | `advanced/settings/inspectorHelpers.tsx` | 85 | Pure helpers for NodeInspector | Keep (or Demote with 126 slim) |

### shared/

| Surface | Path | LOC | Notes | Initial hypothesis |
|---------|------|-----|-------|-------------------|
| ThemeToggle | `shared/ThemeToggle.tsx` | 54 | No domain fetch | Keep |

### styles.css

| Surface | Path | LOC | Notes | Initial hypothesis |
|---------|------|-----|-------|-------------------|
| styles.css | `ui/src/styles.css` | 1803 | ~279 rules; no section comments; prefix clusters: node (47), loop (23), workflow (20), run (18), first-run (18) | Keep content; Demote monolith → 124 |

**Bundle baseline (pre-v1.19):** index JS 522.60 kB (gzip 164.75 kB); CSS 45.52 kB (gzip 8.01 kB). Single chunk — no code-splitting yet. [VERIFIED: `npm run build:ui`]

## Spec Drift Findings (audit inputs)

These are evidence-backed gaps between implementation and locked shell docs—planner should ensure cut list addresses them explicitly.

| Finding | Spec source | Implementation | Likely verdict direction |
|---------|-------------|----------------|-------------------------|
| Run panel visible without selection | `ui-shell-architecture.md`: “panel hidden when no selection” | `RunPanel.tsx` renders `WorkflowOverview` when `!selectedNode` | Demote WorkflowOverview or change RunPanel behavior (123) |
| Run panel “no edit fields” | Same doc | Selected mode is approve/clarify only — PASS | Keep selected branch |
| Thin TopBar | Same doc: status, run/stop, Advanced | TopBar adds approval pill, run variant pill, resume, pause, theme, pipeline confirm modal | Demote/trim (123) |
| Prompt edit on card only | CONTEXT + shell doc | `NodeInspector` has full prompt textarea + plan buttons (461 LOC) | Demote/slim (126) |
| Chat refine demoted | `ui-product-simplification-decisions.md` | `RefineGraphPanel` still in Settings with `/api/chat/message` | Demote or Delete (122) |
| Domain fetches on workflow mount | `61-02-PLAN`: Advanced-only domain fetch | AppShell only calls `refresh()` + SSE on workflow mount — PASS for domain endpoints; launcher triggers `refreshSavedSessions` | Keep; note 125 for state location |
| AdvancedHub eager load | Phase 127 goal | Static imports of all views in `AdvancedHub.tsx` | Keep hub; 127 lazy routes |

[VERIFIED: source reads + shell-boundaries.test.ts + ui-shell-architecture.md]

## Common Pitfalls

### Pitfall 1: Incomplete inventory
**What goes wrong:** A `.tsx` file ships to Phase 122 without a verdict; execution phases guess.
**Why it happens:** New files added after audit; glob excludes misunderstood.
**How to avoid:** Automated completeness test comparing `ui/src/**/*.tsx` minus `{main.tsx}` to CUT-LIST paths.
**Warning signs:** Cut list row count ≠ 27.

### Pitfall 2: Conflating Demote with Delete
**What goes wrong:** Delete verdict on surface still needed via Advanced API (e.g., expert overrides).
**Why it happens:** Q1 “not graph-first” scored without Q3 recoverability check.
**How to avoid:** Delete only when capability exists elsewhere (card, menu, or different Advanced panel).
**Warning signs:** Phase 122 removes panel that was sole UI for an API route.

### Pitfall 3: Scope creep into execution
**What goes wrong:** Phase 121 PR removes components or refactors AppShell.
**Why it happens:** Obvious delete targets tempt immediate fixes.
**How to avoid:** Phase boundary: only `.planning/.../121-CUT-LIST.md` (+ optional completeness test) change.
**Warning signs:** Any diff under `ui/src/` in Phase 121 commits.

### Pitfall 4: CSS row too vague
**What goes wrong:** Phase 124 cannot split monolith without target file boundaries.
**Why it happens:** Single “split styles.css” rationale with no clusters.
**How to avoid:** In cut list CSS row rationale, list top prefix clusters (node, workflow, run, advanced, first-run, plugin, session, memory, modal) and tie to future files.
**Warning signs:** Phase 124 plan re-audits CSS from scratch.

### Pitfall 5: Ignoring static regression tests
**What goes wrong:** Cut list recommends RunPanel changes that violate `shell-boundaries.test.ts`.
**Why it happens:** Audit doc not cross-checked against encoded contracts.
**How to avoid:** Note in cut list when verdict requires updating tests in execution phase (123/126).
**Warning signs:** `tests/ui/shell-boundaries.test.ts` failures after 123.

## Code Examples

### Static boundary test pattern (extend for cut-list completeness)

```typescript
// Source: tests/ui/shell-boundaries.test.ts [VERIFIED]
test("run-panel/ must not import from advanced/", () => {
  for (const file of listTsFiles(runPanelDir)) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /from\s+['"][^'"]*advanced/);
  }
});
```

### Proposed cut-list completeness test (Wave 0 or Phase 121 task)

```typescript
// Pattern: tests/ui/cut-list-completeness.test.ts [ASSUMED — file does not exist yet]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const CUT_LIST = readFileSync(
  ".planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md",
  "utf8",
);
const UI_SRC = join(process.cwd(), "ui/src");

function allTsxExceptMain(dir: string): string[] {
  /* glob ui/src/**/*.tsx, exclude main.tsx */
  return []; // implement same as shell-boundaries listTsFiles
}

test("121-CUT-LIST.md covers every auditable tsx surface", () => {
  for (const rel of allTsxExceptMain(UI_SRC)) {
    assert.match(CUT_LIST, new RegExp(rel.replace(/\//g, "[/\\\\]")));
  }
  assert.match(CUT_LIST, /styles\.css/);
});
```

### Bundle baseline capture (weight-cost column)

```bash
# Source: npm run build:ui output [VERIFIED 2026-05-24]
npm run build:ui
# Record: dist/assets/index-*.js and index-*.css sizes from Vite table
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic `main.tsx` (~3000 LOC) | Component tree under `ui/src/` | Phase 61 | Audit targets extracted files |
| Scrollable sidebar junk drawer | Workflow + Advanced hub | Phase 61 | Vision docs locked in `ui-shell-architecture.md` |
| Audit-after-delete | Audit-first cut list | v1.19 milestone | Phase 121 blocks 122–127 |
| window.prompt graph actions | GraphActionModal | Phase 01 wave 1 | NodeContextMenu uses modals [VERIFIED: GraphActionModal exists] |

**Deprecated/outdated:**
- Treating chat refine as default authoring path — demoted since Phase 30; `RefineGraphPanel` summary text still says “optional secondary” [VERIFIED: RefineGraphPanel.tsx]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ThemeToggle` gets its own cut-list row (not merged into TopBar) | Inventory | Minor table formatting issue |
| A2 | `inspectorHelpers.tsx` included as auditable `.tsx` row | Inventory | CONTEXT says exclude shared primitives unless fetch weight — helper is borderline |
| A3 | Phase 121 may add `cut-list-completeness.test.ts` | Validation | Optional; manual checklist works if test deferred |

## Open Questions (RESOLVED)

1. **WorkflowOverview fate: merge into TopBar vs hide run panel when no selection?**
   - **Resolution:** Demote with Phase 123 owner. Rationale: duplicates TopBar status; run panel should be selection-gated per ui-shell-architecture.md. Phase 123 decides merge vs hide.

2. **GraphWorkflowPanel: keep run-variant in Advanced only or align entirely with TopBar?**
   - **Resolution:** Demote with Phase 126 owner. Run-variant display stays on TopBar during run; panel retains workflow save/load and pipeline input in Advanced only.

3. **CSS breakdown granularity in cut list?**
   - **Resolution:** Single `styles.css` row with Verdict Demote; attach concern clusters (canvas, node cards, run panel, advanced hub) in rationale for Phase 124 split — no sub-rows.

## Environment Availability

Step 2.6: Minimal external dependencies — documentation phase.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `tests/ui`, audit scripts | ✓ | (host) | — |
| npm | `build:ui`, test suite | ✓ | — | — |
| Vite | Bundle baseline | ✓ | 7.3.3 | Record sizes manually if build skipped |
| Rust control server | Not required for 121 | — | — | Audit is static |

**Missing dependencies with no fallback:** None for Phase 121.

## Validation Architecture

Nyquist validation enabled (`workflow.nyquist_validation: true`). [VERIFIED: `.planning/config.json`]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner + tsx import |
| Config file | none — `node --import tsx --test tests/ui` |
| Quick run command | `node --import ./scripts/test-ram-preload.mjs --import tsx --test tests/ui/shell-boundaries.test.ts` |
| Full suite command | `node --import ./scripts/test-ram-preload.mjs --import tsx --test tests/ui` (via `npm test`) |

### Phase Requirements → Test Map

Roadmap success criteria (no REQ IDs mapped):

| Criterion | Behavior | Test Type | Automated Command | File Exists? |
|-----------|----------|-----------|-------------------|-------------|
| Every component mapped to verdict | CUT-LIST covers all tsx + styles.css | static/doc | `node --test tests/ui/cut-list-completeness.test.ts` (proposed) | ❌ Wave 0 |
| Mandatory surfaces explicitly scored | CUT-LIST summary callouts | manual/doc review | grep CUT-LIST for RefineGraphPanel, etc. | ❌ artifact |
| Cut list committed for 122–127 | File at phase path | file existence | `test -f .planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md` | ❌ Wave 0 |
| No ui/src code changes | Phase boundary | git diff | `git diff --quiet ui/src/` after phase | n/a |

### Sampling Rate

- **Per task commit:** Manual checklist — 27 rows present, 7 mandatory callouts in summary
- **Per wave merge:** Run `tests/ui` if completeness test added; else doc review only
- **Phase gate:** `121-CUT-LIST.md` committed; optional completeness test green; `ui/src/` unchanged

### Wave 0 Gaps

- [ ] `121-CUT-LIST.md` — primary deliverable (Phase 121 execution)
- [ ] `tests/ui/cut-list-completeness.test.ts` — optional automated coverage gate
- [ ] Bundle baseline line in CUT-LIST summary — capture from `npm run build:ui`

## Security Domain

Phase 121 produces documentation only; no new attack surface. Audit should note surfaces that expose sensitive operations for downstream phases (not new mitigations here).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — local control server |
| V3 Session Management | no | N/A for audit doc |
| V4 Access Control | no | — |
| V5 Input Validation | indirect | Flag panels with user JSON/API input (NodeInspector expert tiers) for 126 review |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Accidental removal of approval/clarify UI | Elevation of privilege (auto-run) | Keep RunPanel approve/clarify paths; tests in shell-boundaries |
| Delete panel sole doctor/install UI | Denial of service | Q3 recoverability before Delete verdict |

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` files found. [VERIFIED: glob empty]

From `AGENTS.md` (applicable to downstream phases, not 121 edits):

- `npm run check` is full contributor gate; autonomous agents use `npm run test:agent:verify:light` only
- UI talks to Rust HTTP API only — audit assumes no new endpoints (matches CONTEXT deferred)
- Do not run heavy build chains in autonomous mode without RAM gate

## Sources

### Primary (HIGH confidence)
- `.planning/phases/121-ui-vision-audit-and-cut-list/121-CONTEXT.md` — locked decisions, cut list format
- `.planning/notes/ui-product-simplification-decisions.md` — 5-question audit framework
- `.planning/notes/ui-shell-architecture.md` — shell contracts
- `.planning/notes/product-shell-entry-model.md` — graph-first product identity
- `ui/src/**` — inventory LOC, imports, fetch patterns [VERIFIED: grep, wc, read]
- `tests/ui/shell-boundaries.test.ts` — encoded shell boundaries
- `npm run build:ui` output — bundle baseline

### Secondary (MEDIUM confidence)
- `.planning/milestones/v1.8-phases/61-ui-shell-rewrite/61-UI-REVIEW.md` — prior 6-pillar audit methodology
- `.planning/ROADMAP.md` — Phases 121–128 success criteria

### Tertiary (LOW confidence)
- Proposed `cut-list-completeness.test.ts` — pattern only, not yet in repo [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; verified package.json and build
- Architecture: HIGH — full inventory and spec drift documented from source
- Pitfalls: HIGH — grounded in CONTEXT boundary and existing tests

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable audit methodology; refresh if `ui/src/` file count changes)
