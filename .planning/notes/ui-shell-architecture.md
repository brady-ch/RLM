# UI Shell Architecture

**Date:** 2026-05-22  
**Updated:** 2026-05-22 — Sketch 002 Variant **B** selected  
**Context:** `/gsd-explore` + Superpowers brainstorming — replace monolithic scrollable sidebar with node-centric minimal workflow and full-screen Advanced hub.

## Problem

| Issue | Detail |
|-------|--------|
| Structure | Entire UI in `ui/src/main.tsx` (~3,000 lines) + `styles.css` |
| Layout | 380px right rail stacks run controls, workflows, chat, sessions, memory, models, plugins, node inspector, clarification |
| UX | Scrollable junk drawer; global panels compete with graph authoring |
| Reliability | User-reported: sidebar controls broken on Rust-served UI |
| Spec drift | Phase 11/30 contracts describe node-centric composer; implementation never split components |

v1.8 explicitly deferred React UI rewrite while migrating runtime to Rust. Backend HTTP/SSE contract is stable; frontend restructure can proceed without backend changes.

## Decision summary (locked)

| Area | Direction |
|------|-----------|
| **Default view** | Full canvas + thin top bar (status, run/stop, Advanced entry) |
| **Node cards** | Inline prompt editing, status, ports, budget strip; primary authoring surface |
| **Context menu** | Right-click node → Plan, Run, Graph, and Advanced-link actions |
| **Run panel** | Slim right panel opens **on node select only** — Approve, Skip, clarification; **no edit fields** |
| **Advanced hub** | Full-screen takeover: Models · Plugins · Sessions · Memory · Settings |
| **Navigation** | Back to workflow restores graph; no persistent app-level tabs on workflow view |
| **Visual system** | Phase 11/30 tokens (light composer shell) |
| **Backend** | Same `/api/*` + SSE contract |

**Sketch winners:** [001-A workflow shell](.planning/sketches/001-workflow-advanced-shell/) + [002-B interaction model](.planning/sketches/002-context-menu-node-editing/)

## Shell model

```text
Workflow view (default)
┌──────────────────────────────────────────────┐
│ ● Ready          [Run] [Stop]    [Advanced]  │
├──────────────────────────────┬───────────────┤
│  [node cards]                │ Run panel     │
│  · prompt edit on card       │ (on select)   │
│  · right-click → ctx menu    │ Approve       │
│                              │ Clarification │
└──────────────────────────────┴───────────────┘
  (panel hidden when no selection)

Advanced view (full-screen takeover)
┌──────────────────────────────────────────────┐
│ ← Back to workflow                           │
│ Models · Plugins · Sessions · Memory · Settings
└──────────────────────────────────────────────┘
```

## Interaction model (Variant B)

### Node card (always on canvas)

- Inline prompt `textarea` when node is editable (`planned` | `ready` | `awaiting_approval`)
- Status chip, expert/runtime meta, ports, budget strip, quality-loop summary
- Protected replan gate (Replace / Merge / Cancel) on card when API requires choice
- **No action button row** on card — actions via context menu

### Context menu (right-click node)

| Section | Actions |
|---------|---------|
| Plan | Plan children, Break down, Extend budget |
| Run | Approve, Skip |
| Graph | Add child, Connect parent…, Delete subtree |
| Advanced | Expert overrides… (navigates to Advanced → Settings) |

Keyboard/accessibility: context menu also reachable via ⋮ button or `Shift+F10` / menu key on focused node.

### Run panel (on select, ~360px)

| Content | Notes |
|---------|-------|
| Node title + id + status | Header only |
| Approve / Skip | When `awaiting_approval` |
| Clarification form | When `pendingClarification`; Submit answer / Abort run |
| Readiness hint | When run disabled globally |

**Not in Run panel:** prompt edit, plan buttons, model library, plugins, sessions, memory, expert/sampling forms.

### Advanced hub (unchanged)

| Sub-tab | Contents |
|---------|----------|
| Models | Library, HF search, install, tier assignment |
| Plugins | Install, enable/disable, doctor |
| Sessions | Save, list, inspect, reopen |
| Memory | Scopes, preferences, episodic, retrieval debug |
| Settings | Expert/sampling overrides, workflows, chat refine, quality-loop drill-down |

## Component architecture target

```text
ui/src/
  app/           AppShell, TopBar, workflow | advanced routing
  canvas/        GraphCanvas, layout/viewport sync
  nodes/         ExecutionNodeCard, NodeContextMenu, QualityLoopSummary
  run-panel/     RunPanel (approve, clarify — mount on select only)
  advanced/      AdvancedHub + domain views
  shared/        api.ts, types.ts, tokens.css
```

**Boundary rules**

1. `run-panel/` must not import from `advanced/`
2. Global domain fetches mount only in Advanced views
3. Context menu dispatches existing `/api/nodes/*` mutations
4. `main.tsx` thin entry → `<AppShell />`

## Build order

1. Extract `shared/types.ts` + `shared/api.ts`
2. `AppShell` routing (workflow vs advanced)
3. `GraphCanvas` + `ExecutionNodeCard` with inline prompt edit
4. `NodeContextMenu` wired to existing API actions
5. `RunPanel` on select (approve, clarification)
6. Advanced sub-views (Models → Plugins → Sessions → Memory → Settings)
7. Remove legacy monolith sidebar
8. REG-01 regression on Rust runtime

## Related artifacts

- UI-SPEC: `.planning/phases/61-ui-shell-rewrite/61-UI-SPEC.md`
- Seed: `.planning/seeds/ui-component-extraction.md`
- Sketches: `001-workflow-advanced-shell`, `002-context-menu-node-editing` (winner B)

## Deferred

- Command palette (`⌘K`) — post–Phase 61 if needed
- Settings sub-tab split — evaluate during plan-phase
