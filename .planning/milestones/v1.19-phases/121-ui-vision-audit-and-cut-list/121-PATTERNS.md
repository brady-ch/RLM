# Phase 121: UI Vision Audit and Cut List - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 1 (documentation deliverable)
**Analogs found:** 1 / 1

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md` | audit artifact | transform (inventory → scored verdicts) | `.planning/milestones/v1.18-phases/113-node-runtime-retirement-audit-and-cutover-gates/113-AUDIT.md` | exact |

**Read-only inputs (not modified in Phase 121):**

| Source | Role | Used for |
|--------|------|----------|
| `.planning/notes/ui-product-simplification-decisions.md` | decision note | Audit framework, initial hypotheses, phase sequence 122–128 |
| `.planning/notes/ui-shell-architecture.md` | vision ref | Locked shell model (canvas-default, Advanced takeover) |
| `.planning/notes/product-shell-entry-model.md` | vision ref | Graph-first product identity |
| `.planning/notes/ui-canvas-visual-polish-decision.md` | vision ref | Visual system criteria |
| `ui/src/**/*.tsx` (27 files) | inventory source | One row per audited `.tsx` |
| `ui/src/styles.css` (~1,803 lines) | inventory source | Separate audit row with split/defer guidance |

**Explicitly excluded from cut list rows (per CONTEXT):** `main.tsx`, test files, shared primitives without domain fetch weight (`shared/ThemeToggle.tsx`).

## Pattern Assignments

### `121-CUT-LIST.md` (audit artifact, transform)

**Analog:** `113-AUDIT.md` (Phase 113 TS-only path inventory — audit-only phase, directory-grouped inventory, downstream phase mapping)

**Audit-only boundary statement** (113-AUDIT.md lines 1–4):

```markdown
# Phase 113: TS-Only Path Inventory

**Phase 113 scope is audit-only — no `src/` deletions in this phase.**
```

Adapt for Phase 121:

```markdown
# Phase 121: UI Vision Cut List

**Phase 121 scope is audit-only — no component removals, refactors, or CSS edits in this phase.**
```

**Directory-grouped inventory section** (113-AUDIT.md lines 11–36):

```markdown
## cli

- **File count:** 12
- **Subdirectories:** `src/cli/`, `src/cli/run-modes/`
- **Mirrored tests path:** No direct `tests/cli/` mirror; UI wiring tests at `tests/ui/`
- **Target phase:** 115
- **Rust counterpart:** `crates/rlm-cli/src/` (command dispatch, stderr logging, shutdown)

Files:

```
src/cli/args.ts
src/cli/first-run.ts
...
```
```

Adapt for Phase 121 — group by `ui/src/` subdirectory (`app/`, `canvas/`, `nodes/`, `run-panel/`, `advanced/`, `advanced/settings/`, etc.). Each group gets a verdict table (not a raw file dump). Embed verified counts:

```bash
find ui/src -type f -name '*.tsx' | sort
find ui/src -type f -name '*.tsx' | wc -l   # expect 27
wc -l ui/src/styles.css                      # expect ~1803
```

**Downstream phase mapping summary** (113-AUDIT.md lines 273–283):

```markdown
## Deletion order (summary)

1. **Phase 114** — `src/application/control-server/`, ... — Gate: ...
2. **Phase 115** — `src/index.ts`, `src/cli/`, ...
...
Canonical teardown policy: `.planning/notes/rust-only-runtime-migration-decisions.md`
```

Adapt for Phase 121 — use `## Phase owner summary` instead of deletion order:

| Phase | Owner scope |
|-------|-------------|
| 122 | Advanced hub deletes |
| 123 | Workflow chrome |
| 124 | CSS split / dead rule removal |
| 125 | AppShell fetch decomposition |
| 126 | Node inspector & settings slim-down |
| 127 | Lazy routes & bundle impact |

Cross-reference: `.planning/notes/ui-product-simplification-decisions.md`

---

**Analog (scoring criteria):** `ui-product-simplification-decisions.md` (lines 20–30)

**Audit framework — 5 questions per surface:**

```markdown
## Audit framework (Phase 121)

Score every UI surface against these questions:

1. **Graph-first?** Does it help the user inspect, edit, approve, or run a node graph?
2. **Default path?** Should a first-run user see this before their first successful run?
3. **Recoverable state?** If removed from default view, can the user still reach it via Advanced when needed?
4. **Vision match?** Does it match locked shell architecture (no global panels on workflow view)?
5. **Weight cost?** Lines of code, CSS, bundle KB, mount-time fetches?

Verdicts: **Keep** (workflow or essential Advanced) · **Demote** (Advanced only, collapsed default) · **Delete** (no product fit post-audit)
```

**Initial hypothesis table to reconcile** (ui-product-simplification-decisions.md lines 34–50):

```markdown
| Surface | Path | Initial hypothesis |
|---------|------|-------------------|
| Workflow canvas | `canvas/`, `nodes/` | Keep — core product |
| TopBar | `app/TopBar.tsx` | Trim — status + run/stop + Advanced only |
| Run panel | `run-panel/` | Keep slim — approve/clarify only |
| WorkflowOverview | `run-panel/WorkflowOverview.tsx` | Review — may overlap TopBar |
| ...
| AppShell state | `app/AppShell.tsx` | Decompose — domain state out |
| styles.css | `ui/src/styles.css` | Split — ~1,800 lines monolith |
```

Phase 121 must produce final verdicts for every mandatory surface listed in CONTEXT (RefineGraphPanel, QualityLoopInspector, NodeInspector, WorkflowOverview, GraphWorkflowPanel, AppShell, styles.css).

---

**Analog (cut list table columns):** CONTEXT.md decisions + 113-AUDIT script/CI table (113-AUDIT.md lines 228–234)

**Required table schema** (one row per audited surface):

```markdown
| Surface | Path | Verdict | Rationale | Phase owner |
|---------|------|---------|-----------|-------------|
| Workflow canvas | `canvas/GraphCanvas.tsx` | Keep | Core graph-first product surface | — |
| Chat refine | `advanced/settings/RefineGraphPanel.tsx` | Demote | Graph authoring is default; recoverable in Advanced Settings | 122 |
| styles.css (monolith) | `ui/src/styles.css` | Demote | Keep styles; split structure deferred | 124 |
```

Rules from CONTEXT:
- **Verdict** — exactly one of: Keep, Demote, Delete
- **Rationale** — one line, references audit framework criterion
- **Phase owner** — 122–127 or `—` for Keep-with-no-change

---

**Analog (plan generation commands):** `113-01-PLAN.md` (lines 80–101)

**Inventory generation pattern — run commands, embed results, do not hand-wave counts:**

```bash
find ui/src -type f -name '*.tsx' | sort
find ui/src -type d | sort
wc -l ui/src/styles.css
```

For CSS section breakdown (Claude's discretion: section headers vs rule clusters), grep dominant selectors by concern:

```bash
grep -E '^\.(canvas|node-|run-|advanced|session-|modal-|graph-|workflow-|inspector|chat-refine|shell)' ui/src/styles.css | head -40
```

Group CSS audit guidance into concern clusters aligned with Phase 124: canvas/react-flow, node cards, run panel, Advanced hub, sessions, modals, legacy panels.

---

**Analog (UI surface audit with file citations):** `61-UI-REVIEW.md` (lines 54–59, 36–47)

**File-path traceability in rationale:**

```markdown
| UI-SPEC element | Implementation | Location |
|-----------------|----------------|----------|
| Context menu hint | "Right-click for actions" | `ExecutionNodeCard.tsx:189` |
| Advanced entry | "Advanced" | `TopBar.tsx:82` |
| Back from Advanced | "← Back to workflow" | `AdvancedHub.tsx:102` |
```

When scoring borderline surfaces, cite the implementing file and note vision mismatch (e.g., domain fetch in AppShell vs Advanced-only principle from ui-shell-architecture.md).

---

**Analog (acceptance verification table):** `113-VERIFICATION.md` (lines 16–21)

**Summary section pattern for 121-CUT-LIST.md:**

```markdown
## Summary

| Verdict | Count |
|---------|-------|
| Keep | N |
| Demote | N |
| Delete | N |

### Mandatory scored surfaces

| Surface | Verdict | Phase owner |
|---------|---------|-------------|
| RefineGraphPanel | Demote / Delete | 122 |
| QualityLoopInspector | Demote / Delete | 126 |
| NodeInspector | Demote (slim) | 126 |
| WorkflowOverview | Demote / trim | 123 |
| GraphWorkflowPanel | Review → verdict | 126 |
| AppShell.tsx | Keep structure; flag decomposition | 125 |
| styles.css | Demote monolith structure | 124 |
```

---

## Complete UI Inventory (audit scope)

Use this checklist to ensure every row is scored. Group in cut list by directory.

| Directory | Files (27 total `.tsx`; 25 audited + 1 CSS row) |
|-----------|---------------------------------------------------|
| `app/` | `AppShell.tsx`, `TopBar.tsx`, `FirstRunLauncher.tsx` |
| `canvas/` | `GraphCanvas.tsx` |
| `nodes/` | `ExecutionNodeCard.tsx`, `GraphActionModal.tsx`, `NodeContextMenu.tsx`, `QualityLoopCardSummary.tsx` |
| `run-panel/` | `RunPanel.tsx`, `WorkflowOverview.tsx` |
| `advanced/` | `AdvancedHub.tsx`, `ModelsView.tsx`, `PluginsView.tsx`, `MemoryView.tsx`, `SettingsView.tsx`, `SessionsView.tsx`, `PluginPanel.tsx` |
| `advanced/models/` | `ModelLibraryPanel.tsx` |
| `advanced/memory/` | `MemoryPanel.tsx` |
| `advanced/sessions/` | `SavedSessionPanel.tsx` |
| `advanced/settings/` | `RefineGraphPanel.tsx`, `QualityLoopInspector.tsx`, `NodeInspector.tsx`, `GraphWorkflowPanel.tsx`, `inspectorHelpers.tsx` |
| *(excluded)* | `main.tsx`, `shared/ThemeToggle.tsx` |
| `styles.css` | Monolith (~1,803 lines) — separate row |

**Keep anchors (from CONTEXT specifics):** workflow canvas, slim Run panel, FirstRunLauncher. Advanced hub retains Models · Plugins · Sessions · Memory · Settings tabs as power surface.

## Shared Patterns

### Audit-only phase boundary
**Source:** `113-AUDIT.md` lines 1–4, `113-CONTEXT.md` domain section
**Apply to:** `121-CUT-LIST.md` header and plan acceptance criteria

State explicitly that Phase 121 produces documentation only. No edits under `ui/src/`. Phases 122–127 execute against the cut list.

### Authoritative decision cross-reference
**Source:** `ui-product-simplification-decisions.md` lines 79–84
**Apply to:** Rationale column and audit framework section

```markdown
## References

- `.planning/notes/ui-shell-architecture.md`
- `.planning/notes/product-shell-entry-model.md`
- `.planning/notes/ui-canvas-visual-polish-decision.md`
- `.planning/notes/desktop-product-vision.md`
```

### Verdict criteria weighting
**Source:** `121-CONTEXT.md` decisions
**Apply to:** Every rationale line

Priority order when scoring:
1. Graph-first (highest weight)
2. Default path visibility
3. Recoverable via Advanced
4. Vision match (no domain panels on workflow view)
5. Weight cost (LOC, CSS, bundle KB, mount-time fetches — tiebreaker for Demote vs Delete)

### Phase executor handoff
**Source:** `113-VERIFICATION.md` lines 49–51
**Apply to:** Summary section footer

```markdown
## Ready for Phase 122

All Phase 121 deliverables present. Phase 122 executor should use `121-CUT-LIST.md` for Advanced hub pruning scope; Phases 123–127 use Phase owner column.
```

### Plan task structure (documentation generation)
**Source:** `113-01-PLAN.md` (lines 72–114)
**Apply to:** Phase 121 PLAN.md tasks

Pattern for audit plan tasks:
1. Run `find`/`wc` commands; embed verified counts
2. Read vision refs and initial hypothesis note first
3. Score each surface; reconcile hypotheses with final verdict
4. Append summary counts and mandatory surface table
5. Verify with grep acceptance checks (file exists, row count matches inventory)

Suggested acceptance grep checks for Phase 121:

```bash
test -f .planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md
grep -cE '\| (Keep|Demote|Delete) \|' .planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md  # >= 26
grep -E 'RefineGraphPanel|QualityLoopInspector|NodeInspector|WorkflowOverview|GraphWorkflowPanel|AppShell|styles\.css' .planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md
grep 'audit-only' .planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | All Phase 121 deliverables have analogs |

No UI-specific cut-list artifact exists yet; Phase 113 audit doc is the closest structural match. UI-REVIEW artifacts (`61-UI-REVIEW.md`, `51-UI-REVIEW.md`) provide scoring tone and file citations but use 6-pillar retroactive audit format — borrow traceability, not pillar structure.

## Metadata

**Analog search scope:** `.planning/phases/121-*`, `.planning/milestones/v1.18-phases/113-*`, `.planning/notes/ui-*.md`, `.planning/milestones/v1.8-phases/61-ui-shell-rewrite/61-UI-REVIEW.md`, `.planning/milestones/v1.7-phases/51-plugin-manager-ui/51-UI-REVIEW.md`, `ui/src/`
**Files scanned:** 12 planning artifacts + 27 UI source files
**Pattern extraction date:** 2026-05-24
