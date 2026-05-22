---
phase: 30
slug: plan-from-node-foundation
status: draft
shadcn_initialized: false
preset: none
created: "2026-05-21"
---

# Phase 30 — UI Design Contract

> Visual and interaction contract for model-driven plan-from-node authoring. Replaces keyword `plannedChildrenFor` heuristics with structured planner output, demotes chat-first pre-run flow, and surfaces explicit planning failure states (PLAN-01–04, PLAN-07).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled CSS; no `components.json`) |
| Preset | not applicable |
| Component library | React 19 + `@xyflow/react` + plain CSS (`ui/src/styles.css`) |
| Icon library | `lucide-react` (`GitBranchPlus`, `Check`, `AlertTriangle`, `RefreshCw`, etc.) |
| Font | `"Aptos", "Segoe UI", sans-serif` (`:root` in `ui/src/styles.css`) |

**Source:** Existing v1.1/v1.4 UI contracts and live stylesheet tokens — no new design system initialization for this phase.

---

## Spacing Scale

Declared values (multiples of 4 only; match `:root` CSS variables):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, pill padding, inline metadata |
| sm | 8px | Compact stacks, `.actions` gaps, node header padding |
| md | 16px | Default panel/card padding, inspector section rhythm |
| lg | 24px | Section breaks inside inspector |
| xl | 32px | Canvas breathing room around focused root |
| 2xl | 48px | Major layout offsets (unused in compact controls) |
| 3xl | 64px | Not used in this phase |

**Exceptions:** Node-card primary submit button uses **min-height 44px** touch target (extends default 36px button rule on the card footer only).

---

## Typography

Exactly **four** sizes, **two** weights (`400`, `700`).

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 | 1.5 |
| Label | 12px | 700 | 1.35 |
| Heading | 22px | 700 | 1.2 |
| Meta | 11px | 400 (700 for uppercase status pills) | 1.35 |

Uppercase labels (`label`, `.port-heading`, `.budget-stop`) use Label role at weight 700 only.

---

## Color

Rough **60 / 30 / 10** split (unchanged from established composer shell):

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#eef2ef` | Canvas / page background |
| Secondary (30%) | `#f8faf8`, `#fbfcfd` | Inspector rail, node cards, muted panels |
| Accent (10%) | `#2d6cdf` | Focus ring, running node border, planning-in-progress spinner accent |
| Primary control fill | `#1f3d32` | Default filled buttons (Plan, Save prompt, Extend budget) |
| Destructive | `#923b34` | Stop run, abort clarification — **not** used for planning failures |
| Approval / budget stop | `#c98526` border, `#fde8e8` / `#8f2f2f` text | `awaiting_approval` node border, `.budget-stop`, planning error banners |

**Accent reserved for:** focus-visible outlines, running/planning-in-progress emphasis on the active node border, highlighted planner diagnostics link — **not** all interactive elements.

**Planning failure surfaces** use `.meta-row.warning` / `.error` palette (`#fff3f0` background, `#e4b0a8` border, `#8f2f2f` text) — distinct from destructive run-stop actions.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (node card) | **Plan children** — invokes model planner on the selected node |
| Primary CTA (inspector, secondary) | **Plan** — same action; mirrors node-card CTA when node is selected |
| Save before plan | **Save prompt** — persists prompt edits before planning |
| Budget exhausted | **Extend budget** — when `planBudget.exhausted === true` |
| Approval gate | **Approve plan** — when node status is `awaiting_approval` after budget exhaustion |
| Empty root heading | **Start with a task** |
| Empty root body | **Describe what you want to accomplish, then choose Plan children on the root composer to draft child nodes.** |
| Root focus hint (inspector) | **Root composer selected — planning creates direct child nodes from your prompt.** |
| Planning in progress | **Planning children…** (node card + inspector; non-blocking) |
| Planning success | **Plan ready** — `{N} child nodes drafted. Review on canvas, then approve or run.** |
| Error: `planning_failed` | **Planning failed:** {message}. **Check the planner model tier and prompt, then try Plan children again.** |
| Error: `invalid_planner_output` | **Planner returned invalid output.** {details}. **No fallback was applied. Fix configuration or retry.** |
| Error: empty prompt | **Prompt required:** **Enter a non-empty prompt before planning.** |
| Error: budget exhausted (blocking plan) | **Plan budget exhausted.** **Extend budget or approve to continue planning.** |
| Chat panel label (demoted) | **Refine graph (optional)** |
| Chat panel helper | **Use chat to preview edits after planning. Graph submit is the default authoring path.** |
| Destructive confirmation | **None in Phase 30** — parent replan replaces pristine auto-planned descendants silently (PLAN-04). Replace/Merge/Cancel deferred to Phase 31. |

All API error surfaces must show `MutationError` `message`, and when present `details` + `suggestedFix`, in the inspector `.error` banner and node-scoped `.meta-row.warning` block.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | _(none)_ | not applicable — no `components.json` |
| Third-party registries | _(none)_ | not applicable |

**Pinned runtime UI dependencies:** `@xyflow/react`, `lucide-react` (npm lockfile only — no dynamic registry fetch).

---

## Layout & Regions

| Region | Phase 30 behavior |
|--------|-------------------|
| Graph canvas | **Primary authoring surface.** On first load with only `root-composer`, viewport centers on root; root card receives visual focus ring (accent outline, 2px, offset 2px) until another node is selected. |
| Node card | **Primary submit affordance** lives on the card footer: prompt textarea (inline, compact min-height 80px on card) + **Plan children** button. Card remains 360px wide. |
| Inspector (right rail, 380px) | Node detail, budget strip, model trail, and duplicate Plan/Save/Extend/Approve actions for keyboard users. Chat/refinement sections move **below** node inspector blocks. |
| Chat refinement | Demoted: section label **Refine graph (optional)**; collapsed by default on empty graph, expandable. Never blocks first plan submit. |
| Run header | Unchanged — **Run workflow** remains separate from planning; run stays disabled until graph readiness confirms. |

**Responsive:** `@media (max-width: 800px)` stacked layout preserves node-card Plan children as primary; inspector scroll order: selected node → plan actions → optional chat.

---

## First-Run & Root Composer (PLAN-01)

1. Session bootstrap creates exactly one editable node: `root-composer`.
2. UI auto-selects `root-composer` on load when it is the only node.
3. Root card shows empty prompt field focused (caret visible); no global pre-run chat step required.
4. Submitting **Plan children** with non-empty prompt immediately calls `POST /api/nodes/root-composer/plan` — no intermediate chat turn.
5. Empty canvas copy uses **Empty root heading/body** contract above when graph has only root with no children.

---

## Plan-from-Node Interaction (PLAN-02, PLAN-03)

| Action | Contract |
|--------|----------|
| Plan on root | Model planner returns structured child nodes (label, prompt, type, complexity); children render on canvas without auto-run. |
| Plan on child | Plans **direct children only** for that node; planner receives concatenated ancestor prompts/labels to budget root. |
| Save prompt | Required before plan when prompt textarea is dirty; auto-save-on-plan is acceptable if implemented atomically server-side. |
| Replan parent (PLAN-04) | Resubmit **Plan children** on parent silently replaces descendants with `planned` status and no user overrides; manual/pinned children remain untouched. **No confirmation dialog in Phase 30.** |
| Break down | Unchanged secondary action for high-complexity nodes (`Break down` label, scissors icon). |
| Pending plan | When `composer.pendingPlan` is set, show summary line on card: **Draft plan:** {summary} · {child count} nodes |

---

## Planning & Failure States (PLAN-07)

| State | Visual | Copy / behavior |
|-------|--------|-----------------|
| Planning in progress | Node border accent `#2d6cdf`; disable Plan button; show **Planning children…** | No silent timeout — surface API error on failure |
| Plan success | New child nodes appear; parent status stays editable (`planned` / `ready`) | Inspector shows **Plan ready** meta row |
| `planning_failed` | Node `.meta-row.warning` + inspector `.error`; optional `AlertTriangle` icon on card | Show planner purpose, model used, redacted validation error from trace/diagnostics when API provides them |
| `invalid_planner_output` | Same failure styling as above | Explicit **No fallback was applied** line — never show heuristic children |
| Budget exhausted | Node status → `awaiting_approval`; border `#c98526`; `.budget-stop` pill **needs approval to expand** | **Extend budget** enabled; **Approve plan** when token present |
| CLI parity | N/A in UI spec | Error codes `planning_failed`, `invalid_planner_output` must match `MutationError` payloads surfaced in inspector |

**No silent fallback:** UI must never render keyword-heuristic children after planner failure. Failed plan leaves graph unchanged except failure metadata on the planning node.

---

## Node Card Anatomy (Phase 30 delta)

Each editable composer node card exposes:

1. **Header:** type, status, complexity pill (unchanged).
2. **Inline prompt:** compact textarea when node is selected **or** always on root-composer.
3. **Budget strip:** existing `budget-line` with exhausted pill (unchanged).
4. **Footer actions:** **Plan children** (primary, `#1f3d32` fill), **Break down** (secondary, when `recommendedAction === "break_down"` or complexity high).

Inspector duplicates Plan/Save/Extend/Approve for accessibility; node card is the default path per CONTEXT.

---

## Chat Demotion (SURF-02 partial)

- Rename inspector section from **Chat mutation** to **Refine graph (optional)**.
- Move section below node inspector and saved-session blocks.
- Helper copy states graph submit is default; chat is for post-plan refinement previews only.
- Do **not** remove chat API wiring — demote visually and in copy only.

---

## Accessibility

- **Plan children** on node card: `aria-label="Plan children for {node.label or node.id}"`.
- Planning-in-progress: `aria-busy="true"` on submitting node card.
- Failure banners: `role="alert"` on `.error` and node-scoped planning failure blocks.
- Focus order: root prompt → Plan children → inspector duplicate controls.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
