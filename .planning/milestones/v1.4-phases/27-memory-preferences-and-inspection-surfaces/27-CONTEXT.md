# Phase 27 Context: Memory Preferences and Inspection Surfaces

## Goal

Make structured memory visible and controllable through CLI/API/UI, with project/user preferences implemented as audited structured memory rather than a separate hidden store.

## Decisions

- Preferences are stored in a `project-preferences` structured memory scope by default.
- Preference set/delete operations use the Phase 26 memory patch/audit path so stale or unauthorized changes are visible.
- Project and permanent lifetime scopes must be readable across runs; session scopes remain run-local.
- Inspection surfaces expose scope documents, episodic summaries, packet metadata, and audit records. Full prompt dumps remain excluded.
- Semantic/vector retrieval remains deferred to Phase 28.

## Acceptance Focus

- User can save, inspect, edit, and delete preferences.
- Runtime memory packets can include saved project preferences for future runs.
- API/CLI/UI expose memory scopes, summaries, audit records, packet provenance, and degraded state.
