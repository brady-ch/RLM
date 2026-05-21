---
phase: 25
slug: session-snapshot-store
status: approved
shadcn_initialized: false
preset: none
created: 2026-05-21
---

# Phase 25 — UI Design Contract

> Visual and interaction contract for session save/reopen controls, restore status, and saved-session metadata.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | existing React components and local CSS |
| Icon library | lucide-react |
| Font | `"Aptos", "Segoe UI", sans-serif` |

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline metadata |
| sm | 8px | Compact control spacing |
| md | 16px | Inspector group spacing and panel padding |
| lg | 24px | Major inspector sections |
| xl | 32px | Wide content group spacing |
| 2xl | 48px | Not used in compact session controls |
| 3xl | 64px | Not used |

Exceptions: none

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 | 1.45 |
| Label | 12px | 700 | 1.3 |
| Heading | 22px | 700 | 1.25 |
| Metadata | 11px | 700 | 1.3 |

No viewport-based font scaling. Text in buttons, pills, and restore details must wrap or truncate intentionally without overlapping controls.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#eef2ef` | App background |
| Secondary (30%) | `#f8faf8`, `#fbfcfd` | Inspector surface and session panels |
| Accent (10%) | `#2d6cdf` | Focus ring, active restore status, primary save/reopen highlight |
| Success | `#3d8b57` | Complete restore status |
| Warning | `#c98526` | Degraded restore status and rebuild-needed state |
| Destructive | `#923b34` | Corrupt/failed restore state and destructive repair actions |

Accent reserved for: focused controls, currently selected saved session, active restore actions, links to inspect restore details.

---

## Layout Contract

- Keep the existing two-column shell: graph canvas left, inspector right.
- Add session controls to the inspector header or the first inspector section, not as a modal-first flow.
- Saved session list uses compact rows, not large cards. Each row must show name/id, updated time, restore status, and available action icons.
- Restore detail can use a collapsible panel in the inspector. It must show section-level status for graph, run-state, artifact refs, structured memory metadata, preferences metadata, and vector/index metadata.
- Do not put panels inside cards. Session metadata sections are flat inspector groups with borders only where needed for scanning.
- Mobile/narrow fallback may stack canvas and inspector, but session controls must remain reachable before node detail overflow.

---

## Interaction Contract

| Interaction | Contract |
|-------------|----------|
| Manual save | Icon+text button labeled `Save session`; disabled while a save is running. |
| Autosave | Quiet status row: `Autosaved <relative time>` or `Autosave degraded`; never use a blocking modal. |
| List sessions | `Open session` control opens a compact list of saved sessions with restore status. |
| Reopen session | Selecting a session shows metadata first; user confirms `Open` before replacing current graph state. |
| Partial restore | Show degraded banner/details and disable unsafe continue actions until user chooses repair/rerun/edit path. |
| Corrupt restore | Preserve corrupt files and show exact section failure. Do not auto-delete or overwrite. |

Use lucide icons where available: `Save`, `FolderOpen`, `RefreshCw`, `AlertTriangle`, `CheckCircle`, `Info`, `Trash2` for explicit delete/cleanup only.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `Save session` |
| Secondary CTA | `Open session` |
| Empty state heading | `No saved sessions` |
| Empty state body | `Save this workflow to reopen the graph, approvals, artifacts, and memory contract later.` |
| Complete restore | `Session restored` |
| Degraded restore | `Session restored with missing data` |
| Error state | `Session restore failed. Review the missing or corrupt sections before continuing.` |
| Unsafe continue block | `Continue is unavailable until this session is restored to a safe approval or clarification boundary.` |
| Destructive confirmation | `Delete saved session: this removes the saved snapshot bundle, not the current open graph.` |

Avoid vague memory copy. If structured memory or vector retrieval behavior is not implemented in Phase 25, label those sections as `Contract saved` or `Not indexed yet`, not `Ready`.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party | none | not required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-05-21
