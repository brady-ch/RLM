---
phase: 35-integration-hardening
plan: 01
subsystem: integration
tags: [cli, session-memory, graph-workflow, ui]

requires:
  - phase: 34-graph-workflow-export-import
    provides: graph sidecar export/import and frozen run path
  - phase: 32-expert-team-binding
    provides: expert fields on graph nodes
provides:
  - CLI workflow-export/workflow-import subcommands
  - Disk-resolved graph workflows for --workflow without YAML registration
  - v1.5 graphWorkflowMetadata in saved sessions
  - Graph-primary UI with collapsed secondary chat panel
  - integration-v15.test.ts coverage
affects: [release-hardening, ci-smoke]

tech-stack:
  added: []
  patterns:
    - "Disk fallback for graph workflows via resolveDiskGraphWorkflowConfig"
    - "SavedGraphWorkflowMetadataSection version 1 in session payload"

key-files:
  created:
    - tests/integration-v15.test.ts
  modified:
    - src/cli/args.ts
    - src/index.ts
    - src/application/workflow-runner.ts
    - src/application/graph-workflow-store.ts
    - src/application/session-memory-bridge.ts
    - src/application/execution-controller.ts
    - src/application/control-server.ts
    - src/adapters/file-session-store.ts
    - src/ports/session-store-port.ts
    - ui/src/main.tsx
    - ui/src/styles.css

key-decisions:
  - "CLI uses workflow-export and workflow-import subcommands with --export-session and --workflow flags"
  - "graphWorkflowMetadata stored as dedicated session section with degraded restore for pre-v1.5 saves"
  - "Chat refine panel collapses by default when graph has 2+ nodes"

requirements-completed: [SURF-01, SURF-02, SURF-03]

duration: 25min
completed: 2026-05-22
---

# Phase 35: Integration Hardening Summary

**CLI parity, session v1.5 metadata, and graph-primary UX hardening across UI, CLI, and saved sessions.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 4 implementation areas + integration tests
- **Files modified:** 12
- **Tests:** 205 passing (3 new in integration-v15.test.ts)

## Accomplishments

- Added `workflow-export` / `workflow-import` CLI subcommands; `--workflow` auto-resolves `.rlm/workflows/<id>.yaml` when absent from config.
- Extended session save payload with `graphWorkflowMetadata` (linked workflow, variant, export timestamp); legacy sessions restore with explicit degraded note.
- Demoted global chat to collapsible secondary panel below graph workflows when 2+ nodes exist; root-composer empty state emphasizes Plan children CTA.
- Added `tests/integration-v15.test.ts` for replan error vocabulary, disk workflow resolve, and session expert/metadata round-trip.

## Deviations from Plan

None — implemented per 35-CONTEXT.md and user specification.

## Known Stubs

None blocking phase goals.

## Task Commits

1. **Integration hardening implementation** — `312b733` (feat)

## Self-Check: PASSED

- tests/integration-v15.test.ts: FOUND
- npm test: 205/205 pass
- npm run build: pass
