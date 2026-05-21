# Domain Pitfalls: v1.5 Dynamic Graph Authoring

**Domain:** Local-first recursive agent graph — plan-from-node, graph export/import, expert team  
**Milestone:** v1.5 Dynamic Graph Authoring  
**Researched:** 2026-05-21  
**Overall confidence:** HIGH for repo-specific pitfalls; MEDIUM for ecosystem patterns (verified against project notes, requirements, and prior milestone audits)

## Critical Pitfalls

Mistakes that cause rewrites, silent data loss, or broken replay.

### Pitfall 1: Silent Subtree Loss on Parent Replan

**What goes wrong:** User edits a child prompt, pins a node, or sets a model override, then resubmits the parent. The planner replaces the entire subtree without prompting, discarding protected work.

**Why it happens:** Protected-state detection is incomplete — e.g. only checking `originalPrompt !== prompt` but not user model overrides, manual `addNode`, pins, expert overrides, or layout-only edits mistaken for pristine. Alternatively, the UI/API skips the Replace / Merge / Cancel gate when descendants are still `status: "planned"`.

**Consequences:** User trust collapse; violates PLAN-05/06 and the core “no silent failures” constraint. Merge mode that drops pinned nodes is indistinguishable from a bug.

**Prevention:**
- Track `planGenerationId` / `plannedByParentAt` on auto-planned nodes.
- Treat as protected: `originalPrompt !== prompt`, `modelOverrideSource === "user"`, `assignmentMode === "custom"`, explicit pin, manual `addNode`, user sampling override.
- Pristine-only silent replan; always gate when any protected descendant exists.
- Merge passes pinned summaries into the planner and never deletes protected node ids.

**Detection (warning signs):**
- Parent replan returns 200 with no dialog when children have user overrides.
- Tests pass only on pristine trees; no fixture with mixed protected/unprotected siblings.
- Child count drops after merge without an audit event in trace/session log.

### Pitfall 2: Planner Output Without Schema Validation

**What goes wrong:** Model-driven planning emits malformed node specs (unknown composer types, cyclic parent refs, prompts exceeding budget, missing labels). The controller registers partial graphs or falls back to keyword heuristics silently.

**Why it happens:** Replacing `plannedChildrenFor` keyword heuristics with a raw LLM completion instead of structured output + zod/typed validation. Planner and runtime type enums drift (`ComposerNodeType`, expert ids, tier names).

**Consequences:** Graphs that fail mid-run, inconsistent UI/CLI behavior, or hidden fallback to old heuristics that users cannot see.

**Prevention:**
- Planner returns a typed plan envelope validated before any `registerNode`.
- Fail explicitly with PLAN-07 semantics: surface planner validation errors in UI/CLI; no heuristic fallback in v1.5.
- Contract tests: planner JSON → controller registration for every composer type and expert preset.

**Detection:**
- Planner errors logged but graph still gets children from a default template.
- `planNode` succeeds with empty `plannedNodeIds` and no user-visible error.
- Different child shapes from replan vs first plan for identical prompts (non-determinism without explicit “plan seed” metadata).

### Pitfall 3: Lossy Graph Export (Agent-List Conversion)

**What goes wrong:** “Save as workflow” collapses the graph into today’s `workflows.*` agent-array shape (`agents: [research, coding, …]` + single user prompt), losing per-node prompts, topology, expert assignments, and model overrides.

**Why it happens:** Reusing `runWorkflow` agent-dispatch path for export convenience instead of introducing `kind: graph` sidecars as specified in EXPORT-01.

**Consequences:** Export cannot round-trip; playbook/pipeline variants impossible; expert metadata (TEAM-08) lost. Users believe they saved a graph but get a different product on rerun.

**Prevention:**
- Serialize full execution graph snapshot: nodes, edges, prompts, composer metadata, expert fields, overrides, optional layout.
- Keep hand-written agent-list workflows separate; graph kind delegates to `runGraphWorkflow` (EXPORT-05).
- Import reloads into `InteractiveExecutionSession` for edit, not a lossy projection.

**Detection:**
- Saved YAML has no `kind: graph` or lacks per-node prompt fields.
- Import → export changes node count or edge topology.
- Playbook rerun substitutes `{{input}}` when it should not.

### Pitfall 4: Silent Playbook/Pipeline Variant Switch

**What goes wrong:** Run path picks pipeline vs playbook based on heuristics the user did not intend — e.g. empty string still triggers template substitution, or CLI omits variant display. Replay runs mutate prompts unexpectedly.

**Why it happens:** Smart-default logic (pipeline when input provided, playbook when not) implemented in only one surface (UI or CLI), or `--variant` override not threaded through control-server API.

**Consequences:** Same workflow id produces different behavior across runs without visibility; violates EXPORT-06 and “no silent failures.”

**Prevention:**
- Resolve variant once at run start; persist in run metadata and surface in CLI stdout + UI run banner.
- Explicit `--variant playbook|pipeline` override on both surfaces.
- Pipeline: validate `{{input}}` (and declared template vars) before execution starts (EXPORT-07).
- Playbook: reject non-empty task input with explicit message unless user confirms override.

**Detection:**
- Run metadata missing `variant` field.
- UI and CLI pick different variants for the same inputs in integration tests.
- Template substitution errors appear mid-node instead of at run start.

### Pitfall 5: Expert Allowlist Not Enforced at Execution

**What goes wrong:** Planner assigns expert presets and tool allowlists, but runtime executes with full global tool registry or `constrainedToolCalling: false`, so “Research expert without shell” can still invoke shell.

**Why it happens:** Expert binding applied only in plan metadata/UI labels; execution path still calls `runConfiguredAgent` with agent defaults. Extensions/MCP tools bypass allowlist checks.

**Consequences:** Security/policy violation; small-model experts get tool surfaces they cannot handle; trace lies about effective tools (TEAM-04, TEAM-07).

**Prevention:**
- Node execution builds a filtered `toolsByName` from expert allowlist snapshot at run bind time.
- Pass `constrainedToolCalling: true` when allowlist is strict; extension host respects same gate.
- Trace shows effective tools, expert id, `assignmentMode`, and runtime mode.

**Detection:**
- Integration test: node with shell disallowed still succeeds on `shell` tool call.
- Export/import changes tool allowlist without changing execution behavior.
- `assignmentMode: custom` lost after session save/reopen.

### Pitfall 6: Replan-on-Run for Frozen Graph Workflows

**What goes wrong:** Saved graph workflows invoke `planNode` or model-driven replan during execution, so replay is non-deterministic and playbook fidelity breaks.

**Why it happens:** `runGraphWorkflow` reuses interactive session paths that always call planner before execute; `pendingPlan` approval conflated with export snapshot state.

**Consequences:** EXPORT-05 violated; playbook reruns differ from approved graph; CI cannot rely on frozen workflows.

**Prevention:**
- Graph executor runs topological frozen graph only; replan behind explicit “edit plan” / re-import opt-in.
- Distinguish session authoring mode from workflow replay mode in runner entrypoints.
- Export from approved snapshot, not live draft with unapproved `pendingPlan`.

**Detection:**
- Model call with `purpose: plan` appears in trace during `--workflow` replay.
- Node ids or prompts change between playbook runs with no user edit.

---

## Moderate Pitfalls

### Pitfall 7: Shallow Merge of Nested Node Config

**What goes wrong:** Import, CLI overrides, or replan merge replace entire nested objects (`composer`, `planBudget`, expert tier maps, sampling overrides) instead of deep-merging, silently dropping fields.

**Why it happens:** Same class of bug as v1.2 MODL-05 (`qualityLoop` shallow merge in `resolveRuntimeConfig`). New node fields (`agentId`, `assignmentMode`, `runtime`, tool snapshot) copied with spread-at-top-level only.

**Prevention:** Deep-merge nested node config at import, override, and session restore boundaries; regression tests for partial overrides.

**Detection:** YAML expert `models.decompose` tier disappears after CLI flag or UI tweak to unrelated field.

### Pitfall 8: UI/CLI Planning Semantics Divergence

**What goes wrong:** Graph submit, replan gate, export dialog, and variant selection behave differently between control-server API and CLI flags — e.g. CLI lacks Merge/Cancel, or UI skips budget exhaustion states.

**Prevention:** Single application service for plan/replan/export/run; shared error vocabulary from v1.0 VERF work; parity tests across `tests/` and UI harness.

**Detection:** Requirement ids PLAN-07 / EXPORT-06 satisfied in one surface only.

### Pitfall 9: Plan Budget Shared Incorrectly Across Subtrees

**What goes wrong:** Child submit consumes parent budget incorrectly, or `findBudgetRoot` semantics break when users add manual siblings — planner stops early without exhausted flag, or allows unbounded depth.

**Prevention:** Reuse existing `planBudget` / `findBudgetRoot` invariants; increment `usedNodes` atomically; surface `exhausted: true` with explicit UX (PLAN-07).

**Detection:** `remainingNodes` negative or stale after manual add + replan; child plan succeeds when parent budget already exhausted.

### Pitfall 10: Expert Preset References Missing at Run Start

**What goes wrong:** Planner assigns `agentId: "security-review"` not present in merged config; failure happens mid-node or falls back to default agent silently.

**Prevention:** Validate all expert ids, tier names, and model refs at export save and at run start (EXPORT-07, TEAM-01). Fail fast with actionable message listing missing keys.

**Detection:** Run succeeds with `selectAgent` keyword routing instead of assigned expert.

### Pitfall 11: Silent Runtime Escalation to RLM

**What goes wrong:** High-complexity nodes auto-switch to recursive runtime at execute time even though planner marked `runtime: single`, or the reverse — user expects RLM breakdown but gets single-pass timeout.

**Prevention:** Planner sets `runtime: rlm | single` at plan time (TEAM-06); no classify-at-run escalation in v1.5. User override is visible and protected for replan.

**Detection:** Trace shows RLM depth > 0 for nodes whose card displayed single-pass before run.

### Pitfall 12: Session Save Omits New Authoring Fields

**What goes wrong:** v1.4 session bundles restore graph topology but drop `planGenerationId`, protected flags, expert snapshots, or workflow sidecar pointers — reopen appears pristine and triggers wrongful silent replan.

**Prevention:** Extend session snapshot schema in same phase as plan-from-node; restore verification checks new fields; version bump with migration notes.

**Detection:** Reopened session loses `assignmentMode: custom` or pin state; restore verification passes with reduced field count.

### Pitfall 13: Non-Deterministic Planner Breaks Export Diffing

**What goes wrong:** Replan produces different topology for the same prompt; users cannot tell if export changed meaningfully; merge tests flake.

**Prevention:** Accept non-determinism for authoring but store planner model id + prompt hash in plan metadata; tests use fixture planner or recorded responses; do not assert exact node labels in replay tests unless playbook frozen.

**Detection:** CI flakes on plan integration tests; repeated submit changes child count without prompt edit.

---

## Minor Pitfalls

### Pitfall 14: Empty Canvas vs Root-Composer Confusion

**What goes wrong:** App load shows “waiting for graph” empty state instead of focused `root-composer`, reintroducing chat-first flow (PLAN-01).

**Prevention:** Always seed `root-composer`; unify Save + Plan into Submit on node card.

### Pitfall 15: Layout Treated as Protected State

**What goes wrong:** Replan gate triggers because user dragged nodes (`updateGraphLayout`), annoying users who only adjusted canvas aesthetics.

**Prevention:** Layout mutations do not mark nodes protected; replan preserves positions best-effort for surviving node ids.

### Pitfall 16: Both Variants Default When Root Is Not Templatable

**What goes wrong:** Save dialog defaults to “Both” for graphs without a clear root task, producing empty or nonsensical pipeline templates.

**Prevention:** Default Both only when root prompt contains templatable task; otherwise default Playbook with explanation.

### Pitfall 17: Controller Authority Bypass

**What goes wrong:** Planner or UI writes graph mutations outside `InteractiveExecutionSession` / checkpoint controller paths, skipping approval tokens and stale-handling from v1.0.

**Prevention:** All plan/replan mutations go through controller methods that publish events and respect approval modes.

---

## Phase-Specific Warnings

| Phase topic | Likely pitfall | Mitigation |
|-------------|----------------|------------|
| Plan-from-node (Phase 18) | Protected-state false negatives → silent replan | Explicit pristine/protected matrix; replan API returns gate reason |
| Plan-from-node | Planner unstructured output | Typed plan schema + hard fail |
| Plan-from-node | Budget exhaustion hidden | Propagate `exhausted` to UI/CLI with stop reason |
| Graph export (Phase 19) | Lossy agent-list export | `kind: graph` sidecar only; no auto-linearization |
| Graph export | Variant smart-default drift | Single resolver; run metadata records variant |
| Graph export | Import drops expert/runtime fields | Round-trip isomorphism tests (TEAM-08) |
| Expert team (Phase 20) | Allowlist cosmetic only | Filter tools at execution; constrained calling on |
| Expert team | Shallow merge drops tier maps | Deep-merge node assignment snapshots |
| Expert team | Missing preset silent fallback | Validate presets at plan + run start |
| Session integration | New fields not in save bundle | Extend snapshot schema + restore verification |
| UI/CLI parity | Replan gate CLI missing | Shared service; integration tests both surfaces |

---

## Cross-Cutting Local-First Warnings

| Concern | Pitfall | Prevention |
|---------|---------|------------|
| Single-user local | No merge conflicts from multi-device — but **session file + live graph** can diverge if export/import races with open UI | Etag/version on sidecar; prompt before overwrite import |
| LLM non-determinism | Same graph name, different topology on replan | Freeze via export; treat dynamic plan as authoring-only |
| Observability | Planner fails “softly” with empty children | Zero silent empty plans; non-zero CLI exit on plan failure |
| v1.4 memory | Planner context over-includes episodic/vector memory | Scope planner input separately from node execution resolver limits |

---

## Sources

| Source | Confidence | Used for |
|--------|------------|----------|
| `.planning/PROJECT.md`, `.planning/notes/node-centric-dynamic-planning.md` | HIGH | Replan UX, protected state, root-composer |
| `.planning/notes/graph-workflow-export.md`, `.planning/seeds/save-graph-as-workflow.md` | HIGH | Export format, variants, replay semantics |
| `.planning/notes/expert-team-architecture.md` | HIGH | Expert presets, allowlists, runtime at plan time |
| `.planning/milestones/v1.3-REQUIREMENTS.md` (PLAN/EXPORT/TEAM) | HIGH | Requirement-level failure modes |
| `.planning/milestones/v1.2-MILESTONE-AUDIT.md` (MODL-05 shallow merge) | HIGH | Nested config merge pitfall |
| `src/application/execution-controller.ts` (`plannedChildrenFor`, `planNode`) | HIGH | Current heuristic baseline to replace |
| Multi-agent orchestration patterns (Coverge, 2025) | MEDIUM | Partial failure, deterministic replay separation |
| Workflow optimization survey (template vs runtime graph) | MEDIUM | Export vs live authoring distinction |

---

## Pre-Submission Checklist

- [x] Plan-from-node, export, and expert domains covered
- [x] Negative claims tied to project requirements and code
- [x] Warning signs and detection criteria included
- [x] Phase-specific mitigation table for roadmap
- [x] Confidence levels assigned
- [x] Prior v1.4 memory pitfalls preserved as cross-cutting where relevant (session schema, no silent restore)
