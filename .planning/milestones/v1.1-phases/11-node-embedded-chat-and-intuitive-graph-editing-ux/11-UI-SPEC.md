---
phase: 11
slug: node-embedded-chat-and-intuitive-graph-editing-ux
status: approved
shadcn_initialized: false
preset: none
created: "2026-05-12"
checker_reviewed: "2026-05-12"
---

# Phase 11 — UI Design Contract

> Visual and interaction contract for the typed dataflow node composer. Updated from roadmap + implementation (`ui/src/main.tsx`, `ui/src/styles.css`) and backlog items from milestone audit UXND parity.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled CSS; no Tailwind preset in-repo) |
| Preset | not applicable |
| Component library | Radix primitives not used — React 19 + `@xyflow/react` + plain CSS |
| Icon library | `lucide-react` (`Check`, `GitBranchPlus`, `Scissors`, `Square`, `Trash2`, `X`, etc.) |
| Font | `"Aptos", "Segoe UI", sans-serif` (`:root` in `ui/src/styles.css`) |

**Stack note:** Bundled via repo root `npm run dev:ui` / `build:ui` (Vite). Design tokens are authored in `ui/src/styles.css`, not CSS variables beyond `:root` text/background.

---

## Spacing Scale

Declared values for **new** work (multiples of 4 only).

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, tight inline padding |
| sm | 8px | Compact stacks, `.actions` gaps, toolbar gaps |
| md | 16px | Default panel/card padding, inspector section rhythm |
| lg | 24px | Inspector outer padding and section breaks |
| xl | 32px | Rare layout breathing room |
| 2xl | 48px | Major canvas chrome offsets |

**Legacy stylesheet:** Until refactors land, some rules in `ui/src/styles.css` still use gutters that visually match this scale but **are not authored with the tokens above**. Any file edit should snap padding/margin to xs–2xl multiples of **4px** (no stray odd pixels in new or touched rules).

---

## Typography

Exactly **four** sizes, **two** weights (`400`, `700`).

| Role | Size | Weight | Line height |
|------|------|--------|-------------|
| Body | 16px ( UA / `inherit` ) | 400 | 1.5 |
| Label | 12px | 700 (uppercase section labels only) | 1.35 |
| Heading | 22px (`h1` app chrome) | 700 | 1.2 |
| Meta / node chrome | 11px (`node-runtime`, `budget-line`) | 400 | 1.35 |

**Fourth size applied to alerts:** `.run-failure-hint` and `.error` use **Label (12px) / Weight 700** for emphasis where needed — no extra incremental sizes beyond the four roles above.

---

## Color

Rough **60 / 30 / 10** split for the composer shell:

| Role | Hex | Usage |
|------|-----|-------|
| Dominant (~60%) | `#eef2ef` | Canvas / page surface (`:root` background) |
| Secondary (~30%) | `#f8faf8`, `#fbfcfd` | Inspector rail, cards, muted panels |
| Accent (~10%) | `#2d6cdf` | **Only:** focus-visible outlines, active “running” node border accent, MiniMap/active edge emphasis — not default filled buttons |
| Primary control fill | `#1f3d32` | Default `button` background (semantic “go”, not counted as lavender accent) |
| Destructive | `#923b34` | `.danger` delete / irreversible subgraph actions |
| Failure surface | `#fde8e8` / `#a53d3d` borders | `.status.failed`, error nodes |

**Non-color cues:** Complexity pills, badges, uppercase status labels — never rely on hue alone for status (pair icon/text).

**Accent reserved for:** focus ring, running-state emphasis, highlighted control-plane link — **not** all interactive elements.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | **Run workflow** (when graph is runnable); **Approve plan** when approval gate applies |
| Expand planning | **Expand plan graph** (`Plan`), **Break down node** (`Break down`) |
| Empty canvas heading | **No nodes yet** |
| Empty canvas body | **Describe your task in the root composer, then use Expand plan graph to draft child nodes.** |
| Clarification banner | Preserve question text from runtime verbatim; actions **Submit answer** / **Abort run** |
| Error state | **Run stopped:** {reason}. **Inspect the failed node, fix inputs or approvals, then run again.** |
| Destructive confirmation | **Delete subgraph:** Requires explicit choice between **Delete subtree** and **Rewire dependents** when the API presents `pendingDeleteChoice`; no silent deletes. |

**Icon-only controls** (toolbar): must expose `aria-label` (and `title` mirroring production intent) matching `WR-04` remediation pattern.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | _(none)_ | not applicable |
| Custom shadcn / CLI registries | _(none)_ | not applicable — no `components.json` |

**Pinned runtime UI dependencies:** `@xyflow/react` `^12.8.7`, `lucide-react` `^0.468.0` (declared `package.json` + lockfile). Shipped as audited npm tarball installs only — **no third-party “block” URLs**, no dynamic registry fetch at build time besides `npm install`.

---

---

## Layout & Regions

| Region | Behavior |
|--------|----------|
| Graph canvas | Primary focal area — bounded `ReactFlow` with `Background`, `Controls`, `MiniMap` |
| Inspector | Right rail (380px desktop) — composer fields, approvals, clarification responses |
| Toolbar / header | Run/stop/session refresh — status adjacent, never hides graph |

**Responsive:** `@media (max-width: 800px)` stacks canvas over inspector — contract maintains same semantics, with the stacked inspector region sized for touch (`min-height` target **360px** band per stylesheet).

---

## Node Composer Anatomy

(Source: `11-CONTEXT.md` D-11-01…D-11-15 — locked.)

Each editable node exposes:

1. **Header:** title, type, **status badge** (`status-*` palette), complexity pill.
2. **Runtime lane:** composer `type` (`AI` \| `Code` \| `TTS` \| `Splitter` \| `Joiner` \| `Validator`) + runtime (`model` \| `code` \| `tts`).
3. **Body:** prompt textarea, code entry/sandbox summary, artifact ref list (metadata-only in graph).
4. **Ports:** `Handle` widgets — input (`#8250df`) vs output (`#1a7f37`), labeled with artifact type/schema.
5. **Context Policy** panel: reads / writes / limits / memory scopes.
6. **Planning:** `Plan`, `Break down`, budget strip (`remainingDepth`, `remainingNodes`, `approvalRequired`).
7. **Execution:** **Approve plan** / **Approve for run**, run integration via control server (`approvalToken`), pause/stop at shell level.

---

## Plan Mode UX

When user invokes **Expand plan graph** on a node:

1. Server returns pending subgraph; UI renders children **without** auto-run.
2. Each child surfaces **complexity**, **recommendedAction**, budgets.
3. **High** complexity shows **Break down node** recursively (same UX).
4. **Budget exhaustion:** banner `Needs approval to expand`; single **Extend budget** affordance mapped to Phase 11 approval policy (`planBudget.exhausted`).

No execution until explicit **Approve plan** or **Approve for run** (per approval mode).

---

## Graph Editing — Target Contracts (gap closure vs audit)

Roadmap milestone audit recorded partial UXND parity (“visual drag”, text-field wiring). The following are **explicit implementation targets** for the next executor pass:

| Topic | Contract |
|-------|----------|
| **Persisted layout** | `node.position` (and optionally `viewport` `{x,y,zoom}`) are part of authoritative session graph JSON — survive refresh and reopen of the same workspace session. Dragging updates session state debounced (~150ms); no purely ephemeral layout. |
| **Port-centric edges** | Default authoring path: connect **output handle → input handle** (creates typed edge metadata). Serialized edge SHOULD carry `sourceHandle` / `targetHandle` when available; free-text edge editing in inspector remains **repair/override** UX, not the happy path. |
| **Budget truth** | Composer displays `planBudget.used*` mirrored from backend snapshot after each `/session`/`/graph` mutation — never optimistic-only. |
| **Artifact & run-state cues** | When runtime emits artifact validation events, inspector shows concise validation line per ref (validated / skipped / failure) aligned with Phase 8.5 contracts. |

---

## Artifact & Book-Scale UX

Refs only in graph payloads (no raw book/audio inlined). Inspectors render:

- Ordering key / producer node / hash / duration / media type bullets.
- “Why this fits in context” blurb tying **Context Policy** to manifests + chunks (per CONTEXT example workflow).

Preview/stream actions may exist but **must not** stuff large blobs into Redux/graph JSON.

---

## First-Run Handoff

Aligned with Phase 10 UI-SPEC downstream:

- Opens on **editable root typed composer** prepared for first prompt.
- Visible **plan budget defaults** before expansion.
- Empty canvas copy uses **Empty state** contract above — not a canned fake graph unless user opts in via sample.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-05-12 (gsd-ui-checker)
