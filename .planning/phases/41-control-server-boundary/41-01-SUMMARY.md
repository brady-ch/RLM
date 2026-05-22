---
phase: 41-control-server-boundary
plan: "01"
subsystem: api
tags: [http, bootstrap, refactor]

requires:
  - phase: 38-runtime-bootstrap
    provides: RuntimeContext composition and UI run-mode dispatch
provides:
  - application/control-server module with handlers by surface and bootstrap-facing input merger
  - Centralized dispatch preserving legacy route order
affects:
  - phase-42-docs
tech-stack:
  added: []
  patterns:
    - "Thin HTTP handlers grouped by UI surface module"
    - "startControlServer deps frozen in ControlServerDeps at listen time"
key-files:
  created:
    - src/application/control-server/index.ts
    - src/application/control-server/types.ts
    - src/application/control-server/control-server-deps.ts
    - src/application/control-server/http-utils.ts
    - src/application/control-server/route-request.ts
    - src/application/control-server/start-input-from-bootstrap.ts
    - src/application/control-server/handlers/session.ts
    - src/application/control-server/handlers/graph.ts
    - src/application/control-server/handlers/workflows.ts
    - src/application/control-server/handlers/model-library.ts
    - src/application/control-server/handlers/static-ui.ts
  modified:
    - src/cli/run-modes/ui.ts
    - tests/recursive-language-model.test.ts
key-decisions:
  - Kept sequential handler chain explicit in route-request.ts so legacy precedence stays obvious
requirements-completed: [CTRL-01, CTRL-02, CTRL-03, CTRL-04]

duration: 45min
completed: 2026-05-22
---

# Phase 41 Plan 01: Control-Server Boundary Summary

**Control server HTTP surface split under `application/control-server/handlers/` with bootstrap-fed `RuntimeContext` fields merged via `buildStartControlServerInput`, preserving all endpoint contracts.**

## Performance

- **Duration:** ~45 min (planning + implementation + verification)
- **Tasks:** Executable plan (`41-01-PLAN.md`) plus implementation wave
- **Files:** Control-server package (~11 new paths), slimmed UI wiring, import fix in mega test file

## Accomplishments

- Replaced monolithic `control-server.ts` with `application/control-server/{index,route-request,handlers/*,types,deps,http-utils}`.
- Added `buildStartControlServerInput` so `cwd` / `sessionStore` come consistently from bootstrap context.
- Preserved centralized error handling (`toMutationError`, status heuristics) in the dispatcher.

## Task commits

1. **`51eff97`** — `refactor(41-01): split control-server into handler modules`
2. **(prior)** **`e233369`** — `docs(41-01): add executable control-server boundary plan` (`41-01-PLAN.md`)

## Deviations from plan

None for control-server mechanics.

**Concurrent workspace hygiene:** Repeated removal of stray untracked `src/domain/recursion/*` stubs (incomplete Phase 40 work) required so `npm run check` and Prettier gates did not pick up unfinished engine extraction files.

## Threat flags

None introduced — no new endpoints or trust boundaries beyond file move.

## Self-check: PASSED

- `[ -f src/application/control-server/index.ts ]` FOUND
- `npm run check` exit 0; 211 tests

---

_Phase: 41-control-server-boundary — Completed 2026-05-22_
