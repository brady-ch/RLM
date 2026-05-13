# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.1 — Interop, chat-first, plugins, constrained tools

**Shipped:** 2026-05-13  
**Phases:** 7 | **Plans:** 13 | **Sessions:** multiple GSD phase sessions

### What Was Built

- Extension contracts and first-party extension shims for built-in tools.
- MCP and skill runtime paths with executable skill and MCP tool exposure.
- Configurable local/remote host routing and constrained tool-calling adapter signals.
- Typed artifact contracts, file-backed run-state persistence, and mutation audit events.
- Chat-first graph authoring, hard clarification stops, and typed node-composer UI.
- Cross-platform packaging/startup path and project-local first-run config seeding.

### What Worked

- Keeping ports and adapters explicit let new capabilities land without collapsing the existing CLI/domain boundaries.
- Regression tests were effective at catching integration regressions after review fixes.
- The milestone audit exposed real cross-phase wiring gaps before archival.

### What Was Inefficient

- Audit frontmatter drifted from the later closure note, blocking milestone completion until reconciled.
- Some phase-level validation artifacts were uneven, making the milestone audit rely on test evidence and summaries.
- Signing/reproducibility expectations for packaging were broader than the shipped MVP path.

### Patterns Established

- Built-in behavior can be migrated behind the same extension host used for third-party registration.
- Runtime human-input needs should become explicit checkpoint objects, not implicit prompt retries.
- Large workflow state should pass refs/metadata through graph state and keep payloads external.

### Key Lessons

1. Keep audit status machine-readable and update it immediately when closure work lands.
2. Cross-phase wiring should get dedicated integration tests before a milestone is considered closed.
3. UI-rich phases need both code review and visual review artifacts to avoid late ambiguity.

### Cost Observations

- Model mix: inherited session defaults.
- Sessions: multiple phase execution, review, and audit sessions.
- Notable: the final audit reconciliation was fast because the closure code already had targeted regression coverage.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | multiple | 5 | Established approval/checkpoint/control graph foundation |
| v1.1 | multiple | 7 | Added interop, typed runtime state, chat-first UX, packaging, and milestone audit reconciliation |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | baseline suite | approval and graph-control paths | n/a |
| v1.1 | 98 passing | interop, run-state, clarification, typed composer, packaging/config scopes | Extension shims and runtime ports stayed in TypeScript/Node stack |

### Top Lessons (Verified Across Milestones)

1. Explicit checkpoints and structured runtime events keep recursive behavior debuggable.
2. Planning artifacts need machine-readable status fields kept in sync with narrative closure notes.
