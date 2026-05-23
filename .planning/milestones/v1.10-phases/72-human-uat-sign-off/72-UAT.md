---
status: pending
phase: 72-human-uat-sign-off
superseded_by: .planning/phases/81-operator-uat-sign-off/81-UAT.md
sources:
  - .planning/milestones/v1.8-phases/61-ui-shell-rewrite/61-06-VERIFICATION.md
  - .planning/milestones/v1.9-phases/62-ui-regression-fixes/62-VERIFICATION.md
updated: "2026-05-23T00:10:00Z"
automated_attempt: "2026-05-23T00:10:00Z"
---

# Phase 72 — REG-01 Human UAT Checklist

Merged checklist from Phase 61 (61-06) and Phase 62 human verification items. Operator records evidence per row before sign-off.

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

**Model tiers:** Before Plan/Run, open **Advanced → Models** and assign tiers to installed Ollama models (e.g. medium → `granite4.1:8b`).

1. Run `npm run build:ui` from the repository root.
2. Start the Rust control server with static UI assets (command above).
3. Read the listen URL from stderr: `RLM UI listening at http://127.0.0.1:{port}`.
4. Open that URL in a browser.
5. Execute checklist items 1–10 below; fill Result, Notes, and Evidence for each row.

### Evidence attachments (optional)

Screenshots or logs may be saved under `.planning/phases/72-human-uat-sign-off/evidence/` and referenced in the Evidence column (e.g. `evidence/item-4-run-panel.png`).

## Checklist

| # | Item | Steps | Result | Notes | Evidence |
|---|------|-------|--------|-------|----------|
| 1 | Rust server + UI | Run `npm run build:ui`, then `RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --port 0`; open URL from stderr | PASS | Executor automated: server started, HTTP 200 on `/` | `curl http://127.0.0.1:35679/` → 200, title "RLM Flow" |
| 2 | Workflow shell layout | On workflow view, confirm top bar + canvas only — no sidebar for models, plugins, sessions, or memory | PENDING | Requires browser visual verification | Automated preflight only; no browser MCP in executor env |
| 3 | Prompt edit + Plan children | Edit prompt inline on a card; right-click a node → **Plan children** | PENDING | Requires browser interaction | — |
| 4 | Run panel toggle | Select a node → Run panel appears (~360px); click canvas background → panel hidden | PENDING | Requires browser interaction | — |
| 5 | Advanced tabs + Back | Open **Advanced**; verify each tab loads; click **← Back to workflow** — graph state preserved | PENDING | Requires browser interaction | — |
| 6 | Session save/reopen | In Sessions tab, save current session; reopen from list | PENDING | Requires browser interaction | API `/api/saved-sessions` reachable on server |
| 7 | Run / Stop | Run workflow and Stop; no console errors (requires Ollama/model host if live run) | PENDING | Ollama available (granite4.1:3b); browser run not attempted | `curl http://127.0.0.1:11434/api/tags` → models listed |
| 8 | Pause future auto-approvals | During recursive run (`initial-plan-recursive`), use TopBar control → POST `/api/pause-future-auto-approvals`; session reflects paused state | PENDING | API smoke: POST returns 200, `autoApprovalPaused:true` on draft session; full UX needs live recursive run | `curl -X POST .../api/pause-future-auto-approvals` → 200 |
| 9 | HF model install | Advanced → Models: search HF model, Install → POST `/api/model-library/download` (or SKIP if no network/Ollama) | PENDING | API smoke: download route responds (400 for test repo — endpoint wired) | POST `/api/model-library/download` → HTTP 400, error JSON |
| 10 | Canvas-first regression | Confirm canvas-first shell workflows unchanged vs Phase 61 baseline (no sidebar regression) | PENDING | Requires browser visual verification | Static wiring confirmed in 72-VERIFICATION preflight |

## Sign-off

Operator completes all applicable rows (PASS or documented SKIP per D-04). No FAIL rows at sign-off unless explicitly accepted.

**Approved:** _pending operator — type `approved` after completing PENDING rows in browser_

**Operator:** _pending_

### Operator instructions (remaining work)

1. Open `http://127.0.0.1:{port}` from the Rust serve command (or restart server if stopped).
2. Complete rows **2–10** in browser (row 1 already PASS via automated smoke).
3. For row **8** specifically: start a workflow with approval mode `initial-plan-recursive`, then use TopBar pause control during run (POST `/api/pause-future-auto-approvals`).
4. For row **7**, confirm Run/Stop with Ollama running (host verified available).
5. Fill Result/Notes/Evidence for each PENDING row; set frontmatter `status: operator_signed` and **Approved** timestamp.
6. Resume executor with signal `approved` to ratchet verification artifacts (Plan 72-02 Task 2).
