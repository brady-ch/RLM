---
title: Save Graph as Fixed Workflow
planted_date: 2026-05-19
updated_date: 2026-05-19
trigger_condition: "When node-centric dynamic planning (Phase 18 / PLAN-01..07) is shippable in UI and API"
status: archived
archived_date: 2026-05-24
shipped_in: "Phase 34 (v1.6 Graph Workflow Export/Import)"
---

## Intent

Freeze an approved execution graph as **replayable workflows** without replanning — bridge from dynamic plan-from-node (B) to n8n-style fixed pipelines (A).

## Decisions (explore A, 2026-05-19)

- **Format:** `kind: graph` snapshot (not lossy agent-list export). See `.planning/notes/graph-workflow-export.md`.
- **Two products:** **Playbook** (literal prompts) and **Pipeline** (template, usually `{{input}}` at root).
- **Save UX:** One dialog — name + Save as Playbook / Pipeline / **Both** (default **Both**).
- **Run UX:** Smart default — pipeline when new input provided, playbook when replaying without input; `--variant` override.
- **Storage:** Prefer `.rlm/workflows/<id>.yaml` sidecar; optional pointer in `rlm.config.yaml`.

## User story

1. User plans graph via plan-from-node → approves.
2. **Save as workflow** → dialog → writes playbook and/or pipeline variant(s).
3. User runs `rlm --workflow <id> "new task"` or UI Run → graph executor, no replan.
4. **Import** reloads graph into editor for edits; re-export as needed.

## Design constraints

- Round-trip import/export must preserve topology and per-node prompts (modulo layout).
- Do not mutate or replace existing hand-written `workflows.*` agent-list entries.
- No silent failures for missing agents/models; show variant used at run start.
- Phase 19 implements export; depends on Phase 18.

## Evaluation checks

- Saved playbook rerun produces the same node prompts without substitution.
- Saved pipeline substitutes `{{input}}` when CLI/UI provides a new task string.
- Both variants can exist for one id; smart default picks the right one without user friction.
- Import → edit → export round-trip is graph-isomorphic (ignoring positions).

## Supersedes

Earlier seed text that suggested mapping graph → `workflows.<id>` agent arrays only. Agent-list workflows remain separate.
