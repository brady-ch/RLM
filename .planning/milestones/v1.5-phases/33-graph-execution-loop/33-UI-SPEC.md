---
phase: 33
slug: graph-execution-loop
status: draft
shadcn_initialized: false
preset: none
created: "2026-05-22"
---

# Phase 33 — UI Design Contract

> Visual and interaction contract for graph execution loop: per-node execution progress on the canvas during interactive runs, runtime/expert badges on the active node, and failure states that visibly block dependent descendants.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled CSS; no `components.json`) |
| Preset | not applicable |
| Component library | React 19 + `@xyflow/react` + plain CSS (`ui/src/styles.css`) |
| Icon library | `lucide-react` (`Square`, `Check`, `AlertTriangle`, `RefreshCw`, etc.) |
| Font | `"Aptos", "Segoe UI", sans-serif` (`:root` in `ui/src/styles.css`) |

**Source:** Phase 30 UI contract and live stylesheet tokens — no new design system initialization.

---

## Spacing Scale

Declared values (multiples of 4 only; match `:root` CSS variables):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, badge padding, inline metadata |
| sm | 8px | Compact stacks, node header padding, badge row gaps |
| md | 16px | Default panel/card padding, inspector section rhythm |
| lg | 24px | Section breaks inside inspector |
| xl | 32px | Canvas breathing room around active node focus |
| 2xl | 48px | Not used in this phase |
| 3xl | 64px | Not used in this phase |

**Exceptions:** Node-card primary submit button retains **min-height 44px** touch target from Phase 30. Execution badge row uses **min-height 20px** pills (compact, not a touch target).

---

## Typography

Exactly **four** sizes, **two** weights (`400`, `700`).

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 | 1.5 |
| Label | 12px | 700 | 1.35 |
| Heading | 22px | 700 | 1.2 |
| Meta | 11px | 400 (700 for uppercase status pills and badges) | 1.35 |

Uppercase labels (`label`, `.port-heading`, `.status`, `.badge`) use Label or Meta role at weight 700 only.

---

## Color

Rough **60 / 30 / 10** split (unchanged from established composer shell):

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#eef2ef` | Canvas / page background |
| Secondary (30%) | `#f8faf8`, `#fbfcfd` | Inspector rail, node cards, muted panels |
| Accent (10%) | `#2d6cdf` | Focus ring, **running** node border, active execution badge fill |
| Success | `#3d8b57` | **Completed** node border |
| Blocked / skipped | `#8a8f8b` border, `#f2f2f2` fill | **Skipped** (blocked-by-failure) node border and badge |
| Primary control fill | `#1f3d32` | Run workflow, Save prompt, Extend budget |
| Destructive | `#923b34` | Stop run — **not** used for node execution failures |
| Failure surface | `#fff3f0` background, `#e4b0a8` border, `#8f2f2f` text | Failed node reason rows, bind/runtime errors |

**Accent reserved for:** focus-visible outlines, **running** node border (`#2d6cdf`), running-state expert/runtime badge emphasis, run-header active-node highlight — **not** all interactive elements.

**Completed** nodes use existing green border (`#3d8b57`); **failed** nodes use existing red border (`#a53d3d`).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (run) | **Run workflow** — starts graph executor on approved topology (unchanged) |
| Run in progress (header) | **Running** — with subline **Executing {completed}/{total} nodes** when graph executor is active |
| Active node subline (header) | **Current:** {node.label or node.id} |
| Expert badge (running node) | **Expert:** {expertAgentId} — e.g. `coding`, `default` |
| Runtime badge (running node) | **{runtime label}** — `single-pass` → **Single-pass**; `rlm` → **RLM** |
| Custom assignment badge | **custom** — when `expertAssignmentMode === "custom"` (unchanged from Phase 32) |
| Node running (card) | Header shows `{composer.type} · running` (status string unchanged) |
| Node completed (card) | No extra banner; green border is sufficient. Inspector: **Completed** status row. |
| Node failed (card + inspector) | **Node failed:** {message}. **Fix the error on this node or replan, then run again.** |
| Node blocked (skipped dependent) | **Blocked:** upstream **{ancestor label}** failed. **{failure message}** |
| Bind failure (pre-run or at bind) | **Expert bind failed:** unknown agent **'{expertAgentId}'**. **Choose a valid expert preset before run.** |
| Runtime mode error | **Runtime mode error:** **'{mode}'** is not supported. **Set runtime to Single-pass or RLM.** |
| Empty execution trace | **No execution output yet.** **Run the workflow to see per-node results here.** |
| Run stopped (header) | **Run stopped:** {runSummary.message} (existing pattern) |
| Destructive confirmation | **Stop run** — no modal; immediate POST `/api/stop` (unchanged) |

All API error surfaces must show `MutationError` `message`, and when present `details` + `suggestedFix`, in inspector `.error` banner and node-scoped `.meta-row.warning` block.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | _(none)_ | not applicable — no `components.json` |
| Third-party registries | _(none)_ | not applicable |

**Pinned runtime UI dependencies:** `@xyflow/react`, `lucide-react` (npm lockfile only — no dynamic registry fetch).

---

## Layout & Regions

| Region | Phase 33 behavior |
|--------|-------------------|
| Graph canvas | **Primary execution progress surface.** Node cards reflect live `status` via session event refresh (no new polling channel). During run, canvas remains pannable; node drag/connect disabled while any node is `running`. |
| Node card | Status-driven border color (existing `.running`, `.completed`, `.failed`). **New:** `.skipped` styling for blocked dependents. **New:** `.execution-badges` row under header when `status === "running"`. Failure/blocked reason in `.meta-row.warning` on card body. |
| Inspector (right rail, 380px) | **Execution panel** at top of selected node when run is active or node is terminal: status, expert, runtime, effective model, failure/blocked reason. Expert override controls **disabled** while node or any graph node is `running`. |
| Run header | Existing status pill + **Executing {n}/{total}** subline when run active; **Current:** line names the active `running` node id/label. Stop run remains accessible. |

**Responsive:** `@media (max-width: 800px)` — execution badges and failure rows remain on node card (primary surface); inspector execution panel scrolls above expert controls.

---

## Graph Execution Progress (EXEC-01)

### Refresh model

- UI continues to refresh graph snapshot via existing session subscriber / polling used today — **no new SSE or polling channel**.
- On each refresh during run, re-render all node cards with current `status`, expert fields, and failure metadata.

### Run header progress

When session snapshot indicates graph execution is active (`status === "running"` or any node `running`):

1. Header status pill: **Running**.
2. Subline: **Executing {completedCount}/{executableCount} nodes** — count nodes in terminal success states (`completed`, `skipped`) vs nodes that were eligible to execute (approved topology, excluding `planned`/`ready` never reached).
3. When exactly one node has `status === "running"`, show **Current: {label}** beneath counts.

When run reaches terminal state, header uses existing `uiRunStatusLabels` and `runSummary.message` (failed/cancelled/completed).

### Canvas focus (optional, implementer discretion)

- If viewport is idle when a node transitions to `running`, subtle pan-to-node is acceptable but **not required** in v1 — status borders and badges are the contract.

---

## Per-Node Execution Status (EXEC-01, EXEC-03)

| Status | Node card border | Card body | Inspector |
|--------|------------------|-----------|-----------|
| `approved` (pre-run) | Default `#4b5563` | Unchanged planning UI | Expert controls editable |
| `running` | Accent `#2d6cdf` (existing `.node-card.running`) | Execution badges row; disable plan actions | Execution panel: **Running**; show live expert, runtime, effective model |
| `completed` | Success `#3d8b57` (existing) | Optional compact **Completed** meta row | Execution panel: timestamps if `startedAt`/`completedAt` present |
| `failed` | Failure `#a53d3d` (existing) | `.meta-row.warning` with **Node failed:** copy | Full failure message + trace excerpt when API provides |
| `skipped` (blocked dependent) | **New** dashed `#8a8f8b`, fill `#fafafa` | `.meta-row.warning` with **Blocked:** copy | Block reason + blocking ancestor id/label |
| `cancelled` | Existing cancelled styling | Unchanged | Unchanged |

**Planning-in-progress** styling (`.planning-in-progress`) takes precedence over execution status only while `planningNodeId` is set — mutually exclusive with run.

### Node card anatomy delta

1. **Header:** type + status string (unchanged).
2. **Execution badges** (new, `status === "running"` only): horizontal row `.execution-badges` with:
   - `.badge.badge-expert` — Expert: {id}
   - `.badge.badge-runtime` — Single-pass or RLM
   - `.badge` custom pill when `expertAssignmentMode === "custom"`
3. **Failure / blocked row** (when `failed` or `skipped` with block reason): `.meta-row.warning` + `AlertTriangle` icon.
4. **Footer:** Plan children / Break down disabled when `status` is `running`, `completed`, `failed`, `skipped`, or `cancelled`.

---

## Runtime Mode & Expert Badges (EXEC-02, EXEC-03)

| Field | Display rule |
|-------|--------------|
| `expertAgentId` | Badge text exactly as stored (`default`, `coding`, `qa`, `product_designer`, `research`) |
| `expertRuntime` | `single-pass` → badge **Single-pass**; `rlm` → badge **RLM** |
| `expertAssignmentMode` | Show **custom** badge adjacent to expert badge when `"custom"` |
| `effectiveModel` | Inspector execution panel only during/after run — not required on card badge row |

Badges use existing `.badge` base styles with additions:

- `.badge-expert` — background `#e8f0ff`, border `#b7c9ef` (unchanged)
- `.badge-runtime` — background `#e6f4ea`, border `#9fd4ae`, text `#1f3d32` when running; meta weight 700, uppercase

**No silent escalation:** UI must never display RLM badge when node `expertRuntime` is `single-pass`. Effective runtime always mirrors node field, not inferred behavior.

---

## Failure States Blocking Dependents (EXEC-01)

### Executor → UI contract

When ancestor node fails:

1. Failed node: `status = "failed"`; failure message available via session snapshot / node metadata / run trace (surface best available string in UI copy).
2. All dependent descendants not yet started: `status = "skipped"` with block reason set (use `approvalReason` or equivalent session field): `Blocked: upstream {ancestorLabel} failed — {message}`.
3. Executor does not run blocked nodes; UI must not show them as `failed` — only the root failure node gets `failed`.

### Visual distinction

| | Failed node | Blocked dependent |
|---|-------------|-------------------|
| Border | Solid red `#a53d3d` | Dashed gray `#8a8f8b` |
| Icon | `AlertTriangle` | `AlertTriangle` (muted `#69746d`) |
| Copy prefix | **Node failed:** | **Blocked:** |
| Header status | `failed` | `skipped` |

### Edge cases

- **Bind-time failure** (invalid `expertAgentId` before node runs): node transitions to `failed` with **Expert bind failed:** copy; dependents blocked with same ancestor reference.
- **Unsupported runtime:** node `failed` with **Runtime mode error:** copy; dependents blocked.
- **User stop:** cancelled semantics unchanged; blocked copy uses **Run was cancelled** when executor marks dependents skipped due to cancel.

---

## Inspector Execution Panel

When selected node has `status` in `running | completed | failed | skipped | cancelled` during or after a run:

| Row | Content |
|-----|---------|
| Status | Uppercase status label from `uiRunStatusLabels` |
| Expert | `{expertAgentId}` + assignment mode |
| Runtime | Single-pass or RLM |
| Effective model | `{effectiveModel}` or **pending** |
| Tools | Comma-separated allowlist or **agent default** |
| Failure / block | Warning row when `failed` or blocked `skipped` |

Expert override form fields (Phase 32) remain below execution panel but are **disabled** when:
- Selected node is not editable (`status` not in `planned | ready | awaiting_approval`), **or**
- Any node in graph has `status === "running"`.

---

## Accessibility

- Run progress subline: `aria-live="polite"` on `.run-status-block` during active run.
- Running node card: `aria-busy="true"` when `status === "running"`.
- Execution badges: `aria-label="Expert {id}, runtime {mode}"` on `.execution-badges` container.
- Failure and blocked rows: `role="alert"` on `.meta-row.warning` for `failed` and blocked `skipped`.
- Stop run: existing `aria-label="Stop run"`.
- Focus order during run: run header status → stop → canvas (nodes not focus-trapped) → inspector execution panel.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
