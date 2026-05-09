# Phase 5: Reliability and No-Silent-Failure Hardening — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `05-CONTEXT.md` — this log preserves alternatives considered.

**Date:** 2026-05-08
**Phase:** 5-Reliability and No-Silent-Failure Hardening
**Areas discussed:** Obligation to surface, CLI and UI parity, Workflow and multi-agent parity, Loop coverage (approval/edit/run), Status and message consistency, Testing strategy, Exclusions

**Note:** Positions below are aligned to `.planning/ROADMAP.md` Phase 5 success criteria, `.planning/REQUIREMENTS.md` **ERRO-01** / **ERRO-03**, and existing architecture in `AGENTS.md`. Where tradeoffs appeared, the stricter interpretation (“always visible,” “no silent paths”) was selected.

---

## Obligation to Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Authoritative backend failure state + mirrored CLI/UI | Single truth in controller/domain; all surfaces read the same facts. | ✓ |
| CLI-only for scripting; UI best-effort | Conflicts with ERRO-01 (UI + CLI). | |
| Log-only diagnostics for some failures | Conflicts with explicit surfacing and normal interactive use. | |
| Planner decides per subsystem | Rejected as default—would invite inconsistent bars. | |

**Discussion outcome:** Failures must drive visible node/run state and user-facing CLI output; logs supplement but do not replace.

---

## CLI and UI Parity

| Option | Description | Selected |
|--------|-------------|----------|
| Same failure facts in structured events + human summaries | Matches roadmap “UI and CLI” and consistency criterion. | ✓ |
| Rich UI, minimal CLI | Fails ERRO-01 parity. | |
| Rich CLI, minimal UI | Fails ERRO-01 parity. | |

**Discussion outcome:** Both surfaces must reflect the same underlying failure; presentation may differ (card vs line-oriented) but not contradict.

---

## Workflow and Multi-Agent Parity

| Option | Description | Selected |
|--------|-------------|----------|
| Workflow-runner failures same visibility bar as agent-runner / domain | Meets ERRO-03 “workflow errors” and roadmap tool/model/workflow list. | ✓ |
| Workflow errors summary-only at end | Risk of hiding which node/agent failed—acceptable only if node-level status still updated. | |
| Degrade to stderr text without structured status | Weakens testability and UI binding. | |

**Discussion outcome:** Workflow path is in scope for hardening; no second-class reporting.

---

## Loop Coverage (Approval / Edit / Run)

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit audit of approval, checkpoint resume, mutation, and execution paths | Matches roadmap success criterion 2. | ✓ |
| Execution path only | Leaves “silent in loops” unaddressed. | |

**Discussion outcome:** Inventory failures that occur *while paused*, *during resume*, or *during spawned/recursive steps*—not only steady-state execution.

---

## Status and Message Consistency

| Option | Description | Selected |
|--------|-------------|----------|
| Shared vocabulary + documented mapping to UI labels and CLI strings | Meets roadmap criterion 3. | ✓ |
| Per-surface ad hoc strings | Invites mismatch between node and run views. | |
| Technical IDs only in UI | Fails “actionable” expectation from core value. | |

**Discussion outcome:** One internal model (codes/categories); stable user-facing copy derived from it.

---

## Testing Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Regression tests on model, tool, workflow failure surfacing + one loop-heavy scenario | Matches roadmap criterion 4 and PHASE scope. | ✓ |
| E2E-only | Slower, flakier; complement with focused tests. | |
| Unit-only | May miss cross-surface wiring. | |

**Discussion outcome:** Prefer assertions on observable outcomes (status, events, exit behavior) tied to ERRO-01/ERRO-03.

---

## Exclusions (Phase 5 Scope Guard)

| Topic | Rationale |
|-------|-----------|
| ERRO-02 / mutation validation | Completed in Phase 2—reuse patterns only. |
| Silent auto-fallback / alternate model without user intent | Explicitly out of scope per REQUIREMENTS. |
| New persistence or collaboration features | v2; not required for surfacing hardening. | |

**Discussion outcome:** Phase 5 remains a **hardening** pass for visibility and consistency, not a feature expansion.

---

## Planner Discretion

Delegated: exact error code taxonomy, HTTP/status mapping, string tables, and file-level refactors—constrained by decisions in `05-CONTEXT.md`.

## Deferred Ideas

None within phase scope; broader reliability work is listed under **Deferred** in `05-CONTEXT.md`.
