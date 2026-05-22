---
phase: 68-application-layer-handler-split
plan: 02
subsystem: api
tags: [rust, axum, control-server, handlers]

requires:
  - phase: 68-01
    provides: application layer imports for handler modules
provides:
  - control_server/handlers/* concern modules
  - transport-only routes.rs (~93 lines)
affects:
  - 69-large-file-decomposition
  - UI control-server consumers

tech-stack:
  added: []
  patterns:
    - "Handler modules pub(crate) with routes.rs wiring-only"
    - "Shared helpers in handlers/common.rs (ApiError, snapshot_with_extra, spawn_graph_execution)"

key-files:
  created:
    - crates/rlm-core/src/control_server/handlers/mod.rs
    - crates/rlm-core/src/control_server/handlers/common.rs
    - crates/rlm-core/src/control_server/handlers/graph.rs
    - crates/rlm-core/src/control_server/handlers/nodes.rs
    - crates/rlm-core/src/control_server/handlers/workflows.rs
    - crates/rlm-core/src/control_server/handlers/session.rs
    - crates/rlm-core/src/control_server/handlers/memory.rs
    - crates/rlm-core/src/control_server/handlers/chat.rs
    - crates/rlm-core/src/control_server/handlers/model_library.rs
    - crates/rlm-core/src/control_server/handlers/plugins.rs
    - crates/rlm-core/src/control_server/handlers/events.rs
    - crates/rlm-core/src/control_server/handlers/static_ui.rs
  modified:
    - crates/rlm-core/src/control_server/routes.rs
    - crates/rlm-core/src/control_server/mod.rs

key-decisions:
  - "ApiError and body structs pub(crate) for axum handler type visibility"
  - "Automated line-range extraction from monolithic routes.rs preserving handler logic verbatim"

patterns-established:
  - "Handler layout mirrors TS src/application/control-server/handlers/"

requirements-completed: [ARCH-03, REG-02]

duration: 20min
completed: 2026-05-22
---

# Phase 68 Plan 02: Control Server Handler Split Summary

**Monolithic routes.rs split into 11 concern handler modules; router file is wiring-only at 93 lines**

## Performance

- **Duration:** 20 min
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Extracted graph, nodes, workflows, session, memory, chat, model-library, plugins, events, and UI handlers
- routes.rs contains only `build_router` and `.route(...)` registrations (0 handler bodies)
- All handler files ≤257 lines (nodes.rs largest); route integration tests pass

## Task Commits

1. **Task 1: Extract graph, nodes, workflows, and common handlers** - `2871616` (feat)
2. **Task 2: Extract remaining handlers and slim routes.rs** - `c163b24` (feat)

## Verification

```
wc -l routes.rs → 93
grep '^async fn' routes.rs → 0
cargo test -p rlm-core --test chat_routes --test plugin_routes \
  --test model_library_routes --test graph_executor_routes \
  --test persistence_control_server → all passed
```

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: crates/rlm-core/src/control_server/handlers/mod.rs
- FOUND: crates/rlm-core/src/control_server/routes.rs
- FOUND: 2871616
- FOUND: c163b24

---
*Phase: 68-application-layer-handler-split*
*Completed: 2026-05-22*
