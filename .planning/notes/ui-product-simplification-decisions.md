---
title: UI Product Simplification Decisions
date: 2026-05-24
context: /gsd-explore — prune UI to match product vision; simple, modern, light
---

## Decision summary

| Area | Direction |
|------|-----------|
| **Product identity** | Graph workflow is the product — not chat-first (`product-shell-entry-model.md`) |
| **Default view** | Canvas-first workflow: thin top bar, node cards, Run panel on select only (`ui-shell-architecture.md`) |
| **Power features** | Advanced hub full-screen takeover — Models · Plugins · Sessions · Memory · Settings |
| **Visual system** | Figma/Miro canvas polish — neutral dot grid, light cards, status chips (`ui-canvas-visual-polish-decision.md`) |
| **Complexity** | Hide runner/YAML/setup from default path (`desktop-product-vision.md`) |
| **"Light"** | All three: visual minimalism, feature pruning, code/bundle weight |
| **Cut line** | Audit-first — score each surface keep / demote / delete before executing removals |
| **Timing** | Milestone v1.19 after v1.18 Node Runtime Retirement (Phases 121–128) |

## Audit framework (Phase 121)

Score every UI surface against these questions:

1. **Graph-first?** Does it help the user inspect, edit, approve, or run a node graph?
2. **Default path?** Should a first-run user see this before their first successful run?
3. **Recoverable state?** If removed from default view, can the user still reach it via Advanced when needed?
4. **Vision match?** Does it match locked shell architecture (no global panels on workflow view)?
5. **Weight cost?** Lines of code, CSS, bundle KB, mount-time fetches?

Verdicts: **Keep** (workflow or essential Advanced) · **Demote** (Advanced only, collapsed default) · **Delete** (no product fit post-audit)

## Surfaces to audit

| Surface | Path | Initial hypothesis |
|---------|------|-------------------|
| Workflow canvas | `canvas/`, `nodes/` | Keep — core product |
| TopBar | `app/TopBar.tsx` | Trim — status + run/stop + Advanced only |
| Run panel | `run-panel/` | Keep slim — approve/clarify only |
| WorkflowOverview | `run-panel/WorkflowOverview.tsx` | Review — may overlap TopBar |
| First-run launcher | `app/FirstRunLauncher.tsx` | Keep — guided composer entry |
| Advanced hub tabs | `advanced/*` | Prune per audit |
| Chat refine | `advanced/settings/RefineGraphPanel.tsx` | Demote or delete — graph authoring is default |
| NodeInspector | `advanced/settings/NodeInspector.tsx` | Slim — inline card owns prompt edit |
| Quality loop inspector | `advanced/settings/QualityLoopInspector.tsx` | Demote or delete |
| Graph workflow panel | `advanced/settings/GraphWorkflowPanel.tsx` | Review |
| Memory panel | `advanced/memory/` | Keep in Advanced |
| Plugin panel | `advanced/plugins/` | Keep in Advanced |
| Model library | `advanced/models/` | Keep in Advanced |
| AppShell state | `app/AppShell.tsx` | Decompose — domain state out |
| styles.css | `ui/src/styles.css` | Split — ~1,800 lines monolith |

## Explicit non-goals (v1.19)

- Full shadcn / design-system adoption
- React UI rewrite to different framework
- New control-server endpoints
- Command palette (`⌘K`) — defer post-128 if needed

## Phase sequence (121–128)

1. **121** — Audit & cut list (blocks all execution phases) (cut list: `.planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md`)
2. **122** — Advanced hub pruning
3. **123** — Workflow view simplification
4. **124** — Styles & token consolidation
5. **125** — AppShell state decomposition
6. **126** — Node inspector & settings slim-down
7. **127** — Lazy routes & bundle lightening
8. **128** — UAT & sign-off

## Success criteria (milestone)

- Workflow view shows no domain panels (models/plugins/sessions/memory)
- AppShell under ~200 lines; domain fetches mount in Advanced views only
- `styles.css` split by concern; dead CSS removed
- Bundle size measured and reduced vs pre-milestone baseline
- First-run → graph → run path completable in under 5 minutes on Rust-only stack
- REG-style UAT checklist signed for simplified UI

## References

- `.planning/notes/ui-shell-architecture.md`
- `.planning/notes/product-shell-entry-model.md`
- `.planning/notes/ui-canvas-visual-polish-decision.md`
- `.planning/notes/desktop-product-vision.md`
- `.planning/seeds/ui-product-simplification.md`
