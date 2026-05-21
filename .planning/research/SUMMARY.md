# Project Research Summary

**Project:** Recursive Language Model CLI — v1.5 Dynamic Graph Authoring  
**Domain:** Local-first recursive AI workflow CLI + interactive graph UI  
**Researched:** 2026-05-21  
**Confidence:** HIGH overall (grounded in live codebase + v1.5 planning notes)

## Executive Summary

v1.5 transforms the execution graph from a planning artifact into the **primary product surface**: users submit tasks on canvas nodes, a model-driven planner expands subtrees, expert presets bind per node, and approved graphs export as replayable `kind: graph` workflow sidecars. The repo already has the right foundations — `InteractiveExecutionSession`, `PurposeRoutingLanguageModel`, agent registry, approval checkpoints, and session memory — but planning still uses keyword heuristics (`plannedChildrenFor`), UI execution runs only the root prompt through `selectAgent`, and `runWorkflow` understands flat agent-list workflows only.

The recommended approach is **extend, don't replace**: no major new runtime dependencies, no LangGraph/deepagents adoption. Add application-layer modules (`GraphPlanner`, `GraphExecutor`, graph workflow store/serializer/runner) behind existing ports (`LanguageModelPort`, Zod validation, `yaml` I/O). Keep `InteractiveExecutionSession` as the single graph authority; inject a pure `PlannerPort` service; walk approved topology at execution time via `NodeAgentResolver`. Export uses lossless sidecars with playbook (literal) and pipeline (`{{input}}`) variants — a deliberate bridge from exploratory planning to frozen replay without lossy conversion to legacy agent-list workflows.

The dominant risks are **silent data loss** (protected subtree wiped on replan, lossy export, replan-on-run breaking replay) and **semantic drift** (UI/CLI divergence, cosmetic expert binding, heuristic planner fallback). Mitigation is explicit: Replace/Merge/Cancel replan gate, Zod-validated planner output with hard fail (no heuristic fallback), `kind: graph` sidecars only, frozen executor with no planner calls, and tool allowlists enforced at execution bind time. Build order follows dependency spine: plan-from-node → expert binding → graph execution → export/import → hardening.

## Key Findings

### Stack Additions

**No new `npm install` required.** v1.5 net-new stack is application modules and port contracts, not a second orchestration framework.

| Addition | Purpose | Why |
|----------|---------|-----|
| `PlannerPort` + `graph-planner.ts` | Model-driven child planning + replan merge input | Matches `src/ports/*`; testable with fake planner |
| Zod schemas (`PlannerChildSpecSchema`, sidecar) | Planner I/O + workflow config union | Already used everywhere; single validation story |
| `LanguageModelPort` + `extractJsonObject` | Planner JSON-in-text parsing | Same path as RLM quality loops; avoid adapter divergence |
| `PurposeRoutingLanguageModel` + `plan` purpose | Route planner to planning tier | Reuse tier map; optional map `plan` → `decompose` in v1.5.0 |
| `graph-workflow-serializer/store/runner` | Export/import + frozen topo execution | Built on existing `yaml`, `fs/promises`, ~30-line topo-sort |
| Extended `WorkflowConfig` (`kind: graph`) | Sidecar pointer in `rlm.config.yaml` | Discriminated union alongside `mode: ram_queue` |
| Extended `ExecutionGraphNode` types | Expert fields, `runtimeMode`, plan lineage | No new packages; export snapshot fidelity |
| CLI/control-server extensions | `--variant`, export/import, replan body | Hand-rolled `args.ts`; no commander/yargs |

**Explicitly avoid:** LangGraph, deepagents, Handlebars/Mustache, graphlib/dagre, AJV, second YAML lib, n8n SDK, per-role tool adapter copies, lossy agent-list export.

### Feature Table Stakes

Features users expect for v1.5 to feel complete relative to prior milestones and comparable tools (CrewAI, LangGraph, n8n patterns):

| Feature | Why expected |
|---------|--------------|
| Graph-primary authoring (root-composer on load) | v1.5 explicitly replaces chat-first default |
| Model-driven child planning | Keyword heuristics are a demo stub, not product |
| Per-node subtree planning + plan budget exhaustion | Standard hierarchical decomposition; PLAN-07 |
| Approval before run | Reuse v1.0 `--plan-only`, `--require-approval` |
| Parent replan with pristine silent refresh | Users revise intent at parent nodes |
| Export graph to replayable workflow | Stated v1.5 bridge goal |
| Import → edit → re-export round-trip | Industry baseline (n8n JSON, etc.) |
| Replay without replan | Core "save as workflow" value |
| Explicit run failures (missing agent/model/template) | Product invariant since v1.0 |
| Role/agent per node + tool allowlists | Standard multi-agent safety pattern |
| Expert visible on node card | Inspect who runs what before approve |
| UI + CLI parity | Established project constraint |

**Differentiators to preserve:** Protected replan (Replace/Merge/Cancel), playbook + pipeline dual variants, lossless `kind: graph` sidecars, plan-time RLM vs single-pass runtime (no silent escalation), purpose→tier maps per expert, session memory integration.

**Defer within v1.5:** Per-node literal/template beyond root, CI workflow discovery, specialized tool surfaces per role, visual expert preset authoring.

### Architecture Build Order

Keep **one graph authority** (`InteractiveExecutionSession`); planner is pure application service; executor walks session topology; expert binding via `NodeAgentResolver` (not `selectAgent` for graph nodes).

**Major components:**

1. **`GraphPlanner`** — model calls, Zod validation, expert/runtime assignment in plan output
2. **`InteractiveExecutionSession`** (extended) — applies plan diffs, protected-state detection, replan orchestration
3. **`NodeAgentResolver`** — node → `AgentProfile` + constrained tools at execution
4. **`GraphExecutor`** — topological walk over approved/frozen graph; shared by UI runner and workflow replay
5. **`graph-workflow-store/serializer`** — sidecar I/O, playbook/pipeline variants, template substitution
6. **`runGraphWorkflow`** — `workflow-runner` branch for `kind: graph`

**Recommended implementation waves:**

| Wave | Focus | Key deliverables |
|------|-------|------------------|
| 1 — Foundation | Plan-from-node spine | Types, `PlannerPort`, wire `planNode`, root-composer seed, replan API + protection helpers |
| 2 — Expert binding | Plan-time + run-time | `NodeAgentResolver`, planner emits `agentId`/`runtimeMode`, inspector overrides |
| 3 — Graph execution | Close the loop | `GraphExecutor`, replace root-only UI runner, single-pass path, RLM depth alignment |
| 4 — Export/import | Frozen replay | Sidecar serialize/deserialize, `runWorkflow` graph branch, CLI parity, round-trip |
| 5 — Hardening | Integration | Plan→approve→run tests, session save/reopen for new fields |

### Watch Out For (Top Pitfalls)

1. **Silent subtree loss on parent replan** — Incomplete protected-state detection wipes user edits, pins, model overrides. Always gate when protected descendants exist; merge never deletes protected node ids.

2. **Planner output without schema validation** — Raw LLM output or enum drift causes partial graphs or hidden heuristic fallback. Zod validate before `registerNode`; hard fail with PLAN-07; remove `plannedChildrenFor` path entirely.

3. **Lossy graph export (agent-list conversion)** — Collapsing to `workflows.*.agents[]` drops topology, per-node prompts, expert metadata. `kind: graph` sidecars only; no auto-linearization.

4. **Silent playbook/pipeline variant switch** — Smart-default drift between UI/CLI mutates prompts on replay. Resolve variant once at run start; persist in metadata; validate `{{input}}` before execution.

5. **Expert allowlist not enforced at execution** — Plan metadata cosmetic only; runtime uses full tool registry. Filter tools at bind time; `constrainedToolCalling: true`; trace shows effective tools.

6. **Replan-on-run for frozen workflows** — Saved workflows invoke planner during replay; non-deterministic CI. Graph executor frozen mode only; no `purpose: plan` in replay trace.

## Implications for Roadmap

Suggested **five-phase v1.5 sequencing** aligned with dependency spine (plan → expert → execute → export → harden):

### Phase 1: Plan-from-Node Foundation
**Rationale:** Unlocks real graph authoring; export and expert assignment need planned nodes. Replaces the demo heuristic path.  
**Delivers:** `PlannerPort` + `GraphPlanner`, extended node types, `planNode` wired to planner, default `root-composer` seed, budget exhaustion errors, pristine replan.  
**Addresses:** Graph-primary authoring, model-driven planning, per-node subtree scope, approval gate feed-through.  
**Avoids:** Planner unstructured output (Pitfall 2), empty canvas confusion (Pitfall 14), controller authority bypass (Pitfall 17).

### Phase 2: Protected Replan UX
**Rationale:** Plan-from-node breaks immediately on any user edit without Replace/Merge/Cancel; highest trust risk.  
**Delivers:** `replanNode` API, pristine/protected detection (`planGenerationId`, pins, overrides, custom assignment), control-server replan body, UI conflict dialog, CLI parity.  
**Addresses:** Parent replan, protected overrides surviving merge.  
**Avoids:** Silent subtree loss (Pitfall 1), layout mistaken as protected (Pitfall 15).

### Phase 3: Expert Team Binding
**Rationale:** Enriches planned nodes before execution/export need metadata; can ship incrementally but export depends on fields existing.  
**Delivers:** `NodeAgentResolver`, planner emits `agentId` + `runtimeMode`, inspector overrides (`assignmentMode: custom`), allowlist enforcement at bind, per-node trace metadata.  
**Addresses:** Role per node, tool allowlists, expert on node card, plan-time RLM visibility.  
**Avoids:** Allowlist cosmetic only (Pitfall 5), silent runtime escalation (Pitfall 11), missing preset fallback (Pitfall 10), shallow merge (Pitfall 7).

### Phase 4: Graph Execution Loop
**Rationale:** Closes gap where UI runs root-only through RLM while canvas shows planned children; required before export replay is meaningful.  
**Delivers:** `GraphExecutor` topological walk, graph-aware UI runner, single-pass runtime path, RLM depth so planned nodes don't re-decompose, session.control integration.  
**Addresses:** Execute planned topology as bound agents, not overlapping RLM spawn.  
**Avoids:** Dual graph truth without driver mode, replan-on-run conflation (Pitfall 6).

### Phase 5: Graph Workflow Export/Import
**Rationale:** Depends on stable graph snapshot + expert fields + working executor for replay validation.  
**Delivers:** `graph-workflow-store/serializer`, playbook/pipeline/both variants, `runWorkflow` `kind: graph` branch, import→session round-trip, CLI `--variant`/export/import, explicit EXPORT-07 failures.  
**Addresses:** Save/load workflow, replay without replan, dual variants, round-trip edit.  
**Avoids:** Lossy export (Pitfall 3), variant drift (Pitfall 4), import drops expert fields.

### Phase 6: Integration Hardening (optional capstone)
**Rationale:** Session memory (v1.4) and UI/CLI parity need verification after new fields land.  
**Delivers:** Session snapshot schema extension, restore verification for plan/expert fields, integration tests (plan→approve→run, export→CLI run, protected replan), shared error vocabulary parity tests.  
**Avoids:** Session save omits authoring fields (Pitfall 12), UI/CLI divergence (Pitfall 8).

### Phase Ordering Rationale

- **Plan-first (Phases 1–2):** Export and expert metadata attach to nodes that only exist after model planning; protected replan is inseparable from plan-from-node trust model.
- **Expert before execute (Phase 3):** Executor needs `NodeAgentResolver`; planner should emit assignments early so UI cards and export schema stabilize together.
- **Execute before export (Phase 4→5):** Replay validation requires working frozen executor; export without execute loop risks shipping sidecars that fail at run start.
- **Hardening last:** New node fields must flow through session memory and both surfaces; catches shallow-merge and parity gaps accumulated across phases.

### Research Flags

**Needs deeper research during planning:**
- **Phase 1:** Planner prompt/schema design, JSON retry strategy, planning tier model selection
- **Phase 2:** Merge replan diff algorithm vs full replan of non-protected nodes
- **Phase 4:** Single-pass runtime implementation (`maxDepth: 0` vs thin runner)
- **Phase 5:** Per-node `literal | template` beyond root (defer but document)

**Standard patterns (skip research-phase):**
- **Phase 3:** Agent registry + tool allowlist — established in codebase
- **Phase 5:** YAML sidecar I/O — same `yaml` + Zod patterns as `project-config.ts`
- **Phase 6:** Approval/checkpoint model — shipped v1.0

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against `package.json`, ports, existing Zod/yaml usage; no new deps needed |
| Features | HIGH for intent (internal docs); MEDIUM for competitive positioning | CrewAI/LangGraph/n8n docs verified; RLM differentiators from project notes |
| Architecture | HIGH | Grounded in live `src/` layout, execution-controller, workflow-runner gaps |
| Pitfalls | HIGH for repo-specific; MEDIUM for ecosystem patterns | Tied to v1.3 requirements + v1.2 shallow-merge audit |

**Overall confidence:** HIGH

### Gaps to Address

- **Single-pass runtime path:** Architecture states intent but implementation choice (RLM flag vs thin runner) needs spike during Phase 4 planning.
- **Merge replan algorithm:** Protected-node diff semantics need concrete UX + API contract before Phase 2 execution.
- **Planner non-determinism:** Accept for authoring; tests should use fixture planner; do not assert exact labels in replay tests.
- **Parallel graph execution:** v1 likely sequential for approval clarity; defer branch parallelism to later milestone.
- **Optional `plan` purpose in config:** May map to `decompose` tier initially to avoid config churn — decide in Phase 1 planning.

## Sources

### Primary (HIGH confidence)
- Repo: `package.json`, `src/application/execution-controller.ts`, `project-config.ts`, `workflow-runner.ts`, `agent-registry.ts`, `control-server.ts`, `language-model-port.ts`, `recursive-language-model.ts`
- `.planning/PROJECT.md`, `.planning/milestones/v1.3-REQUIREMENTS.md` (PLAN/EXPORT/TEAM)
- `.planning/notes/node-centric-dynamic-planning.md`, `graph-workflow-export.md`, `expert-team-architecture.md`
- `.planning/seeds/save-graph-as-workflow.md`
- `.planning/milestones/v1.2-MILESTONE-AUDIT.md` (MODL-05 shallow merge)

### Secondary (MEDIUM confidence)
- [CrewAI Agents docs](https://docs.crewai.com/en/concepts/agents) — role/goal/tools expert pattern
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence) — checkpoint vs structural export
- [n8n export/import](https://docs.n8n.io/courses/level-one/chapter-6) — workflow round-trip baseline
- [Conductor dynamic workflows](https://conductor-oss.github.io/conductor/devguide/ai/dynamic-workflows.html) — LLM-generated plans at runtime
- Context7 `/colinhacks/zod` — safeParse patterns

### Detailed research files
- [STACK.md](./STACK.md) — technology additions and integration points
- [FEATURES.md](./FEATURES.md) — table stakes, differentiators, anti-features
- [ARCHITECTURE.md](./ARCHITECTURE.md) — component boundaries, build waves, integration contracts
- [PITFALLS.md](./PITFALLS.md) — critical/moderate/minor pitfalls with detection criteria

---
*Research completed: 2026-05-21*  
*Ready for roadmap: yes*
