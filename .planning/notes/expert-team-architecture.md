# Expert Team Architecture (Explore C)

**Date:** 2026-05-19  
**Context:** `$gsd-explore expert team` — small-model specialists with constrained tools, visible on the graph, overridable by the user.  
**Depends on:** Phase 18 (plan-from-node), Phase 19 (export carries expert metadata).

## Product intent

The system should feel like a **team of experts** (research, coding, QA, design, …) cooperating on a graph—not one general model with every tool enabled. Experts use **mostly small models** with **purpose-specific tier maps** and **tool allowlists** on shared implementations. When a planned task is too complex for a single small-model pass, the planner marks the node for **RLM** (bounded recursive execution) up front.

## Expert assignment (hybrid)

| Phase | Behavior |
|--------|-----------|
| **Plan** | Model-driven planner assigns an **expert preset** (`agentId`) per node from `agents.*` in config. |
| **Approve** | Assignments are part of the graph the user signs off on (with Phase 18 approval flow). |
| **Override** | User can change expert, tools, or model/tier on the node card anytime before run; overrides are **protected** for replan (Phase 18). |

Auto-routing (`selectAgent` keyword hints, workflow tier dispatch) remains for CLI/workflow paths without a graph; **graph authoring defaults to planner-assigned experts**.

## Expert = preset bundle

Each expert preset in `rlm.config.yaml` bundles:

- `systemPrompt` / role (via `agent-registry` profile)
- `tools: [...]` allowlist (shared `ToolPort` implementations)
- `models: { depth, classify, decompose, answer, summarize, synthesize }` → tier names

**UI (preset + à la carte):**

- Primary control: **Expert** dropdown (`Research`, `Coding`, …).
- Changing **tools** or **purpose→tier** marks node **`assignmentMode: custom`** (badge); optional “based on &lt;expert&gt;” label.
- **Model override** on a single purpose or global override continues to use existing `modelOverride` patterns where applicable.

**Export (Phase 19):** graph sidecar stores `agentId`, `assignmentMode`, tool allowlist snapshot, tier map snapshot, `runtime: single | rlm`.

## Tool suite v1: allowlists only

- One implementation per tool name (`shell`, `write_file`, `web_search`, `web_fetch`, extensions/MCP).
- Experts differ by **which tools appear** in constrained calling for that node—not duplicate adapters per role.
- Defer **specialized tool surfaces** (`web_fetch_docs`, …) until a role fails constrained calling on small models; see seed `.planning/seeds/specialized-tool-surfaces.md`.

## Model strategy

- Each expert defines **per-purpose tier maps** (not all-`small` required globally; e.g. coding may use `medium` for `answer`).
- **RLM escalation at plan time:** planner sets `runtime: rlm` (or composer equivalent) on high-complexity nodes; visible on card before run.
- User can override: force single-pass or force RLM on any node.
- **No silent runtime escalation** in v1—classify-at-run suggesting RLM is out of scope unless added later with explicit UI.

RLM execution reuses `RecursiveLanguageModel` / expert’s tools and tier map under node budget; trace shows expert + runtime mode.

## Relation to existing code

| Piece | Use |
|-------|-----|
| `createAgentRegistry` | Expert presets, prompts, default tool sets |
| `PurposeRoutingLanguageModel` | Per-purpose tier resolution from `AgentConfig.models` |
| `constrainedToolCalling` | Enforce allowlist per node run |
| `composer.complexity` | Planner input for `runtime: rlm` |
| `plannedModel` / `modelOverride` | Extend with `agentId`, `assignmentMode`, `runtime` |

## Out of scope (expert-team v1)

- New per-role tool adapters (defer to seed trigger)
- UI for authoring new expert YAML presets (config edit OK for v1)
- Multi-host / HF catalog / temperature UI (separate milestone themes)
- Replacing hand-written `workflows.default` agent-list workflows

## Sequencing

1. **Phase 18** — planner emits nodes with expert + complexity + runtime.
2. **Phase 19** — export/import includes expert assignment fields.
3. **Phase 20** — node card expert/custom UI, execution binding, tests.
