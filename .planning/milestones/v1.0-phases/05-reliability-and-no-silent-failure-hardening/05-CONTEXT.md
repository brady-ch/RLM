# Phase 5: Reliability and No-Silent-Failure Hardening — Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Close remaining gaps where model, tool, or workflow failures can be dropped, masked, or inconsistently represented. The product already requires structured explicit failure for mutations (ERRO-02) and strict model selection visibility (Phase 3); Phase 5 completes **ERRO-01** and **ERRO-03** by making **all** runtime failure paths observable in **both** UI node status and CLI output, with **aligned** semantics between per-node and run-level views—without introducing silent auto-fallback (explicitly out of scope per REQUIREMENTS).

</domain>

<decisions>
## Implementation Decisions

### Obligation to Surface (ERRO-01, ERRO-03)
- **D-01:** Any model, tool, or workflow failure that affects execution outcome must update **authoritative backend state** (node/run) and be **observable** on CLI and in the UI—no “success” or neutral terminal state when work actually failed.
- **D-02:** “Silent” includes: swallowed exceptions, ignored error returns, success codes with partial/failed work, and user-visible states that imply completion when the node or run failed.
- **D-03:** Scope is **runtime** execution failures, not re-implementing ERRO-02 (mutation validation); Phase 5 may **reuse** the same structured-error posture where APIs already return codes/messages.

### Surfaces and Transport
- **D-04:** CLI must surface failures via existing user-facing channels (`render`, stderr logging, `--json-stream` / event stream where used)—planners choose exact messages but must not leave a failure-only-in-logs path for normal interactive use.
- **D-05:** UI must reflect failures on **node cards** and any **run-level** summary/header the product already exposes; new UI chrome is allowed only if required to meet consistency (D-08), not for unrelated polish.

### Consistency (Roadmap success criterion 3)
- **D-06:** Define a small **failure vocabulary** shared by domain types, controller snapshots, API payloads, and CLI labels (e.g. failed vs cancelled vs blocked)—planners document the mapping table in plan artifacts.
- **D-07:** **Human-readable messages** should be consistent between node-level and run-level views for the same underlying failure (same root `code`/category; wording may shorten in summaries).

### Workflow and Recursive Paths
- **D-08:** **Workflow-runner** and multi-step orchestration paths receive the same “no silent failure” bar as single-agent / recursive-domain execution—no weaker reporting for “secondary” agents or spawned nodes.
- **D-09:** Recursive/spawned execution from Phase 4 must **inherit** explicit failure propagation: a child failure must not be hidden behind a parent “completed” unless semantics explicitly define partial success (if partial success exists, it must still be visibly distinct from full success).

### Testing (Roadmap success criterion 4)
- **D-10:** Add **regression tests** for critical surfacing flows: at minimum model failure, tool failure, and workflow failure paths, plus one path through **approval/edit/run** interaction where failures were historically easy to miss (planner names the files/scenarios).
- **D-11:** Prefer **deterministic** assertions on structured outcomes (status fields, exit codes, event payloads) over flaky timing.

### Planner Discretion
- **D-12:** Exact internal error codes, HTTP status mapping, and copy edits are left to the planner as long as D-01–D-11 hold.
- **D-13:** No new “retry silently with another model” or similar auto-fallback; conflicts with REQUIREMENTS out-of-scope table.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and Phase Scope
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, `ERRO-01` / `ERRO-03`.
- `.planning/REQUIREMENTS.md` — `ERRO-01`, `ERRO-03`; out-of-scope: silent auto-fallback.
- `.planning/PROJECT.md` — core value, observability / no silent failures.

### Prior Phase Posture (do not weaken)
- `.planning/phases/01-planned-graph-and-approval-foundation/01-CONTEXT.md` — structured tool/model error returns; stale action rejection.
- `.planning/phases/02-interactive-graph-mutation-at-checkpoints/02-CONTEXT.md` — `ERRO-02` structured mutation error contract.
- `.planning/phases/03-model-aware-node-planning-and-overrides/03-CONTEXT.md` — strict explicit model failure visibility.
- `.planning/phases/04-recursive-spawning-with-run-mode-controls/04-CONTEXT.md` — hard risks must not be converted to silent auto-approval; observability during auto-run.

### Implementation Surfaces
- `src/domain/types.ts` — node/run status and result shapes.
- `src/domain/recursive-language-model.ts` — recursion, tools, model calls, budget/stop handling.
- `src/application/execution-controller.ts` — session authority, graph snapshots, approval/stop.
- `src/application/control-server.ts` — HTTP/API projection of controller state and errors.
- `src/application/agent-runner.ts` — single-agent run and `runRecursivePrompt`.
- `src/application/workflow-runner.ts` — multi-agent and workflow failures.
- `src/application/model-provider.ts` — purpose routing; failure propagation from models.
- `src/adapters/` — Ollama and tool adapters (failure translation).
- `src/cli/render.ts`, `src/cli/runtime-logger.ts` — CLI user-visible failure output.
- `src/index.ts` — composition and exit paths.
- `tests/` — integration-style regression targets.
- `ui/src/main.tsx` — node cards, run-level UI, inspector (if present in tree).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Controller-authoritative graph and approval state suitable for stamping **failed** (or equivalent) on affected nodes.
- Existing CLI rendering and streaming hooks for long runs.
- Phase 2 structured error pattern for mutations—reuse style for new API surfaces if needed.
- Phase 3/4 work on model visibility and run modes—failure states should compose without special cases that hide errors.

### Established Patterns
- Backend is authoritative; UI renders confirmed state.
- Explicit failure preferred over implicit recovery; no silent fallback per project constraints.
- Integration tests already exercise CLI and engine—extend for failure branches.

### Integration Points
- Audit **catch** paths and **result** aggregation in `agent-runner`, `workflow-runner`, and `recursive-language-model` for swallowed errors.
- Ensure control-server and CLI paths serialize the same failure facts the UI needs.
- Align `render`/summary output with node status vocabulary for the same run.

</code_context>

<specifics>
## Specific Ideas

- Roadmap explicitly calls out **model / tool / workflow** failures and **approval / edit / run loops**—treat these as explicit audit dimensions when inventorying code paths.
- Success criterion 3 requires **consistency**—plan a single source of truth for status + message projection, then bind UI and CLI to it.

</specifics>

<deferred>
## Deferred Ideas

- Broader reliability work unrelated to **surfacing** (performance, retries with user consent, persistence)—not Phase 5 unless tied to ERRO-01/ERRO-03.
- v2 persistence/resume error stories—out of scope unless they block meeting v1 error visibility.

</deferred>

---

*Phase: 5-Reliability and No-Silent-Failure Hardening*
*Context gathered: 2026-05-08*
