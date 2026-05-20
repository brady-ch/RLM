# Graph Workflow Export (Explore A)

**Date:** 2026-05-19  
**Context:** `$gsd-explore fixed pipeline export` — freeze approved graphs as replayable workflows (playbook + pipeline).  
**Depends on:** `.planning/notes/node-centric-dynamic-planning.md` (Phase 18 plan-from-node).

## Product intent

After iterating on a graph in the UI, the user **freezes** it for repeat runs without replanning. This is the bridge from **dynamic authoring (B)** to **n8n-like reliability (A)** while preserving round-trip edit in the graph editor.

**Not in scope:** Converting saved graphs into today’s lossy `workflows.<id>` agent-list shape (`agents: [research, coding, …]` + single user prompt). Hand-written agent workflows remain for simple, config-only cases.

## Export format: graph snapshot

Serialize the execution graph (nodes, edges, per-node prompts, composer type, model overrides, tool/agent refs, layout optional) as `kind: graph`.

**Suggested location:** `.rlm/workflows/<id>.yaml` (sidecar), with an optional pointer in `rlm.config.yaml`:

```yaml
workflows:
  feature-delivery:
    kind: graph
    path: .rlm/workflows/feature-delivery.yaml
```

### Variants (two products, one topology)

| Variant | Prompt behavior | When to use |
|---------|-----------------|-------------|
| **Playbook** | All node prompts stored **literally** | Repeat the same procedure verbatim (audit checklist, demo, debug replay) |
| **Pipeline** | Template slot(s), typically root `{{input}}`; child prompts fixed as role instructions | Same graph shape, new top-level task each run |

Both variants share the **same node topology**; they differ in prompt text (and metadata marking template nodes).

Implementation options (plan-phase choice):

- Single file with `variants.playbook` / `variants.pipeline` graph copies, or
- Two files: `<id>.playbook.yaml` / `<id>.pipeline.yaml` sharing `graphId`

## Save UX

**One dialog (decision A):**

- Workflow **name** (+ optional description)
- **Save as:** Playbook · Pipeline · **Both**
- Default **Both** when the graph has a clear root task suitable for templating

Export source: approved or planned graph snapshot from `InteractiveExecutionSession` (stable node ids, composer metadata, positions best-effort).

## Run UX

**Smart default (decision 2):**

| User provides | Variant |
|---------------|---------|
| New task text (CLI arg, UI run input, substitutes `{{input}}`) | **Pipeline** |
| No new prompt / explicit “Replay playbook” | **Playbook** |
| Any | Override `--variant playbook\|pipeline` or UI toggle |

Surface the selected variant in CLI/UI run status (no silent mode switch).

**Execution:** New `runGraphWorkflow` path (or `runWorkflow` when `kind: graph`) — topological execution of frozen graph, **no replan** unless user opts into edit-plan / re-import.

**CLI examples:**

```bash
rlm --workflow feature-delivery "add rate limiting to /api/v1"
rlm --workflow feature-delivery --variant playbook
rlm --workflow feature-delivery   # replay playbook when no prompt arg
```

## Import / round-trip

- **Import** loads sidecar into `InteractiveExecutionSession` for editing (explore B).
- Re-export after edits; version or `updatedAt` in file metadata for future diff (optional v1).

## Relation to existing runtime

| Surface | Role |
|---------|------|
| `workflows.default` (agent list + tier dispatch) | Unchanged; config-authored, prompt-only |
| Graph export | New; preserves per-node prompts and topology |
| `runWorkflow` | Continues for `kind` absent or agent-list; graph kind delegates to graph runner |
| UI graph session | Source of truth for export; target for import |

## Out of scope (v1 export)

- Scheduling, webhooks, credentials (n8n parity later)
- Automatic linearization to agent-list workflows
- HF install / multi-host catalog

## Open follow-ups

- Per-node `literal | template` flags (beyond root) for hybrid graphs
- CI discovery of `.rlm/workflows/*.yaml`
- Explore **C:** per-node agent + constrained tool binding on export
