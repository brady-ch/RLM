# Phase 61 — UI Review

**Audited:** 2026-05-22
**Baseline:** `.planning/phases/61-ui-shell-rewrite/61-UI-SPEC.md`
**Screenshots:** not captured (no dev server on ports 3000, 5173, or 8080)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Contract copy mostly correct; root empty state still references obsolete “click Plan children” |
| 2. Visuals | 2/4 | Missing `.secondary` button styles; Run button misclassified; no status chip in card header |
| 3. Color | 3/4 | Tokens extracted but `styles.css` still hardcodes 80+ hex values; active outline uses wrong fallback blue |
| 4. Typography | 3/4 | Token scale (11/12/16/22px) dominates; two rogue sizes (`0.85rem`, `1rem`) outside scale |
| 5. Spacing | 3/4 | Layout dimensions match spec (360px card/panel); token spacing used consistently |
| 6. Experience Design | 2/4 | Graph actions use `window.prompt`/`confirm` instead of modals; no loading states |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **Add `.secondary` button variant and fix TopBar Run button class** — “Advanced” and “← Back to workflow” render as primary green buttons because `.secondary` is referenced in TSX but undefined in CSS; “Run workflow” uses `className="icon"` while showing text, producing cramped layout — define `.secondary` (outline/neutral surface) and give Run its own primary class in `styles.css` / `TopBar.tsx`.

2. **Replace browser dialogs for graph actions with in-app modals** — UI-SPEC maps “Add child…” and “Connect parent…” to modals; `NodeContextMenu.tsx` uses `window.prompt` and `window.confirm` (lines 157–191), breaking visual cohesion and mobile usability — add lightweight modal components matching existing `.modal-overlay` / `.modal-card` patterns in `legacy/panels.tsx`.

3. **Fix stale onboarding copy and add session/planning loading feedback** — Root empty state tells users to “click Plan children” (`ExecutionNodeCard.tsx:123`) but Plan moved to context menu only; users also get no feedback during initial `/api/session` fetch or while `planning-in-progress` — update copy to “Right-click → Plan children” and add a top-bar or canvas skeleton/spinner tied to `planningNodeId` and initial load.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**WARNING — Stale root empty-state copy**

```119:125:ui/src/nodes/ExecutionNodeCard.tsx
      {data.onlyRoot && node.id === "root-composer" ? (
        <div className="empty root-empty">
          <b>Start here — plan from this node</b>
          <span>
            Describe your workflow above, then click Plan children. Graph submit is the default
            authoring path.
          </span>
```

Phase 61 removed persistent Plan buttons; actions are context-menu only. Copy contradicts the new interaction model.

**PASS — Contract copy present**

| UI-SPEC element | Implementation | Location |
|-----------------|----------------|----------|
| Context menu hint | “Right-click for actions” | `ExecutionNodeCard.tsx:189` |
| Advanced entry | “Advanced” | `TopBar.tsx:82` |
| Back from Advanced | “← Back to workflow” | `AdvancedHub.tsx:102` |
| Run panel empty | Hidden (returns `null`) | `RunPanel.tsx:25–27` |

**WARNING — Clarification CTA delta**

UI-SPEC defers to Phase 30 for planning/error copy but Run panel contract lists “Submit / Abort”. Implementation uses “Submit answer” and “Abort run” (`RunPanel.tsx:107, 123`) — acceptable but slightly verbose.

**WARNING — Generic browser prompt strings**

`NodeContextMenu.tsx` uses bare “New child prompt” and “Parent node ID” as `window.prompt` titles — not user-facing product copy.

### Pillar 2: Visuals (2/4)

**WARNING — Undefined `.secondary` class**

`TopBar.tsx:81` and `AdvancedHub.tsx:101` apply `className="secondary"`, but `styles.css` defines no `.secondary` rule. Buttons inherit default primary styling (`background: var(--color-primary)`), so navigation affordances look identical to destructive/primary actions.

**WARNING — Run workflow button styling mismatch**

```51:68:ui/src/app/TopBar.tsx
      <button
        className="icon"
        aria-label="Run workflow"
        ...
      >
        Run workflow
      </button>
```

`.icon` sets `min-width: 36px; padding: 0` — appropriate for icon-only Stop, not a text CTA. Primary run action lacks visual prominence relative to spec top-bar hierarchy.

**WARNING — Node header missing status chip**

UI-SPEC anatomy: “Header: type, title, **status chip**, expert/runtime meta.” Implementation embeds status as raw text inside `.node-runtime` (`ExecutionNodeCard.tsx:95–98`) with no discrete chip/badge — hierarchy is muddier than sketch 002-B.

**PASS — Canvas chrome**

`GraphCanvas.tsx` includes Background, Controls, and MiniMap as specified.

**PASS — Selected node accent**

`.node-card-selected` applies `outline: 2px solid var(--color-accent)` with 2px offset (`styles.css:1077–1080`), matching spec `#2d6cdf`.

**needs_human_review: true** — Card density, header contrast, and canvas focal point cannot be fully judged without screenshots.

### Pillar 3: Color (3/4)

**PASS — Token file extracted**

`shared/tokens.css` defines `--color-accent: #2d6cdf`, `--color-primary: #1f3d32`, and surface tokens per UI-SPEC.

**WARNING — Token adoption incomplete**

Grep finds 80+ hardcoded hex values in `styles.css` (e.g. `#1f2937`, `#cbd5e1`, `#8250df`) that bypass CSS variables. Accent is applied correctly on selection but also scattered as literals (`#2d6cdf` at lines 305, 956, 961).

**WARNING — Active execution outline color drift**

```309:312:ui/src/styles.css
.node-card.active-execution {
  outline: 2px solid var(--accent, #3b82f6);
  outline-offset: 2px;
}
```

Uses undefined `--accent` with Tailwind-blue fallback `#3b82f6` instead of token `--color-accent` (`#2d6cdf`).

**WARNING — Hardcoded canvas background**

`GraphCanvas.tsx:57` — `color="#d8ded9"` should reference `var(--color-border)` or a grid token.

### Pillar 4: Typography (3/4)

**PASS — Token scale defined and mostly used**

`:root` sets `--font-body: 16px`, `--font-label: 12px`, `--font-heading: 22px`, `--font-meta: 11px`. Labels, meta rows, and headings reference these variables throughout `styles.css`.

**WARNING — Off-scale sizes**

- `.node-card.failed .node-failure-reason` — `font-size: 0.85rem` (`styles.css:316`)
- `.modal-card h2` — `font-size: 1rem` (`styles.css:167`)

Two extra sizes outside the 4-step scale; not severe but prevents strict contract compliance.

**PASS — Font family**

`tokens.css:27` — `"Aptos", "Segoe UI", sans-serif` matches UI-SPEC.

### Pillar 5: Spacing (3/4)

**PASS — Layout dimensions**

| Element | Spec | Implementation |
|---------|------|----------------|
| Node card width | 300–360px | `width: 360px` (`styles.css:297`) |
| Run panel | ~360px | `grid-template-columns: … 360px` (`styles.css:1053`) |
| Mobile breakpoint | 800px | `@media (max-width: 800px)` run panel bottom sheet (`styles.css:1159–1169`) |

**PASS — Spacing token usage**

Padding/gap consistently use `--space-xs` through `--space-2xl`; no Tailwind arbitrary values found in TSX.

**WARNING — Micro gap outside scale**

`.node-context-menu-section { gap: 2px; }` (`styles.css:1102`) — below `--space-xs` (4px).

### Pillar 6: Experience Design (2/4)

**BLOCKER-adjacent — Browser dialogs for graph mutations**

UI-SPEC context menu contract: “Add child…” and “Connect parent…” → **modal**. Implementation:

```156:191:ui/src/nodes/NodeContextMenu.tsx
          onClick={() => {
            const newChildPrompt = window.prompt("New child prompt");
            ...
          }}
          ...
          onClick={() => {
            const parentId = window.prompt("Parent node ID");
            ...
          }}
          ...
            if (window.confirm(`Delete subtree for ${node.label || node.id}?`)) {
```

Native dialogs block the UI thread, are inaccessible on some mobile browsers, and break the designed modal pattern already present in `legacy/panels.tsx`.

**WARNING — No loading states**

- Initial session: `AppShell` fetches `/api/session` with no loading indicator (`AppShell.tsx:84–90`, `144–154`).
- Planning: `planning-in-progress` class toggles on card (`ExecutionNodeCard.tsx:58`) but no global/top-bar spinner.
- Advanced views fetch on mount with no skeleton (`ModelsView`, `PluginsView`, etc.).

**PASS — Run panel behavior**

Returns `null` without selection; shows Approve/Skip when `awaiting_approval`; clarification block with disabled Submit when empty; readiness reason when run disabled.

**PASS — Context menu basics**

Right-click, ⋮ button, Shift+F10 / ContextMenu key open menu; Escape and outside-click dismiss; disabled items reflect node status; delete requires confirmation.

**WARNING — Context menu a11y gaps**

Menu has `role="menu"` / `role="menuitem"` but no arrow-key navigation, no focus trap, and no `aria-expanded` on ⋮ trigger — keyboard users can open but not traverse items per WAI-ARIA menu pattern.

**PASS — Advanced hub lazy fetch**

Domain APIs (`/api/model-library`, `/api/plugins`, etc.) only called from `onMount` in respective tab views — workflow mount limited to session + SSE per verification.

**PASS — Protected replan gate on card**

Replace / Merge / Cancel inline gate preserved on card (`ExecutionNodeCard.tsx:176–187`), not in context menu — matches spec.

---

## Files Audited

- `ui/src/app/AppShell.tsx`
- `ui/src/app/TopBar.tsx`
- `ui/src/canvas/GraphCanvas.tsx`
- `ui/src/nodes/ExecutionNodeCard.tsx`
- `ui/src/nodes/NodeContextMenu.tsx`
- `ui/src/run-panel/RunPanel.tsx`
- `ui/src/advanced/AdvancedHub.tsx`
- `ui/src/advanced/ModelsView.tsx`
- `ui/src/advanced/SettingsView.tsx`
- `ui/src/advanced/SessionsView.tsx`
- `ui/src/advanced/PluginsView.tsx`
- `ui/src/advanced/MemoryView.tsx`
- `ui/src/shared/tokens.css`
- `ui/src/styles.css`
- `ui/src/main.tsx`
- `ui/src/legacy/panels.tsx` (partial — modal patterns, legacy copy)
- `.planning/phases/61-ui-shell-rewrite/61-UI-SPEC.md`
- `.planning/phases/61-ui-shell-rewrite/61-VERIFICATION.md`
