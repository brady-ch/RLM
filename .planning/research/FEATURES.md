# Feature Landscape: v1.5 Dynamic Graph Authoring

**Domain:** Local-first recursive AI workflow CLI + graph UI  
**Milestone:** v1.5 — plan-from-node, graph workflow export, expert team  
**Researched:** 2026-05-21  
**Confidence:** HIGH for project intent (internal docs); MEDIUM for competitive positioning (verified against CrewAI, LangGraph, n8n docs + industry patterns)

## How These Three Features Typically Work

### Plan-from-node

**Industry pattern:** Dynamic orchestration tools treat the graph as the plan artifact. A planner (LLM or rule engine) expands a node into child steps at authoring time; execution later follows the frozen or approved structure. Frameworks differ on *where* planning happens:

| Product / pattern | Planning surface | Subtree scope | Replan behavior |
|-------------------|------------------|---------------|-----------------|
| **LangGraph** | Code-defined graph; nodes added at build time | Whole graph compiled upfront | Checkpoint replay; graph structure changed by recompiling |
| **CrewAI** | YAML/code agent + task definitions | Crew-level task list | Re-run crew; task order fixed unless re-authored |
| **n8n** | Manual canvas + optional AI assist | Per-workflow | Edit workflow JSON; no model-driven subtree replan |
| **Conductor / dynamic workflows** | LLM emits JSON plan at runtime | Full plan generated per run | Re-execution generates new plan unless frozen |
| **RLM v1.5 (target)** | Canvas node submit → model planner | **Per-node subtree** with budget root inheritance | Pristine silent replan; protected → Replace / Merge / Cancel |

**Typical flow in RLM v1.5:**

1. App loads with a focused empty `root-composer` node (no separate global chat step).
2. User types a task prompt on any editable node and submits.
3. A **model-driven planner** (replacing keyword heuristics in `plannedChildrenFor`) reads node prompt, ancestor context, agent/tool policy, complexity signals, and plan budget.
4. Planner creates or refreshes **direct children** (and deeper levels per budget/flags).
5. Submit on a **child** plans only that node's subtree, inheriting ancestor prompt chain and budget-root semantics.
6. Resubmit on a **parent** replans descendant planned structure; pristine descendants replan silently; protected descendants trigger explicit conflict UX.
7. Planned nodes enter approval flow (`--plan-only`, `--require-approval`) before execution — consistent with v1.0 checkpoint model.

**Current gap:** Today `planNode()` calls `plannedChildrenFor()` with keyword heuristics (`book`/`audio` → audiobook pipeline, else generic plan/code/validate). v1.5 replaces this with a planner model port call while reusing `InteractiveExecutionSession`, `planBudget`, `findBudgetRoot`, and composer node types.

### Graph workflow export

**Industry pattern:** Workflow tools separate **authoring** (iterative design) from **replay** (deterministic re-execution). n8n exports JSON workflows for copy/paste and CLI import; LangGraph compiles graphs and replays from checkpoints — but neither offers RLM's specific playbook/pipeline dual-variant model.

| Capability | n8n | LangGraph | RLM v1.5 (target) |
|------------|-----|-----------|-------------------|
| Serialize topology + per-step config | JSON export | Compiled graph + checkpointer state | `kind: graph` YAML sidecar |
| Replay without replanning | Yes (fixed workflow) | Yes (checkpoint replay) | Yes (`runGraphWorkflow`) |
| Template variables for new runs | Expressions in nodes | State injection | **Pipeline** variant with `{{input}}` at root |
| Literal replay | Same workflow | Same checkpoint values | **Playbook** variant (literal prompts) |
| Round-trip edit in canvas | Import JSON | Recompile from code | Import sidecar → edit → re-export |
| Dual literal + template products | No (single workflow) | No | **Playbook + Pipeline from one topology** |

**Typical flow:**

1. User iterates via plan-from-node until graph is approved.
2. **Save as workflow** dialog: name, Save as Playbook / Pipeline / Both (default Both when root is templatable).
3. Sidecar written to `.rlm/workflows/<id>.yaml` with optional pointer in `rlm.config.yaml`.
4. **Run:** `rlm --workflow <id> "new task"` or UI Run.
   - Smart default: new input → Pipeline; no input / explicit replay → Playbook.
   - Override: `--variant playbook|pipeline` or UI toggle; variant shown at run start.
5. Graph executor runs frozen topology — **no replan** unless user re-imports and edits.
6. Missing agents, models, or template variables **fail explicitly at run start** (no silent fallback).

**Bridge role:** Export is the deliberate bridge from dynamic authoring (explore B) to n8n-like fixed-pipeline reliability (explore A) without lossy conversion to legacy `workflows.*` agent-list shape.

### Expert team

**Industry pattern:** Multi-agent frameworks assign **roles** with goals, tools, and optionally distinct models. CrewAI defines agents via role/goal/backstory + tool list in YAML; LangGraph binds nodes to callables/LLMs at graph build time; AutoGen uses conversational agent personas. None combine **plan-time assignment on a visual graph**, **purpose-tier maps**, and **explicit RLM vs single-pass runtime** as first-class node metadata.

| Capability | CrewAI | LangGraph | RLM v1.5 (target) |
|------------|--------|-----------|-------------------|
| Role-based specialists | Core (`role`, `goal`, `tools`) | Per-node LLM/tool binding | Expert presets from `agents.*` config |
| Assignment timing | Author-time YAML | Build-time code | **Plan-time** by planner model |
| Per-node tool restriction | Agent tool list | Tool node scoping | **Allowlist** on shared `ToolPort` implementations |
| Per-purpose model routing | Single agent LLM (+ optional function-calling LLM) | Per-node model | **Purpose→tier map** per expert (`depth`, `classify`, `decompose`, …) |
| Recursive vs single-pass | Delegation optional | Subgraph nodes | **`runtime: rlm \| single`** chosen at plan time |
| User override before run | Reconfigure code/YAML | Recompile | **Node inspector** override; protected for replan |
| Export carries assignments | Code/YAML only | Code only | **Graph sidecar** includes expert metadata |

**Typical flow:**

1. During plan-from-node, planner assigns an **expert preset** (`agentId`) per node based on task type and complexity.
2. High-complexity nodes get `runtime: rlm` at plan time (visible on node card; no silent escalation in v1).
3. Node inspector shows Expert dropdown, custom badge when tools/tiers diverge from preset, model overrides.
4. Execution binds expert tools (allowlist-only), tier map, and runtime mode; trace/UI show effective assignment.
5. Graph export/import preserves `agentId`, `assignmentMode`, tool allowlist snapshot, tier map, and runtime mode.

**v1 constraint:** One tool implementation per name; experts differ by allowlist only. Specialized tool surfaces deferred until measured failures on small models.

---

## Table Stakes

Features users expect in a graph-centric AI workflow product. Missing these makes v1.5 feel incomplete relative to the product's own prior milestones and comparable tools.

| Feature | Why expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Graph-primary authoring** | v1.1 shipped chat-first refinement; v1.5 explicitly replaces it as default | Med | Root-composer on load; node submit = plan |
| **Model-driven child planning** | Keyword heuristics (`plannedChildrenFor`) are a demo stub, not a product | High | Planner reads prompt, context, budget, policy |
| **Per-node subtree planning** | Standard in hierarchical task decomposition (coordinator patterns) | Med | Child submit scopes to subtree + budget root |
| **Plan budget with explicit exhaustion** | Prevents unbounded graph growth; already in composer model | Low | Surface UI/CLI errors on exhaustion (PLAN-07) |
| **Approval before run** | Shipped v1.0; plan-from-node must feed same gate | Low | Reuse `--plan-only`, `--require-approval` |
| **Parent replan of descendants** | Users revise intent at parent; industry expects plan refresh | Med | Pristine silent replan is table stakes |
| **Export graph to replayable workflow** | Bridge to fixed pipelines is the stated v1.5 goal | Med | Lossless topology + prompts |
| **Import for edit + re-export** | n8n/LangGraph users expect round-trip | Med | Graph-isomorphic modulo layout |
| **Replay without replan** | Core value of "save as workflow" | Med | `runGraphWorkflow` / `kind: graph` path |
| **Explicit run failures** | Core product value since v1.0 | Low | Missing agent/model/template var at run start |
| **Role/agent per node** | CrewAI/LangGraph normalize specialist agents | Med | Planner assigns; user sees on node card |
| **Tool allowlists per node** | Standard safety pattern for constrained agents | Low | Shared implementations, different allowlists |
| **UI + CLI parity** | Established project constraint | Med | Plan, replan, export, import, expert metadata |
| **Expert visible on node card** | Users must inspect who runs what before approve | Low | Preset name + custom badge |

---

## Differentiators

Features that set RLM apart — not universally expected, but aligned with recursive-graph product positioning and hard-won v1.0–v1.4 investments.

| Feature | Value proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Protected-state replan (Replace / Merge / Cancel)** | Preserves user edits, pins, model overrides during parent replan | High | Rare in competitors; LangGraph/n8n lack merge semantics for LLM-planned subtrees |
| **Playbook + Pipeline dual variants** | Same topology serves literal replay and templated new tasks | Med | Smart default + `--variant` override; two products from one save |
| **Lossless `kind: graph` sidecars** | Full node prompts, composer types, overrides — not agent-list loss | Med | Distinct from legacy `workflows.default` agent arrays |
| **Plan-time RLM vs single-pass runtime** | Complexity routed to recursive engine upfront, visible before run | Med | No silent escalation; integrates with existing `RecursiveLanguageModel` |
| **Purpose→tier maps per expert** | Fine-grained model routing by completion purpose | Med | Extends v1.3 sampling cascade with role-aware routing |
| **Protected overrides in replan** | Expert/model/tool changes survive parent replan when pinned | Med | Ties expert team to plan-from-node conflict UX |
| **Export includes expert assignment metadata** | Frozen workflows preserve team composition | Low | Enables CI/demos with same specialist mix |
| **Integration with session memory (v1.4)** | Planned graphs + expert assignments restore in saved sessions | Med | Builds on durability foundation, not greenfield |
| **Local-first, no silent fallback** | Explicit errors vs cloud orchestrators' opaque retries | Low | Product invariant since v1.0 |
| **Recursive graph as first-class product surface** | Not a code-only LangGraph graph or CrewAI YAML crew | High | Canvas + CLI for same semantics |

---

## Anti-Features

Features to explicitly **not** build in v1.5.

| Anti-feature | Why avoid | What to do instead |
|--------------|-----------|-------------------|
| **Lossy export to agent-list workflows** | Drops per-node prompts, topology, expert metadata | `kind: graph` sidecar only |
| **Silent replan over protected nodes** | Destroys user trust and edits | Replace / Merge / Cancel dialog |
| **Silent runtime escalation to RLM** | Hides cost/complexity from user | Plan-time `runtime: rlm` + visible override |
| **Chat-first as default authoring** | Contradicts v1.5 goal | Graph node submit default; chat remains refinement adjunct if kept |
| **Per-role duplicate tool adapters (v1)** | Multiplies adapter surface before measured need | Shared tools + allowlists; seed specialized surfaces for later |
| **UI for authoring new expert YAML presets** | Scope creep | Config edit for v1; UI authoring later |
| **n8n parity (scheduling, webhooks, credentials)** | Different product category | Export bridge only; scheduling is future milestone |
| **Automatic linearization to agent-list** | Loses graph semantics | Keep hand-written agent workflows separate |
| **Replan-on-run for saved graph workflows** | Breaks replay contract | Frozen executor; replan only after import + edit |
| **Keyword/heuristic planning fallback without explicit degraded state** | Violates no-silent-failures rule | Planner failure → explicit error; no hidden heuristic path |

---

## Feature Dependencies

```
root-composer default UX
    └── plan-from-node (model planner)
            ├── protected replan UX (Replace / Merge / Cancel)
            ├── expert assignment at plan time
            │       └── node inspector overrides (protected)
            └── graph workflow export
                    ├── playbook variant (literal prompts)
                    ├── pipeline variant ({{input}} templates)
                    └── import round-trip
                            └── re-export after edit

v1.4 session memory ──► export/import preserves graph + expert metadata in saved sessions
v1.3 model library / sampling cascade ──► expert tier maps + node overrides
v1.0 approval checkpoints ──► planned graph enters same approval gate
```

**Recommended build order (matches project sequencing B → A → C):**

1. **Plan-from-node** — unlocks real graph authoring; export and expert assignment need planned nodes.
2. **Graph workflow export** — depends on stable graph snapshot from planning; carries expert fields when ready.
3. **Expert team** — enriches planned nodes; can ship incrementally (planner emits assignments → UI → execution binding) but export should include metadata once expert fields exist.

---

## MVP Recommendation (v1.5)

**Prioritize:**

1. **Plan-from-node core** — root-composer, model planner, subtree scope, budget exhaustion errors, pristine replan.
2. **Protected replan UX** — Replace / Merge / Cancel; without this, plan-from-node breaks on any user edit.
3. **Graph export/import** — Playbook + Pipeline (Both default), smart run default, explicit `--variant`, no replan on run.
4. **Expert assignment minimum** — planner assigns preset per node, visible on card, allowlist enforcement, export fields.

**Defer within milestone (acceptable if phased):**

- Per-node `literal | template` flags beyond root (hybrid graphs) — post-MVP enhancement.
- CI discovery of `.rlm/workflows/*.yaml` — convenience, not blocking.
- Specialized tool surfaces per role — trigger via seed when small-model failures measured.
- Visual expert preset authoring — config-only for v1.

**Defer to later milestones:**

- Scheduling, webhooks, credentials (n8n-class automation).
- Multi-runner beyond Ollama (v1.3 seed).
- Silent classify-at-run RLM escalation.

---

## Competitive Positioning Summary

| Area | Table stakes (match market) | RLM differentiator |
|------|----------------------------|-------------------|
| **Plan-from-node** | Submit → generate children; budget; approval | Subtree-scoped replan + protected Merge semantics |
| **Export** | Save/load workflow; replay | Dual Playbook/Pipeline; lossless graph sidecar |
| **Expert team** | Role + tools per step | Plan-time assignment + purpose-tier map + explicit RLM runtime + exportable metadata |

RLM v1.5 is not trying to be a full n8n replacement or a code-first LangGraph SDK. It occupies a narrower niche: **local recursive graph authoring with human approval, visible model routing, and a deliberate path from exploratory planning to frozen replay** — with expert team composition baked into the graph artifact.

---

## Sources

| Source | Confidence | Used for |
|--------|------------|----------|
| `.planning/PROJECT.md`, `.planning/milestones/v1.3-REQUIREMENTS.md` (PLAN/EXPORT/TEAM) | HIGH | Requirement definitions, v1.5 scope |
| `.planning/notes/node-centric-dynamic-planning.md` | HIGH | Plan-from-node interaction model |
| `.planning/notes/graph-workflow-export.md` | HIGH | Export format, variants, run UX |
| `.planning/notes/expert-team-architecture.md` | HIGH | Expert assignment, tool strategy |
| `.planning/seeds/save-graph-as-workflow.md` | HIGH | User story, evaluation checks |
| `src/application/execution-controller.ts` (`plannedChildrenFor`, `planNode`) | HIGH | Current implementation gap |
| [CrewAI Agents docs](https://docs.crewai.com/en/concepts/agents) | HIGH | Role/goal/tools expert team pattern |
| [LangGraph persistence / graph API](https://docs.langchain.com/oss/python/langgraph/persistence) | MEDIUM | Checkpoint replay vs structural export |
| [n8n export/import](https://docs.n8n.io/courses/level-one/chapter-6) | MEDIUM | Workflow JSON round-trip baseline |
| [Conductor dynamic workflows](https://conductor-oss.github.io/conductor/devguide/ai/dynamic-workflows.html) | MEDIUM | LLM-generated plans at runtime |
| Agent orchestration pattern surveys (DAG, event-driven) | LOW | General industry context |
