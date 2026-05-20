# Milestones

## v1.2 Answer Quality Loops (Shipped: 2026-05-20)

**Status:** completed (see `.planning/milestones/v1.2-MILESTONE-AUDIT.md`)  
**Completed:** 2026-05-20  
**Phases:** 12-17 (phase artifacts remain under `.planning/phases/` until cleanup; roadmap snapshot: `milestones/v1.2-ROADMAP.md`)

**Phases completed:** 6 phases, 9 plans

**Key accomplishments:**

- Added bounded answer-quality loops as collapsed top-level graph nodes with inspectable internal draft, critique, refine, gate, and best-of-progress history
- Added visible adaptive rubrics and structured evaluator parsing with explicit degraded or failed loop states
- Implemented refinement cycles and best-of-progress final selection instead of blindly returning the last iteration
- Added phase-specific model routing and overrides for draft, critique, refine, gate, and best-of-progress
- Exposed loop metadata and manual accept/stop controls across UI, API, CLI, JSON, trace, and run-state surfaces
- Hardened regression coverage for bounded execution, stale metadata invalidation, strict failures, and observability

---

## v1.1 Interop, chat-first, plugins, constrained tools (Shipped: 2026-05-13)

**Status:** completed (see `.planning/milestones/v1.1-MILESTONE-AUDIT.md`)
**Completed:** 2026-05-13
**Phases:** 6-11, including inserted Phase 8.5 (archived under `.planning/milestones/v1.1-phases/`; roadmap snapshot: `milestones/v1.1-ROADMAP.md`)

**Phases completed:** 7 phases, 13 plans, 12 tasks

**Key accomplishments:**

- Typed extension contracts, trust-gated extension loading, and backward-compatible YAML config parsing for plugins
- Built-in tools now load through extension shims, and third-party tool registration is covered by integration tests
- Added MCP + skill interoperability policy configuration and runtime orchestration while keeping non-MCP defaults behavior-compatible
- Implemented shared MCP+skill lifecycle events with deterministic identity/ordering and validated outage escalation/recovery semantics

---

## v1.0 — MVP

- **Status:** completed (see `.planning/STATE.md`, `.planning/v1.0-MILESTONE-AUDIT.md`)
- **Completed:** 2026-05-08
- **Phases:** 1–5 (archived under `.planning/milestones/v1.0-phases/`; roadmap snapshot: `milestones/v1.0-ROADMAP.md`)
