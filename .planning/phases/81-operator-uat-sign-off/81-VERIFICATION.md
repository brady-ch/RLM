---
status: human_needed
phase: 81-operator-uat-sign-off
plan: 01
automated: passed
updated: "2026-05-22T12:00:00Z"
---

# Phase 81 — Automated Preflight Verification

Targeted preflight per Phase 72 D-06 pattern (full `npm run check` deferred). Confirms v1.11 UI build, static route/UI wiring, and HTTP smoke before operator browser UAT.

## Automated preflight

| Command | Result | Notes |
|---------|--------|-------|
| `npm run build:ui` | PASS | Vite production bundle built (Node 20.18.2; Vite warns 20.19+ preferred) |
| `npm run lint -- ui/src` | PASS | ESLint clean after unused-import cleanup in advanced panels |
| `cargo check -p rlm-cli -p rlm-core` | PASS | Rust control server compiles |
| `cargo test -p rlm-core reg01_uat_smoke` | PASS | 2/2 — UI static serve + pause/download API smoke |
| `npm run build && node --test --test-name-pattern="reg01\|approval mode contract" dist/tests` | PASS | 5 tests (4 static wiring + 1 approval contract) |

**Single command:** `npm run test:uat:preflight`

## Static contract checks

| Check | Result | Evidence |
|-------|--------|----------|
| `routes.rs` registers `/api/pause-future-auto-approvals` | PASS | `crates/rlm-core/src/control_server/routes.rs` |
| `routes.rs` registers `/api/model-library/download` | PASS | `crates/rlm-core/src/control_server/routes.rs` |
| `TopBar.tsx` posts to `/api/pause-future-auto-approvals` | PASS | `ui/src/app/TopBar.tsx` |
| `ModelLibraryPanel.tsx` posts to `/api/model-library/download` | PASS | `ui/src/advanced/models/ModelLibraryPanel.tsx` |
| `FirstRunLauncher.tsx` wired to root-composer + saved-session APIs | PASS | `ui/src/app/FirstRunLauncher.tsx` |
| `FirstRunLauncher` does not import from `advanced/` | PASS | static wiring test |

## Automated UAT smoke (Plan 81-01)

| Check | Result | Notes |
|-------|--------|-------|
| GET `/` with `ui/dist` | PASS | HTTP 200, HTML contains "RLM Flow" |
| GET `/api/session` | PASS | JSON snapshot returned |
| POST `/api/pause-future-auto-approvals` | PASS | 200; `autoApprovalPaused:true` on draft session |
| POST `/api/model-library/download` (empty model) | PASS (wired) | Client/server error — endpoint reachable |
| GET `/api/saved-sessions` (unconfigured) | PASS | 404 with golden unconfigured body |
| Browser checklist items 2–13 | PENDING | Requires operator browser session |

## Human verification

**Status:** `human_needed` — operator must complete PENDING rows in [81-UAT.md](./81-UAT.md) via browser.

**Do not** ratchet this file or REG-01 to `passed` until operator signs the checklist.

**Resume signal:** Operator types `approved` after completing checklist items 1–13 with PASS or documented SKIP (Ollama-dependent items per D-04).

**Operator start command:**

```bash
npm run test:uat:preflight
npm run build:ui
RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --port 0
```

Open the URL printed to stderr (`RLM UI listening at http://127.0.0.1:{port}`).

**First-run launcher rows (11–13):** Use a fresh session or clear sessionStorage; verify pristine graph shows launcher, dismiss paths, and non-pristine skip behavior.
