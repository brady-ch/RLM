# Phase 27 Summary: Memory Preferences and Inspection Surfaces

**Status:** Complete  
**Completed:** 2026-05-21

## Delivered

- Added cross-run `project` and `permanent` memory scope storage while preserving run-local `session` scopes.
- Added memory inspection APIs for scopes, episodic entries, packet metadata, and audit records.
- Added audited project preference set/delete behavior using the structured memory store.
- Added CLI flags:
  - `--memory-inspect <run>`
  - `--preference-set <key=value>`
  - `--preference-delete <key>`
- Added control-server endpoints:
  - `GET /api/memory`
  - `POST /api/memory/preferences`
  - `DELETE /api/memory/preferences/:key`
- Added a UI Memory panel with project preference editing, scope chips, recent episodic summaries, degraded packet count, and rejected audit count.
- Updated default runtime memory policy so project preferences are included in model context packets.

## Requirement Coverage

- PREF-01: Project-level preferences persist as `project-preferences`.
- PREF-02: Longer-lived `permanent` scope storage is supported by the store and API lifetime input.
- PREF-03: Preferences can be inspected, edited, and deleted with audit records.
- SURF-02: UI can inspect memory and edit preferences.
- SURF-03: UI/API expose scopes, episodic summaries, restore-adjacent memory state, and packet provenance metadata.
- SURF-04: Degraded/truncated packet and rejected audit states are visible in API/UI inspection.

## Deferred

- Semantic retrieval hit inspection remains in Phase 28.
- End-to-end corrupt memory restore drills remain in Phase 29.
