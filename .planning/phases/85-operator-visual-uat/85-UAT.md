---
status: pending_operator
phase: 85-operator-visual-uat
supersedes: null
sources:
  - .planning/milestones/v1.11-phases/81-operator-uat-sign-off/81-UAT.md
  - .planning/phases/82-theme-system-edge-contrast/82-VERIFICATION.md
  - .planning/phases/83-canvas-node-card-polish/83-VERIFICATION.md
  - .planning/phases/84-radix-context-menu/84-VERIFICATION.md
updated: "2026-05-23T16:00:00Z"
operator_signed: null
---

# Phase 85 — REG-02 Operator Visual UAT Checklist (v1.12)

Browser checklist for milestone v1.12 UI Canvas Visual Polish. Operator records evidence per row before sign-off.

## Operator Runbook

### Prerequisites

- Node.js and Rust toolchain
- `npm install` (includes `@radix-ui/react-context-menu`)
- Ollama optional (only needed if exercising Plan children with live model)

### Build and serve

```bash
npm run build:ui
RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --port 0
```

Open the URL from stderr: `RLM UI listening at http://127.0.0.1:{port}`

### Automated preflight

```bash
npm run test:uat:preflight
```

## Checklist

| # | Item | Steps | Result | Notes | Evidence |
|---|------|-------|--------|-------|----------|
| 1 | Theme default | Fresh browser (or clear `rlm-ui-theme` in localStorage): UI matches OS light/dark | PENDING | | |
| 2 | Theme toggle | TopBar theme button cycles system → light → dark → system | PENDING | | |
| 3 | Theme persistence | Set dark (or light); refresh page — choice retained | PENDING | | |
| 4 | Edge visibility (light) | In light theme, plan child nodes — connection lines clearly visible | PENDING | | |
| 5 | Edge visibility (dark) | Switch to dark — edges remain clearly visible against canvas | PENDING | | |
| 6 | Edge states | If nodes reach running/completed/failed, edge color reflects state | PENDING | SKIP if no live run | |
| 7 | Dot-grid canvas | Canvas shows neutral dot grid (not green tint) in both themes | PENDING | | |
| 8 | Node card chrome | Cards have light header + status chip (no dark header bar) | PENDING | | |
| 9 | Context menu | Right-click, ⋮, or Shift+F10 opens menu with Plan/Run/Graph/Advanced | PENDING | | |
| 10 | Menu theme | Context menu readable in both light and dark | PENDING | | |
| 11 | MiniMap / controls | MiniMap and React Flow controls usable in both themes | PENDING | | |
| 12 | v1.11 regression | Workflow shell, Run panel, Advanced hub still functional | PENDING | | |

## Sign-off

Operator completes all applicable rows (PASS or documented SKIP). No FAIL rows at sign-off unless explicitly accepted.

**Approved:** _pending_

**Operator:** _pending_
