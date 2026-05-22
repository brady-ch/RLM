---
phase: 34
slug: graph-workflow-export-import
status: draft
shadcn_initialized: false
preset: none
created: "2026-05-22"
---

# Phase 34 — UI Design Contract

> Save/import graph workflow sidecars: dialog for Playbook/Pipeline/Both, import picker, variant display at run start.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled CSS) |
| Component library | React 19 + `@xyflow/react` + plain CSS |
| Icon library | `lucide-react` (`Download`, `Upload`, `FolderOpen`) |
| Font | `"Aptos", "Segoe UI", sans-serif` |

Match Phase 33 spacing, typography, and color tokens unchanged.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Save workflow button | **Save as workflow** |
| Save dialog title | **Save graph workflow** |
| Save dialog name field | **Workflow name** |
| Save dialog description | **Description** (optional) |
| Variant radio group | **Save as:** **Playbook** · **Pipeline** · **Both** |
| Playbook help | **Replay with literal prompts — no substitution.** |
| Pipeline help | **Root prompt uses `{{input}}` for new tasks each run.** |
| Import button | **Import workflow** |
| Import picker label | **Graph workflows** |
| Run variant banner | **Running {variant}** — e.g. **Running playbook** / **Running pipeline** |
| Export success | **Workflow saved:** {id} |
| Import success | **Workflow imported:** {id} — **Edit and re-export from the graph editor.** |
| Missing agent error | **Workflow run failed:** unknown expert **'{agentId}'** on node **'{nodeId}'**. |
| Missing template error | **Workflow run failed:** pipeline variant requires **`{{input}}`** in root prompt. |
| Invalid sidecar | **Import failed:** invalid graph workflow file. **{details}** |

---

## Layout

- Save/import controls live in the inspector rail **Workflow** section below saved sessions (or adjacent panel group).
- Save dialog: modal overlay matching existing mutation/confirm patterns (centered card, primary/destructive button styles).
- Variant selection: vertical radio list with help text under each option; default **Both** when root has substitutable prompt.

---

## Interaction

- **Save as workflow** opens dialog; disabled when graph has zero nodes.
- **Import workflow** lists `.rlm/workflows/*.yaml` entries; selecting one replaces current session graph (confirm if unsaved changes — use simple confirm dialog).
- On **Run workflow** for imported/frozen graphs, show variant badge in run header before execution starts.
- Errors use existing `.error` banner + `MutationError` pattern.
