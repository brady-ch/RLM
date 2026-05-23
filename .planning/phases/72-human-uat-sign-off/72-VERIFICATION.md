---
status: human_needed
phase: 72-human-uat-sign-off
plan: 01
automated: passed
updated: "2026-05-23T00:00:00Z"
---

# Phase 72 — Automated Preflight Verification

Targeted preflight per D-06 (full `npm run check` deferred). Static contract checks confirm Phase 62 route/UI wiring before operator UAT.

## Automated preflight

| Command | Result | Notes |
|---------|--------|-------|
| `npm run build:ui` | PASS | Vite production bundle built (Node 20.18.2; Vite warns 20.19+ preferred) |
| `npm run lint -- ui/src` | PASS | ESLint clean |
| `cargo check -p rlm-cli -p rlm-core` | PASS | Rust control server compiles |
| `npm run build && node --test --test-name-pattern="approval mode contract" dist/tests/domain/recursion/recursive-language-model.test.js` | PASS | Plan D-06 cites `.ts` path; requires `tsc` build first — 1 test pass, 128 skipped by pattern |

## Static contract checks

| Check | Result | Evidence |
|-------|--------|----------|
| `routes.rs` registers `/api/pause-future-auto-approvals` | PASS | `crates/rlm-core/src/control_server/routes.rs:120` |
| `routes.rs` registers `/api/model-library/download` | PASS | `crates/rlm-core/src/control_server/routes.rs:59` |
| `TopBar.tsx` posts to `/api/pause-future-auto-approvals` | PASS | `ui/src/app/TopBar.tsx:60` |
| `panels.tsx` posts to `/api/model-library/download` (HF) | PASS | `ui/src/legacy/panels.tsx:737` |

## Human verification

**Status:** Pending operator UAT using [72-UAT.md](./72-UAT.md).

**Resume signal:** Operator types `approved` after completing checklist items 1–10 with PASS or documented SKIP (Ollama-dependent items per D-04).

**Operator start command:**

```bash
npm run build:ui
RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --port 0
```

Open the URL printed to stderr (`RLM UI listening at http://127.0.0.1:{port}`).
