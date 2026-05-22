---
phase: 44-runtime-interop-split
plan: 01
subsystem: infra
tags: [runtime, composition, interop, strangler, bootstrap]

requires:
  - phase: 43-boundary-fixes
    provides: ExtensionHostPort in ports, empty depcruise baseline
provides:
  - src/runtime/composition/ with buildRuntimeContext, ExtensionHost, tool/model factories
  - src/runtime/interop/ with MCP/skill runtime and tool wiring
  - Composition init-order test and COMPOSITION_INIT_ORDER constant
affects: [45-application-concern-grouping, 46-plugin-taxonomy]

tech-stack:
  added: []
  patterns:
    - "Strangler extraction: runtime modules first, bootstrap re-export facade"
    - "Init-stage recorder hook for composition order verification"

key-files:
  created:
    - src/runtime/composition/build-runtime-context.ts
    - src/runtime/composition/extension-host.ts
    - src/runtime/composition/runtime-composition.ts
    - src/runtime/composition/init-order.ts
    - src/runtime/composition/index.ts
    - src/runtime/interop/mcp-skill-runtime.ts
    - src/runtime/interop/interop-runtime.ts
    - src/runtime/interop/index.ts
    - tests/runtime-composition-init-order.test.ts
  modified:
    - src/application/bootstrap/build-runtime-context.ts
    - src/application/bootstrap/types.ts
    - src/index.ts
    - tests/extension-host.test.ts
    - tests/mcp-skill-interoperability.test.ts

key-decisions:
  - "Optional onInitStage recorder on buildRuntimeContext for init-order testing without CLI spawn"
  - "Delete application copies of moved modules rather than keeping duplicate re-export files"

patterns-established:
  - "Runtime composition lives under src/runtime/composition/"
  - "MCP/skill interop lives under src/runtime/interop/"

requirements-completed: [RUNT-03, RUNT-04, RUNT-05, TAXN-03]

duration: 25min
completed: 2026-05-22
---

# Phase 44: Runtime & Interop Split Summary

**Composition and MCP/skill interop wiring extracted to `src/runtime/` with bootstrap thin facade and init-order unit test**

## Performance

- **Duration:** ~25 min
- **Tasks:** 5/5
- **Files modified:** 14
- **Tests:** 360 passing

## Accomplishments

- `buildRuntimeContext`, `ExtensionHost`, `createToolsResolver`, and `createModelFactory` live under `src/runtime/composition/`
- MCP/skill runtime and tool wiring live under `src/runtime/interop/`
- `application/bootstrap/` is a thin re-export facade; four former application modules removed
- Init order preserved and verified via `COMPOSITION_INIT_ORDER` and dedicated unit test

## Task Commits

1. **Runtime & interop extraction** - `3f5765f` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- All runtime files exist under `src/runtime/composition/` and `src/runtime/interop/`
- Commit `3f5765f` found in git log
- 360/360 tests pass via `npm run check`

---
*Phase: 44-runtime-interop-split*
*Completed: 2026-05-22*
