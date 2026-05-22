---
status: human_needed
phase: 61-ui-shell-rewrite
plan: 06
automated: passed
updated: "2026-05-22T00:00:00Z"
---

# Phase 61 Plan 06 — REG-01 Verification

## Automated checks (executor)

| Check | Result |
|-------|--------|
| `npm run build:ui` | PASS |
| `npm run lint -- ui/src` | PASS |
| `ui/src/main.tsx` line count (≤50) | PASS (5 lines) |
| No `function App(` in main.tsx | PASS |
| No `aside.inspector` in main.tsx | PASS |
| Workflow mount: no `refreshModelLibrary` in AppShell useEffect | PASS (deferred to Advanced tabs) |

## REG-01 human UAT (pending operator)

Per plan checkpoint — verify on Rust-served UI when control server is available:

1. Start Rust control server + built UI static assets
2. Workflow view: top bar + canvas only (no sidebar models/plugins/sessions/memory)
3. Inline prompt edit on card; right-click → Plan children
4. Select node → Run panel (~360px); canvas click → panel hidden
5. Advanced → each tab loads; **← Back to workflow** preserves graph
6. Sessions tab: save and reopen session
7. Run workflow / Stop respond without console errors

**Resume signal:** Type `approved` after manual UAT, or file issues for gap closure.
