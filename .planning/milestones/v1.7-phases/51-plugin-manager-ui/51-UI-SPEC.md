---
phase: 51
slug: plugin-manager-ui
status: approved
shadcn_initialized: false
preset: none
created: "2026-05-22"
---

# Phase 51 — UI Design Contract

> Plugin manager panel aligned with CLI `rlm plugin` vocabulary, trust confirm for remote install, and restart banner after mutations.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled CSS) |
| Component library | React 19 + plain CSS in `ui/src/styles.css` |
| Icon library | `lucide-react` (`Puzzle`, `RefreshCw`, `Download`, `AlertTriangle`, `Check`, `X`) |
| Font | `"Aptos", "Segoe UI", sans-serif` |

Match existing inspector rail panels (`model-library-panel`, `memory-panel`).

---

## Copywriting Contract

Mirror CLI strings from `src/cli/run-modes/plugin-commands.ts`:

| Element | Copy |
|---------|------|
| Panel title | **Plugins** |
| Plugin row summary | `{id} [{category}] source={source} enabled={enabled} tools={tools}` |
| Empty list | **No plugins found.** |
| Install field placeholder | **Local path or remote URL** |
| Install button | **Install** |
| Remote confirm title | **Remote plugin ready to install** |
| Remote confirm body | `{id}@{version}` · **Source:** `{source}` · **Category:** `{category}` |
| Remote confirm approve | **Install (--yes)** |
| Remote confirm cancel | **Cancel** |
| Doctor clean | **Plugin doctor: no issues found.** |
| Doctor issue | **ERROR** / **WARN** `{code}: {message}` |
| Doctor fix button | **Doctor --fix** |
| Doctor run button | **Run doctor** |
| Restart banner | **Restart RLM** to load plugin changes. Tools are not updated until the session restarts. |
| Enable / Disable / Uninstall | **Enable** · **Disable** · **Uninstall** |
| Capabilities label | **tools** · **skillLoaders** · **modelHosts** when non-empty |

---

## Layout

- Panel lives in inspector rail below **Model Library**, above node inspector.
- Max height ~46vh with scroll, same as model library panel.
- Install row: text input + primary **Install** button.
- Doctor block: meta row status + **Run doctor** / **Doctor --fix** actions.
- Plugin rows: summary line, capability tags, action buttons (hidden for `source=builtin` except list).

---

## Interaction

- **Refresh** loads `GET /api/plugins` and `GET /api/plugins/doctor`.
- **Install** posts `POST /api/plugins/install`; if `needsConfirm`, show modal; confirm posts `{ confirm: true }`.
- **Enable/Disable/Uninstall** post respective endpoints; on `requiresRestart: true`, show persistent restart banner.
- Built-in plugins: no enable/disable/uninstall controls.
- Errors use existing `.error` banner via `runAction`.

---

## API Surface (UI-01)

Consume existing control-server routes (Phase 49–50):

- `GET /api/plugins`
- `GET /api/plugins/doctor`
- `POST /api/plugins/doctor/fix`
- `POST /api/plugins/install`
- `POST /api/plugins/enable|disable|uninstall`
