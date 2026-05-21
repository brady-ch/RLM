# Technology Stack — v1.5 Dynamic Graph Authoring

**Project:** Recursive Language Model CLI (v1.5 milestone)  
**Researched:** 2026-05-21  
**Scope:** Stack additions/changes only for plan-from-node, graph workflow export, expert team assignment, and matching CLI/UI surfaces. Existing TypeScript/Node layered architecture, Ollama adapter, `PurposeRoutingLanguageModel`, `InteractiveExecutionSession`, and React/Vite/Tauri stack are **not** re-researched.

**Overall confidence:** HIGH for “stay on existing deps + ports”; MEDIUM for optional refinements (dedicated `plan` purpose, LangGraph removal).

---

## Executive recommendation

**Do not add major new runtime dependencies.** v1.5 should extend the repo’s established patterns: `LanguageModelPort` + Zod validation + `yaml` I/O + hand-rolled CLI parsing + `@xyflow/react` for the canvas. The milestone’s net-new stack is **application-layer modules and port contracts**, not a second orchestration framework.

| Capability | Stack decision |
|------------|----------------|
| Model-driven plan-from-node | New `PlannerPort` + Zod planner output schema; call via existing `LanguageModelPort` (small/fast tier) |
| Graph workflow sidecars | Existing `yaml` + Zod discriminated workflow config; new serializer/runner in `src/application/` |
| Expert presets | Extend `ExecutionGraphNode` / config binding; reuse `agent-registry`, `PurposeRoutingLanguageModel`, `constrainedToolCalling` |
| CLI plan/export | Extend `src/cli/args.ts` and `src/index.ts` routing; no CLI framework |

---

## Recommended stack (additions only)

### Core — planner port (replaces `plannedChildrenFor`)

| Piece | Version | Purpose | Why |
|-------|---------|---------|-----|
| **(no new package)** `PlannerPort` | — | Abstract model-driven child planning + replan merge input | Matches `src/ports/*` boundary; keeps `execution-controller.ts` testable with a fake planner |
| **Zod** | `^4.4.3` (existing) | `PlannerChildSpecSchema`, replan request/response shapes | Already used in `project-config.ts`, tools, adapters; single validation story |
| **`LanguageModelPort`** | existing | Planner completion (JSON-in-text) | Same adapter path as RLM quality-loop evaluators (`extractJsonObject` in `recursive-language-model.ts`) |
| **`PurposeRoutingLanguageModel`** | existing | Route planner calls to a **planning tier** | Add a dedicated purpose (recommended: `plan` or reuse `decompose`) in `AgentConfig.models` and `LanguageModelPurpose` |

**Integration points**

- `src/ports/planner-port.ts` (new): `planChildren(input) → PlannerResult`, `replanSubtree(input) → PlannerResult` with explicit error types (no thrown strings swallowed).
- `src/application/graph-planner.ts` (new): builds prompts from node + ancestor chain + budget + agent catalog; calls model; `safeParse` with Zod; surfaces `PlannerFailure` to UI/CLI.
- `src/application/execution-controller.ts`: replace `plannedChildrenFor()` call in `planNode()` with injected planner; add protected-state metadata (`planGenerationId`, `plannedByParentId`, `protected: boolean`).
- `src/application/control-server.ts`: extend `POST /api/nodes/:id/plan` body for replan mode (`replace` | `merge` | `cancel`) when protected descendants exist.
- `src/application/model-provider.ts` / `project-config.ts`: optional `agents.<id>.models.plan` (or map `plan` → `decompose` tier in v1.5.0 to avoid config churn).

**Parsing strategy (opinionated)**

- Prefer **JSON object in model text** + shared `extractJsonObject()` helper moved to `src/domain/structured-output.ts` (extract from RLM) over new structured-output APIs.
- Do **not** add LangChain `withStructuredOutput` only for the planner unless Ollama structured output is verified for all supported models (increases adapter divergence).
- Planner prompts should request **no tools** (`constrainedToolCalling: false`, empty tools array) to reduce failure modes and cost.

### Graph workflow YAML sidecars

| Piece | Version | Purpose | Why |
|-------|---------|---------|-----|
| **`yaml`** | `^2.8.4` (existing) | Parse/stringify `.rlm/workflows/*.yaml` | Already in `project-config.ts`; same error surfacing pattern (`parseYamlTagged`) |
| **Zod** | existing | `GraphWorkflowSidecarSchema`, workflow registry entry `kind: graph` | Discriminated union alongside `mode: ram_queue` |
| **Node `fs/promises`** | built-in | Read/write sidecars under `.rlm/workflows/` | Matches session/run-state file adapters |

**Integration points**

- `src/application/graph-workflow-serializer.ts` (new): `exportGraph(session, variant)` / `importGraph(doc)` — lossless round-trip of `ExecutionGraph` + expert fields + viewport (best-effort).
- `src/application/graph-workflow-store.ts` (new): resolve `rlm.config.yaml` pointer (`workflows.<id>.kind: graph`, `path:`) vs default `.rlm/workflows/<id>.yaml`.
- `src/application/graph-workflow-runner.ts` (new): topological execution over frozen graph; **no replan** unless session flag; delegates node execution to existing agent/RLM paths by `runtime` + `agentId`.
- `src/application/project-config.ts`: extend `WorkflowConfig` union:
  - `mode: "ram_queue"` (unchanged)
  - `kind: "graph"` + `path` + optional `defaultVariant: "playbook" | "pipeline"`
- `src/application/workflow-runner.ts`: if `kind === "graph"`, delegate to `runGraphWorkflow`; keep agent-list workflows untouched.
- Template rendering: **built-in** `applyPipelineTemplate(graph, { input: string })` replacing root `{{input}}` only — regex or simple split, no templating engine.

**Sidecar shape (stack-relevant fields)**

- `schemaVersion`, `graphId`, `updatedAt`
- `variants.playbook.graph` / `variants.pipeline.graph` (or two files — planner choice in implementation, not a new library)
- Per-node: `id`, `parentId`, `prompt`, `composer.type`, `agentId`, `assignmentMode`, `tools[]`, `models` tier snapshot, `runtime: single | rlm`, overrides, `position`

### Expert team binding

| Piece | Version | Purpose | Why |
|-------|---------|---------|-----|
| **`createAgentRegistry`** | existing | Expert preset catalog | Presets already bundle prompt, tools, tier map |
| **`PurposeRoutingLanguageModel`** | existing | Per-node purpose→tier at run | Export can snapshot tier names; run resolves against live config |
| **`constrainedToolCalling`** | existing (`language-model-port.ts`) | Enforce per-node tool allowlist | v1 allowlist-only; no per-role adapters |
| **`runRecursivePrompt` / `runConfiguredAgent`** | existing | `runtime: rlm` nodes | Reuse RLM engine with expert’s `AgentConfig` |

**Type extensions (not new packages)**

- `ExecutionGraphNode`: `agentId`, `assignmentMode: "preset" | "custom"`, optional `toolsAllowlist`, `runtimeMode: "single" | "rlm"`, `expertPresetId?`
- `NodeComposer.runtime`: extend union to include execution binding distinct from composer type (`model` | `code` | `tts` vs run mode) — avoid overloading `composer.runtime` for RLM; prefer explicit `runtimeMode` on the node (per expert-team note).
- Export sidecar includes assignment snapshots for EXPORT-07 explicit failures when preset/tools missing at run start.

**Integration points**

- Planner output schema includes `agentId`, `complexity`, `runtimeMode` per child.
- `src/application/runtime-composition.ts`: resolve tools by **node** allowlist, not only agent defaults.
- UI (`ui/`): Expert dropdown reads `AgentRegistry` profiles; no new UI framework.

### CLI and control-server commands

| Piece | Version | Purpose | Why |
|-------|---------|---------|-----|
| **`src/cli/args.ts`** (extend) | existing | `--variant playbook\|pipeline`, workflow export/import flags | Consistent with current hand-rolled parser; no `commander`/`yargs` |
| **`src/index.ts`** (extend) | existing | Route `workflow export`, `workflow import`, graph workflow run | Single entrypoint |

**Recommended CLI surface (stack-level)**

```bash
# Plan-only / graph authoring (extends existing --plan-only)
rlm ask "..." --plan-only                    # unchanged semantics
rlm ui                                       # plan-from-node via API

# Graph workflow run (extends --workflow)
rlm --workflow feature-delivery "new task"   # pipeline when arg present
rlm --workflow feature-delivery --variant playbook
rlm --workflow feature-delivery --export .rlm/workflows/feature-delivery.yaml  # optional explicit path

# Explicit subcommands (optional but clearer for parity)
rlm workflow export <id> --variant both
rlm workflow import <path>
```

**Control-server additions (mirror CLI)**

- `POST /api/workflows/export`, `POST /api/workflows/import`
- `POST /api/nodes/:id/plan` body: `{ replan?: "replace"|"merge"|"cancel" }`
- Run metadata in snapshot/events: `workflowVariant`, `plannerModel`, `exportPath`

---

## Supporting libraries — use vs skip

| Library | Verdict | Notes |
|---------|---------|-------|
| **Zod** | **Use** | Planner I/O, sidecar validation, workflow config union |
| **yaml** | **Use** | Sidecars + config pointers |
| **@langchain/ollama** | **Keep** | Only existing model adapter; planner uses same stack |
| **@langchain/langgraph** | **Do not adopt for v1.5** | Declared in `package.json` but **unused in `src/`**; frozen graph runner is a small topo-sort + existing node executor |
| **deepagents** | **Do not adopt** | Misaligned with port/adapter architecture |
| **Handlebars / Mustache / nunjucks** | **Avoid** | Only `{{input}}` at root for pipeline variant in v1 |
| **graphlib / dagre** | **Avoid for v1** | Topo-sort is ~30 lines; layout already manual/React Flow |
| **AJV / json-schema** | **Avoid** | Duplicates Zod |
| **second YAML lib** | **Avoid** | `yaml` already standard here |
| **commander / yargs** | **Avoid** | Breaks established `parseArgs` patterns |
| **n8n SDK / workflow engines** | **Avoid** | Out of scope; sidecar is custom `kind: graph` |

---

## Alternatives considered

| Category | Recommended | Alternative | Why not |
|----------|-------------|-------------|---------|
| Planner orchestration | `PlannerPort` + JSON+Zod | LangGraph planner subgraph | No LangGraph usage in codebase; heavy dependency for one call |
| Structured planner output | Zod + `extractJsonObject` | Native Ollama JSON schema / LC structured output | Model/host matrix; keep one parsing path like quality loops |
| Graph execution | Custom topo runner in application | LangGraph `StateGraph` | Export is static DAG; no checkpoint streaming needed |
| Pipeline templates | String replace `{{input}}` | Handlebars | One slot in v1; fewer failure modes |
| Workflow storage | `.rlm/workflows/*.yaml` | SQLite/JSON only | Matches existing `.rlm/` scoped config pattern |
| Expert tools | Shared tools + allowlist | Per-role adapter copies | Explicit v1.5 decision in PROJECT.md |

---

## Installation

**No new `npm install` required for v1.5 MVP** if recommendations are followed.

Optional later (not v1.5):

```bash
# Only if Ollama structured JSON is standardized across all target models
# npm install zod-to-json-schema  # bridge to host native schema — defer
```

**Dependency hygiene (non-blocking):** Consider removing unused `@langchain/langgraph` and `deepagents` in a separate cleanup PR to shrink install surface — not required for feature delivery.

---

## Layer map (new modules)

```
src/ports/planner-port.ts          ← contract
src/application/graph-planner.ts   ← model calls + Zod
src/application/graph-workflow-serializer.ts
src/application/graph-workflow-store.ts
src/application/graph-workflow-runner.ts
src/application/execution-controller.ts  ← inject planner, protected metadata
src/application/project-config.ts      ← WorkflowConfig union
src/application/workflow-runner.ts     ← dispatch kind: graph
src/cli/args.ts                        ← variant, export/import
src/domain/types.ts                    ← node expert + runtime fields
src/domain/structured-output.ts        ← shared extractJsonObject (optional extract)
```

UI/Tauri: **no new npm deps** — consume extended control-server API only.

---

## What to avoid (product + stack)

1. **Lossy export** to `workflows.<id>.agents: [...]` agent-list shape — breaks per-node prompts and expert metadata.
2. **Silent template fallback** when `{{input}}` missing in pipeline mode — fail at run start (EXPORT-07).
3. **Silent runtime escalation** to RLM at execute time — planner must set `runtimeMode` visibly (TEAM-06).
4. **Keyword heuristics** left in parallel with planner — remove `plannedChildrenFor` path after planner ships.
5. **LangGraph/deepagents** for graph run/plan — conflicts with AGENTS.md port boundaries.
6. **New model hosts or HF catalog** in v1.5 — orthogonal milestone themes.
7. **Per-role tool implementations** — allowlists only until seed trigger fires.
8. **Chat-first as default authoring** — UI stack unchanged but entry flow seeds `root-composer` only.

---

## Verification checklist (stack)

| Claim | Confidence | Source |
|-------|------------|--------|
| `yaml` + `zod` already used for config | HIGH | `package.json`, `project-config.ts` |
| `LanguageModelPort` has no native structured output | HIGH | `language-model-port.ts` |
| JSON extraction pattern exists | HIGH | `recursive-language-model.ts` `extractJsonObject` |
| LangGraph not used in source | HIGH | ripgrep `src/` |
| Expert presets = `agents.*` + registry | HIGH | `agent-registry.ts`, expert-team note |
| Plan API exists | HIGH | `control-server.ts` `POST .../plan` |

---

## Sources

- Repo: `package.json`, `src/application/project-config.ts`, `src/application/execution-controller.ts`, `src/ports/language-model-port.ts`, `src/domain/recursive-language-model.ts`, `src/application/agent-registry.ts`, `src/application/control-server.ts`
- Milestone notes: `.planning/notes/node-centric-dynamic-planning.md`, `.planning/notes/graph-workflow-export.md`, `.planning/notes/expert-team-architecture.md`
- Requirements: `.planning/milestones/v1.3-REQUIREMENTS.md` (PLAN/EXPORT/TEAM)
- Zod validation patterns: Context7 `/colinhacks/zod` (safeParse) — HIGH confidence
