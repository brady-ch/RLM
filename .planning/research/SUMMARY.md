# Project Research Summary — v1.12 UI Canvas Visual Polish

**Project:** Recursive Language Model CLI  
**Domain:** Rust-served React/Vite workflow UI — visual polish, theming, graph edge contrast  
**Researched:** 2026-05-23  
**Confidence:** HIGH for CSS token/theming approach and React Flow edge styling; MEDIUM for Radix dark-mode portal styling

## Executive Summary

v1.12 upgrades the workflow canvas from prototype aesthetic to Figma/Miro-style polish **without API or shell layout changes**. User-reported pain: **graph edges are nearly invisible** today (animated default strokes on light blue-tint background). Scope adds **dark and light mode** (system default + persisted manual override).

Recommended approach: **CSS custom properties only** — extend `tokens.css` with `[data-theme="light"]` / `[data-theme="dark"]` (or `:root` + `[data-theme="dark"]`) rather than adopting shadcn or a full design system. Theme state lives in a small `ThemeProvider` or hook in `ui/src/shared/`, applied to `document.documentElement` before first paint (inline script in `index.html` optional to prevent FOUC). Toggle in **TopBar** with optional duplicate in Advanced → Settings.

React Flow edges need **explicit `style.stroke` and `style.strokeWidth`** in `graphToFlowEdges()` — CSS alone cannot reliably theme SVG paths. Use semantic tokens: `--edge-default`, `--edge-active`, `--edge-completed`, `--edge-failed` with ≥4.5:1 contrast against canvas in each theme.

Radix context menu: add `@radix-ui/react-context-menu` only; theme via CSS variables on `[data-theme]` targeting Radix content class.

## Key Findings

### Stack additions

| Addition | Purpose |
|----------|---------|
| `@radix-ui/react-context-menu` | Accessible context menu (79-UI-SPEC) |
| CSS `[data-theme]` tokens | Light/dark without new UI framework |
| `localStorage` key `rlm-ui-theme` | Persist manual override (`light` \| `dark` \| `system`) |

**Do NOT add:** shadcn, Tailwind, styled-components, MUI.

### Feature table stakes

- System `prefers-color-scheme` respected when preference is `system`
- Manual light/dark toggle with persistence
- High-contrast edges in both themes (user blocker)
- 79-UI-SPEC canvas dot grid + light node cards + status chips
- Radix menu preserving all existing actions

### Architecture

1. **Phase 1 — Theme foundation:** tokens, `ThemeProvider`, TopBar toggle, edge stroke tokens wired in `graph-utils.ts`
2. **Phase 2 — Canvas/cards:** dot grid, card chrome, status chips (use tokens throughout)
3. **Phase 3 — Radix menu:** swap `NodeContextMenu` presentation layer

### Watch out for

- FOUC: apply theme class before React mount
- Hardcoded hex in `ExecutionNodeCard`, `GraphCanvas` Background prop — audit and replace with tokens
- React Flow default edge color `#b1b1b7` invisible on similar backgrounds
- Radix portal renders outside React tree — theme vars must be on `:root` / `html[data-theme]`

---
*Research completed: 2026-05-23 — ready for REQUIREMENTS.md and ROADMAP phases 82+*
