---
phase: 79
slug: shell-boundaries-context-menu
plan: 79-02
status: approved
type: visual-polish
supplements: 61-UI-SPEC
shadcn_initialized: false
radix_context_menu: true
created: "2026-05-23"
sketch_winner: ui-polish-preview
visual_reference: figma-miro
---

# Phase 79-02 — Canvas Visual Polish (UI Design Contract)

> Visual upgrade for canvas + node cards (CSS/tokens) and context menu (Radix). Supplements Phase 61 shell layout — **no layout, API, or shell boundary changes**.

**Reference:** `.planning/notes/ui-canvas-visual-polish-decision.md`, sketch `.planning/sketches/ui-polish-preview/`

---

## Design System

| Property | Value |
|----------|-------|
| Canvas styling | Hand-rolled CSS + `ui/src/shared/tokens.css` (Option A) |
| Context menu | `@radix-ui/react-context-menu` |
| Component library | React 19 + `@xyflow/react` + plain CSS (unchanged) |
| Icon library | `lucide-react` (menu items + existing card icons) |
| Font | `"Aptos", "Segoe UI", sans-serif` (unchanged) |
| shadcn | **Not adopted** — Radix primitive only for context menu |

Phase 61 layout regions, Run panel contract, and Advanced hub contract are **unchanged**.

---

## Canvas Surface

| Property | Value |
|----------|-------|
| Background color | `#f5f5f5` (`--color-bg`) |
| Grid | Dot grid: `radial-gradient(circle, #d0d0d0 1px, transparent 1px)`, `background-size: 20px 20px` |
| React Flow Background | Align with dot grid or hide duplicate if redundant |
| MiniMap | Subdued — lower opacity, neutral fill |
| Edges | `#cbd5e1` default; status-colored when running/completed/failed (existing logic, updated stroke) |

**Out of scope:** Top bar visual refresh, Advanced hub restyle, run panel restyle (follow-on if needed).

---

## Node Card Visual Contract

Card width remains ~300–360px. Functional anatomy unchanged from Phase 61; **visual treatment** updates:

### Header (light, not dark bar)

| Element | Spec |
|---------|------|
| Background | `#ffffff` — same as card body; separated by 1px `--color-border` |
| Title | `--font-body` weight 600–700, `#1e1e1e` |
| Status | **Chip** — pill, 10px uppercase label, section-colored background |
| Expert/runtime meta | Muted `#6b6b6b`, 11px |

### Status chips

| Status | Chip background | Chip text |
|--------|-----------------|-----------|
| `planned` | `#f4f4f5` | `#71717a` |
| `ready` | `#eef2ff` | `#4262ff` |
| `running` | `#eef2ff` | `#4262ff` |
| `awaiting_approval` | `#fff7ed` | `#c2410c` |
| `completed` | `#ecfdf5` | `#059669` |
| `failed` / `cancelled` | `#fef2f2` | `#dc2626` |

### Card chrome

| Property | Value |
|----------|-------|
| Background | `#ffffff` |
| Border | `1px solid rgba(0,0,0,.08)` |
| Radius | `12px` (`--radius-lg` — add token) |
| Shadow (default) | `0 2px 8px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)` |
| Shadow (hover) | `0 4px 16px rgba(0,0,0,.12)` + `translateY(-1px)` |
| Shadow (selected) | `0 0 0 2px var(--color-accent)` + `0 4px 20px rgba(66,98,255,.18)` |
| Running accent | `border-left: 3px solid var(--color-accent)` (replaces full border color) |
| Failed accent | Left border or chip only — **remove** heavy 2px red border on full card |

### Prompt textarea

| Property | Value |
|----------|-------|
| Background | `#fafafa` |
| Border | `1px solid rgba(0,0,0,.08)` |
| Radius | `8px` |
| Focus | `border-color: var(--color-accent)`; `box-shadow: 0 0 0 3px rgba(66,98,255,.15)` |

### Motion

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Hover lift | 180ms | `ease` |
| Select ring | 150ms | `ease` |
| Context menu open | 150ms | `ease` (Radix + CSS) |

**Remove:** `#1f2937` dark node header bar. **Keep:** replan gate, quality-loop summary, ports — restyle to match light card.

---

## Context Menu (Radix)

Replace hand-rolled fixed-position `div.node-context-menu` with `@radix-ui/react-context-menu`.

### Trigger

Unchanged from Phase 61 / 79-01:

- Right-click on node card
- ⋮ button on card
- `ContextMenu` key / Shift+F10 on focused node

Radix: wrap `ExecutionNodeCard` (or card root) in `ContextMenu.Root` + `ContextMenu.Trigger` with `asChild`.

### Structure

| Section | Items | Disabled when |
|---------|-------|---------------|
| **Plan** | Plan children, Break down, Extend budget | Per existing rules |
| **Run** | Approve, Skip | Not `awaiting_approval` |
| **Graph** | Add child…, Connect parent…, Delete subtree | Not editable |
| **Advanced** | Expert overrides… | Never |

### Menu item spec

| Property | Value |
|----------|-------|
| Container | White bg, `border-radius: 8px`, shadow `0 10px 38px rgba(0,0,0,.15)` |
| Item height | ~36px; padding `8px 10px` |
| Icon | lucide, 14px, `#71717a`, left of label |
| Separator | `1px rgba(0,0,0,.06)` between sections |
| Hover/focus | `#f4f4f5` background |
| Disabled | `opacity: 0.42` (match button disabled) |
| Destructive (Delete subtree) | Text `#dc2626`; icon matches |

### Keyboard / a11y

- Arrow keys navigate items (Radix default)
- `Escape` closes menu
- `Enter` / `Space` activates item
- Focus returns to trigger on close
- `role="menu"` / `menuitem` via Radix primitives

### Unchanged

- `GraphActionModal` stays hand-rolled for Add child / Connect / Delete confirm
- All `/api/nodes/*` mappings identical to Phase 61 table
- Protected replan gate stays **on card**, not in menu

---

## Token Updates (`tokens.css`)

Add or update:

```css
--radius-lg: 12px;
--color-bg: #f5f5f5;
--color-surface: #ffffff;
--color-card: #ffffff;
--color-accent: #4262ff;   /* or retain #2d6cdf — implementer picks one, document in PR */
--color-border: rgba(0, 0, 0, 0.08);
--color-text: #1e1e1e;
--color-muted: #6b6b6b;
--shadow-card: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-card-hover: 0 4px 16px rgba(0, 0, 0, 0.12);
--shadow-menu: 0 10px 38px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08);
--transition-fast: 150ms ease;
--transition-normal: 180ms ease;
```

Deprecate green composer tints for canvas scope. Advanced hub may retain prior surface colors until a follow-on pass.

---

## Component Map (delta)

```text
ui/src/
  shared/tokens.css          ← token shifts
  styles.css                 ← canvas grid, node-card, context menu CSS cleanup
  canvas/GraphCanvas.tsx     ← background alignment
  nodes/ExecutionNodeCard.tsx ← light header, chips, Radix trigger wrap
  nodes/NodeContextMenu.tsx  ← rewrite with @radix-ui/react-context-menu
package.json                 ← add @radix-ui/react-context-menu
```

---

## Verification

1. Visual: canvas matches sketch `ui-polish-preview` Miro panel (subjective; operator sign-off in 79-02)
2. `npm run build:ui` passes
3. `tests/ui/shell-boundaries.test.ts` passes (menu sections + API paths preserved)
4. Context menu: all items dispatch same endpoints as 79-01; disabled states correct
5. Keyboard: Tab to node → ContextMenu key opens menu → arrow + Enter works
6. No imports added from `run-panel/` to `advanced/`

---

## Checker Sign-Off

- [x] Approved via `/gsd-explore` 2026-05-23
- [ ] Pending `/gsd-ui-phase` checker (optional retro)
- [ ] Pending 79-02 execution + verification
