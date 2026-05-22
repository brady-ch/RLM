---
phase: 61
slug: ui-shell-rewrite
status: approved
shadcn_initialized: false
preset: none
created: "2026-05-22"
sketch_winner: "002-B"
---

# Phase 61 — UI Design Contract

> Shell rewrite: node-centric workflow with context menus, inline card editing, slim Run panel on select, and full-screen Advanced hub. Replaces monolithic scrollable sidebar. Frontend only — frozen HTTP/SSE contract.

**Reference:** `.planning/notes/ui-shell-architecture.md`, sketch `002-context-menu-node-editing` Variant B.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled CSS; extract tokens to `ui/src/shared/tokens.css`) |
| Component library | React 19 + `@xyflow/react` + plain CSS |
| Icon library | `lucide-react` |
| Font | `"Aptos", "Segoe UI", sans-serif` |

Inherit spacing, typography, and color from Phase 11/30 contracts — no new palette.

---

## Layout & Regions

| Region | Behavior |
|--------|----------|
| **Top bar** | Run status, active node hint, Run workflow, Stop, Advanced entry. Always visible on workflow view. |
| **Graph canvas** | Primary surface. React Flow + Background, Controls, MiniMap. Full width when no node selected. |
| **Node card** | Inline prompt edit, status, ports, budget, quality-loop summary. No stacked action buttons — use context menu. |
| **Run panel** | ~360px right rail; **visible only when a node is selected**. Run/clarification only — not an edit inspector. |
| **Advanced hub** | Full-screen takeover; internal sub-tabs; Back to workflow. |

```text
No selection:     [ top bar |──────── canvas ──────── ]
With selection:   [ top bar |── canvas ──| run panel ]
Advanced:         [ ← Back | sub-tabs | full domain view ]
```

**Responsive:** `@media (max-width: 800px)` — Run panel becomes bottom sheet overlay; context menu remains primary action surface.

---

## Node Card Anatomy

1. **Header:** type, title, status chip, expert/runtime meta
2. **Body:** prompt textarea (editable states only)
3. **Chrome:** ports, budget strip, pending plan banner, replan gate, quality-loop summary
4. **Actions:** none as persistent buttons — **context menu** (+ optional ⋮ affordance for a11y)

Card width ~300–360px. Selected state: accent outline (`#2d6cdf`, 2px offset).

---

## Context Menu Contract

Triggered by: right-click, ⋮ on card, keyboard menu key on focused node.

| Section | Items | API mapping (existing) |
|---------|-------|------------------------|
| Plan | Plan children | `POST /api/nodes/:id/plan` |
| Plan | Break down | `POST /api/nodes/:id/breakdown` |
| Plan | Extend budget | `POST /api/nodes/:id/extend-budget` |
| Run | Approve | `POST /api/nodes/:id/approve` |
| Run | Skip | `POST /api/nodes/:id/skip` |
| Graph | Add child… | modal → `POST /api/nodes/add` |
| Graph | Connect parent… | modal → `POST /api/nodes/:id/connect` |
| Graph | Delete subtree | confirm → `POST /api/nodes/:id/delete` |
| Advanced | Expert overrides… | navigate to Advanced → Settings |

Disabled items reflect node status (e.g. Approve only when `awaiting_approval`).

Protected replan (Replace / Merge / Cancel) stays **on card** as inline gate — not context menu.

---

## Run Panel Contract

Opens when user selects a node; closes when selection cleared or user clicks canvas background.

| Block | Content |
|-------|---------|
| Header | `{label}` · `{id}` · status |
| Approval | Approve / Skip when `awaiting_approval` |
| Clarification | Pending question, answer textarea, Submit / Abort |
| Readiness | Global run-disabled reason when applicable |

**Explicitly excluded:** prompt textarea, Plan/Save, model trail, expert/sampling editors, memory, plugins, sessions.

---

## Advanced Hub Contract

Full-screen; sub-tabs: **Models · Plugins · Sessions · Memory · Settings**.

Relocate all content currently in the monolith sidebar except run/clarification flows. Domain fetches on sub-tab mount only.

Settings includes: expert overrides, sampling, graph workflows, chat refine, quality-loop inspector, connect-by-ID repair tools.

---

## Copywriting (delta from Phase 30)

| Element | Copy |
|---------|------|
| Context menu hint on card | **Right-click for actions** (or **⋮ Actions**) |
| Run panel empty | Hidden — no placeholder rail |
| Advanced entry | **Advanced** |
| Back from Advanced | **← Back to workflow** |

Planning/error copy unchanged from Phase 30 UI-SPEC.

---

## Component Map

```text
ui/src/
  app/AppShell.tsx, TopBar.tsx
  canvas/GraphCanvas.tsx
  nodes/ExecutionNodeCard.tsx, NodeContextMenu.tsx
  run-panel/RunPanel.tsx
  advanced/AdvancedHub.tsx, *View.tsx
  shared/api.ts, types.ts, tokens.css
```

---

## Success Criteria (for verification)

1. Workflow view shows no models/plugins/sessions/memory panels
2. Prompt editable on node card; Plan via context menu succeeds
3. Run panel shows approve/clarify for selected node only
4. Advanced hub reachable and returns to same graph state
5. REG-01 workflows pass on Rust-served UI

---

## Checker Sign-Off

- [ ] Pending `/gsd-ui-phase` or plan-phase review
