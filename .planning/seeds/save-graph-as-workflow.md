---
title: Save Graph as Fixed Workflow
planted_date: 2026-05-19
trigger_condition: "When node-centric dynamic planning (plan-from-node submit UX) is shippable in UI and API"
status: active
---

## Intent

After a user iterates on a graph via **plan-from-node** (explore B), let them **freeze** the result as a **fixed workflow** they can rerun without regenerating the plan — the bridge to n8n-style reliability and to explore **A**.

## User story

1. User plans from empty root → approves graph.
2. User chooses **Save as workflow** (name + optional description).
3. System writes `workflows.<id>` in project config (or a `.rlm/workflows/<id>.yaml` sidecar) with:
   - Ordered agent/node steps mapped from graph topology
   - Per-step prompts (or prompt templates with slots)
   - Tool allowlists and model tier hints copied from composer metadata
4. User runs `rlm --workflow <id> "…"` or picks workflow in UI — **execution only**, no replan unless they opt into “edit plan.”

## Design constraints

- Round-trip: exported workflow should be **re-importable** into the graph editor for edits (explore B again).
- Do not silently change behavior of existing YAML workflows.
- Preserve **no silent failures** on missing agents/models at run time.

## Evaluation checks

- Can a saved workflow run headlessly (CLI) with the same node order as the approved graph?
- Does re-import produce a graph isomorphic to the saved plan (modulo layout)?
- Is the feature discoverable from the root node after first successful plan?

## Dependencies

- Requires stable node ids / composer metadata from dynamic planning phase.
- Related candidate themes: developer launcher, HF model installer (not blocking v1 export).
