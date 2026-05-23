---
status: pending
phase: 81-operator-uat-sign-off
supersedes: .planning/milestones/v1.10-phases/72-human-uat-sign-off/72-UAT.md
sources:
  - .planning/milestones/v1.10-phases/72-human-uat-sign-off/72-UAT.md
  - .planning/phases/80-first-run-launcher/80-VERIFICATION.md
  - .planning/phases/77-interaction-polish/77-CONTEXT.md
updated: "2026-05-22T12:00:00Z"
automated_attempt: "2026-05-22T12:00:00Z"
---

# Phase 81 — REG-01 Operator UAT Checklist (v1.11)

Consolidated checklist for milestone v1.11 UI Product Hardening. Covers Phase 61/62 shell items (via 72-UAT), Phase 77 runbook updates, and Phase 80 first-run launcher flows. Operator records evidence per row before sign-off.

## Operator Runbook

### Prerequisites

- Node.js and Rust toolchain installed
- UI dependencies: `npm install` (if not already done)
- **Ollama** running locally if testing items 7 and live-run portions of 8–10 (Run/Stop, recursive workflow, HF download with model host)
- Browser (Chrome/Firefox recommended)

### Build and serve

```bash
npm run build:ui
RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --port 0
```

**Stop a running UI server** (same project):

```bash
cargo run -p rlm-cli -- ui --stop
```

**Replace** if lock reports an existing instance:

```bash
RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --replace --port 0
```

**Model tiers:** Before Plan/Run, open **Advanced → Models** and assign tiers to installed Ollama models (e.g. medium → `granite4.1:8b`). Stale YAML tier names cause planning failures.

**First-run launcher:** On a pristine graph (single `root-composer`, no edges/children), the launcher overlay appears before the canvas is primary. Dismiss via **Continue to graph**, **Start fresh**, or **Open** on a saved session.

### Steps

1. Run `npm run build:ui` from the repository root.
2. Start the Rust control server with static UI assets (command above).
3. Read the listen URL from stderr: `RLM UI listening at http://127.0.0.1:{port}`.
4. Open that URL in a browser.
5. Execute checklist items 1–13 below; fill Result, Notes, and Evidence for each row.

### Automated preflight (executor)

Before browser work, run:

```bash
npm run test:uat:preflight
```

Or the individual gates documented in [81-VERIFICATION.md](./81-VERIFICATION.md).

### Evidence attachments (optional)

Screenshots or logs may be saved under `.planning/phases/81-operator-uat-sign-off/evidence/` and referenced in the Evidence column (e.g. `evidence/item-11-launcher.png`).

## Checklist

| # | Item | Steps | Result | Notes | Evidence |
|---|------|-------|--------|-------|----------|
| 1 | Rust server + UI | Run `npm run build:ui`, then `RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --port 0`; open URL from stderr | PASS | Executor automated: reg01_uat_smoke GET / 200, title "RLM Flow" | `cargo test reg01_uat_smoke_serves_ui_and_core_api_routes` |
| 2 | Workflow shell layout | On workflow view, confirm top bar + canvas only — no sidebar for models, plugins, sessions, or memory | PENDING | Requires browser visual verification | — |
| 3 | Prompt edit + Plan children | Edit prompt inline on a card; right-click a node → **Plan children** (context menu Variant B) | PENDING | Requires browser interaction | — |
| 4 | Run panel toggle | Select a node → Run panel appears (~360px); click canvas background → panel hidden; panel shows approve/clarify only — no edit fields | PENDING | Requires browser interaction | — |
| 5 | Advanced tabs + Back | Open **Advanced**; verify each tab loads; click **← Back to workflow** — graph state preserved | PENDING | Requires browser interaction | — |
| 6 | Session save/reopen | In Sessions tab, save current session; reopen from list | PENDING | Requires browser interaction | API smoke: `/api/saved-sessions` reachable when configured |
| 7 | Run / Stop | Run workflow and Stop; no console errors (requires Ollama/model host if live run) | PENDING | Ollama required for live run | — |
| 8 | Pause future auto-approvals | During recursive run (`initial-plan-recursive`), use TopBar control → POST `/api/pause-future-auto-approvals`; session reflects paused state | PENDING | API smoke in preflight; full UX needs live recursive run | — |
| 9 | HF model install | Advanced → Models: search HF model, Install → POST `/api/model-library/download` (or SKIP if no network/Ollama) | PENDING | API smoke: download route wired | — |
| 10 | Canvas-first regression | Confirm canvas-first shell workflows unchanged vs Phase 61 baseline (no sidebar regression) | PENDING | Requires browser visual verification | — |
| 11 | First-run launcher | Fresh/pristine session: launcher overlay with guided composer prompt and saved sessions list | PENDING | Requires browser; `data-testid="first-run-launcher"` | — |
| 12 | Launcher dismiss | **Continue to graph**, **Start fresh**, or **Open** saved session dismisses launcher; TopBar + canvas + RunPanel become primary | PENDING | Requires browser interaction | — |
| 13 | Launcher skip on progress | Add edge/child or refresh non-pristine graph — launcher does not reappear (sessionStorage dismissal persists within browser session) | PENDING | Requires browser interaction | — |

## Sign-off

Operator completes all applicable rows (PASS or documented SKIP per D-04). No FAIL rows at sign-off unless explicitly accepted.

**Approved:** _pending operator — type `approved` after completing PENDING rows in browser_

**Operator:** _pending_

### Operator instructions (remaining work)

1. Run preflight: `npm run test:uat:preflight` (or follow [81-VERIFICATION.md](./81-VERIFICATION.md)).
2. Start server: `npm run build:ui && RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --port 0`.
3. Open `http://127.0.0.1:{port}` from stderr.
4. Complete rows **1–13** in browser (row 1 may be pre-filled PASS from automated smoke).
5. For row **8**: start workflow with approval mode `initial-plan-recursive`, use TopBar pause during run.
6. For row **7**: confirm Run/Stop with Ollama running where applicable.
7. For rows **11–13**: exercise first-run launcher on pristine graph, dismiss paths, and non-pristine skip.
8. Fill Result/Notes/Evidence for each PENDING row; set frontmatter `status: operator_signed` and **Approved** timestamp.
9. Resume with signal `approved` to ratchet verification and REG-01 (Plan 81-02).
