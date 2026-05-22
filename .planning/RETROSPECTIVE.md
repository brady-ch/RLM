# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.8 — Rust Runtime Migration

**Shipped:** 2026-05-22  
**Phases:** 11 | **Plans:** 18 | **Audit:** tech_debt (22/28 requirements; 6 partial deferrals)

### What Was Built

- Cargo workspace (`rlm-core`, `rlm-cli`) with Axum control server, golden HTTP/SSE fixtures, and static UI serving.
- Rust file stores and YAML config loader with lossless Node-written `.rlm/` dual-read.
- RecursiveLanguageModel, InteractiveExecutionSession, GraphExecutor, and full node/graph API routes in Rust.
- usearch ANN vector index with Ollama embeddings replacing JSON linear scan.
- Ollama adapter, model library routes, Rust plugin system with builtins and registry service.
- Rust `rlm` binary with `RLM_RUNTIME` strangler switch and dual-runtime parity CI gate.
- Tauri in-process Rust control server; release bundle without bundled Node.
- Phase 60.1 gap closure: session save/reopen, memory preferences, chat refine, clarification abort.
- Phase 61 canvas-first UI shell: AppShell, GraphCanvas, slim Run panel, Advanced hub.

### What Worked

- Strangler fig over frozen HTTP/SSE contract let UI stay TypeScript/React while orchestration moved to Rust incrementally.
- Golden fixture gates (`tests/fixtures/control-server/`) caught route parity regressions early.
- Inserted Phase 60.1 efficiently closed audit gaps without reopening completed phases.
- Phase 61 frontend restructure preserved backend contract — build/lint gates passed without Rust changes.

### What Was Inefficient

- Nyquist validation artifacts missing for phases 52–61 (only 60.1 compliant) — documentation debt carried to close.
- REQUIREMENTS checkboxes marked complete while audit scored partial on CLI-01, PLUG-03, PERS-03 — traceability lag.
- Phase 61 shipped two UI wiring regressions (pause-auto-approvals, HF download) discovered only at milestone audit.
- REG-01 human UAT deferred to checklist documentation rather than operator sign-off at close.

### Patterns Established

- Rust crate layout mirrors v1.7 concern map (`ports` traits → domain → adapters → application → control-server).
- `RLM_RUNTIME=node|rust` enables side-by-side parity comparison until Node paths are removed.
- UI shell extraction: shared types/API helpers in `ui/src/shared/`, domain views lazy-loaded in Advanced hub.

### Key Lessons

1. Milestone audit with `tech_debt` status is a valid close when deferrals are enumerated — do not conflate checkbox completion with audit partial scores.
2. UI shell rewrites need regression wiring checklist against monolith feature inventory before phase close.
3. Insert decimal phases (60.1) for gap closure rather than reopening shipped phases.

### Cost Observations

- Model mix: inherited session defaults.
- Sessions: concentrated same-day execution across 11 phases with parallel Rust porting waves.
- Notable: strangler approach avoided flag-day rewrite; ~15k LOC Rust added alongside preserved TS UI.

---

## Milestone: v1.6 — Architecture Cleanup

**Shipped:** 2026-05-22  
**Phases:** 7 | **Plans:** 15 | **Tests:** 359 passing (per milestone audit / `npm run check`)

### What Was Built

- Automated lint, format, and dependency-cruise guardrails with an aggregated `npm run check` gate.
- Config split into `application/config/` with preserved public façade and resolver/starter unit tests.
- Centralized runtime composition (`buildRuntimeContext`, `RuntimeContext`) and CLI run-mode dispatch receiving a built context.
- Adapter taxonomy (tools, persistence, models) and aligned extension registration shims.
- Recursive engine concern modules under `domain/recursion/` including tool-round and stitched quality-loop integration.
- Control-server HTTP handlers grouped by surface with bootstrap-injected dependencies and unchanged API shapes.
- Subsystem-aligned test layout with shared helpers and refreshed `AGENTS.md` onboarding map.

### What Worked

- Strangler extractions behind stable façades kept CLI/UI/session/graph behavior unchanged while shrinking hotspots.
- Per-slice verification via `npm run check` gave a single CI-shaped signal after each phase.
- Archiving roadmap + requirements per milestone keeps the live `.planning/` footprint bounded.

### What Was Inefficient

- `summary-extract` pulled placeholder “One-liner” rows for some phases — milestone accomplishments needed manual curation from SUMMARY bodies.
- Some phase VERIFICATION docs emphasize narrative gates over per-REQ-ID tables (noted as optional hygiene in milestone audit).

### Patterns Established

- Layer-boundary linting starts as WARN + baseline ratchet rather than blocking the refactor train.
- Bootstrap remains the sole composition choke point; handlers stay transport-only.

### Key Lessons

1. Keep SUMMARY frontmatter one-liners populated at phase close so milestone automation stays accurate.
2. When Nyquist validation is enabled but artifacts are absent, record the gap explicitly — it is documentation debt, not a ship blocker, if audits and gates agree.

### Cost Observations

- Model mix: inherited session defaults.
- Sessions: concentrated phase-close and audit cadence across seven phases same day per plan.
- Notable: single `npm run check` umbrella reduced divergence between local and CI semantics.

---

## Milestone: v1.5 — Dynamic Graph Authoring

**Shipped:** 2026-05-22  
**Phases:** 6 | **Plans:** 18 | **Tests:** 205 passing

### What Was Built

- Model-driven plan-from-node with root-composer default, async planner contract, and explicit failure states (no heuristic fallback).
- Protected replan UX with Replace/Merge/Cancel gate when manual edits, pins, overrides, or expert customizations exist.
- Planner-assigned expert presets per node with inspector overrides, execution-time allowlist enforcement, and purpose-to-tier routing.
- Shared GraphExecutor with topological walk, bind-time expert resolution, single-pass/RLM runtime modes, and per-node execution progress UI.
- Lossless `kind: graph` workflow sidecars with playbook/pipeline variants, import/export API, and frozen replay path.
- Integration hardening: CLI workflow-export/import, disk-resolved graph workflows, session v1.5 metadata, and graph-primary UX with demoted chat panel.

### What Worked

- Vertical phase slicing (plan → protect → experts → execute → export → integrate) kept dependencies clear and testable.
- Reusing existing ports/adapters for planner, session, and workflow layers avoided a rewrite while shifting the product surface.
- Milestone audit with 28/28 requirements and 205/205 tests gave confidence to close despite doc checkbox drift.

### What Was Inefficient

- SUMMARY frontmatter one-liner fields were missing on early phases, forcing accomplishment extraction from narrative summaries.
- REQUIREMENTS.md traceability Status column lagged behind phase verification (Pending vs Complete mismatch).
- Phase 33 human visual verification deferred — live execution progress styling not fully UAT'd in browser.

### Patterns Established

- Graph-primary authoring: node submit and Plan children CTA replace chat-first pre-run flow.
- Expert binding at plan time with execution-time allowlist filtering on shared tool implementations.
- Graph workflow sidecars as replayable artifacts separate from legacy agent-list workflows.
- Disk fallback for graph workflows when absent from YAML config registration.

### Key Lessons

1. Keep REQUIREMENTS.md traceability in sync with phase verification as phases close, not at milestone audit.
2. SUMMARY frontmatter (one_liner, requirements-completed) should be populated at plan close for reliable milestone extraction.
3. UI-rich execution phases need scheduled human verification before close, or explicit deferral in STATE.md.

### Cost Observations

- Model mix: inherited session defaults (yolo mode).
- Sessions: 6 phase execution waves over 2 days.
- Notable: integration-v15.test.ts consolidated cross-surface parity checks efficiently in one phase.

---

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
| v1.5 | 2 days | 6 | Graph-primary authoring, expert teams, GraphExecutor, workflow sidecars, UI/CLI parity |
| v1.6 | same-day closeout | 7 | Behavior-preserving architecture cleanup: config/bootstrap split, adapter taxonomy, RLM decomposition, control-server handlers, test restructure |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | baseline suite | approval and graph-control paths | n/a |
| v1.1 | 98 passing | interop, run-state, clarification, typed composer, packaging/config scopes | Extension shims and runtime ports stayed in TypeScript/Node stack |
| v1.5 | 205 passing | plan-from-node, protected replan, expert binding, GraphExecutor, graph workflow export/import, integration-v15 | Graph workflow sidecars and disk-resolved workflow path |
| v1.6 | 359 passing | lint/format/depcruise gate, config/bootstrap facades, domain/recursion modules, handler split, nested test discovery | WARN-severity dependency-cruiser baseline; deferred `ARCH-01` / full error ratchet |

### Top Lessons (Verified Across Milestones)

1. Explicit checkpoints and structured runtime events keep recursive behavior debuggable.
2. Planning artifacts need machine-readable status fields kept in sync with narrative closure notes.
