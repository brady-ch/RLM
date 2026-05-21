# Research: Feature Patterns for v1.4 Session Memory

**Milestone:** v1.4 Session Memory  
**Date:** 2026-05-21

## Table Stakes

### Session Save and Reopen

Users need a saved session bundle that restores:

- root prompt and run metadata
- execution graph nodes, edges, positions, viewport, statuses, approvals, and pending clarification state
- artifact refs and validation metadata
- run-state mutation log
- structured memory scopes
- episodic execution log
- vector index metadata or degraded retrieval status

Reopen semantics should be explicit: restore a document snapshot, review/edit it, then rerun or continue from the last safe approval gate. Do not promise mid-model-call resume.

### Structured Memory Scopes

Nodes already carry `contextPolicy.memoryScopes`. v1.4 should make that metadata real:

- declared readable/writable scopes
- scope lifetime: `session`, `project`, `permanent`
- scope version/etag for optimistic concurrency
- rejected unauthorized writes with audit records
- bounded context packets assembled per node/sub-call

### Episodic Log

Append short run events:

- node id, timestamp, status, summary
- artifact refs
- memory scope writes
- retrieval/index degraded events

This is the durable answer to “what happened?” and feeds rolling summaries.

### Preferences

Persist preferences separately from transient run memory:

- project-level planning/execution preferences
- user-level defaults only when explicitly selected
- visible source when a preference affects a node or plan
- edit/delete controls to prevent stale preferences from silently steering future runs

### UI and CLI Inspection

Users should be able to see:

- saved sessions
- restore status
- memory scopes and lifetimes
- node context packets or summaries of what was injected
- retrieval hits with score/source
- degraded states when restore, indexing, or retrieval fails

## Differentiators

- Memory injection is policy-bound and inspectable.
- Save/reopen includes the graph authoring surface, not only backend run JSON.
- Retrieval is a visible enhancement, not a hidden dependency for correctness.
- Preference memory is editable and source-attributed.

## Anti-Features

- Silent fallback to empty memory.
- Unbounded full-session prompt injection.
- Embedding full artifact files by default.
- Cross-project permanent memory without explicit opt-in.
- Treating vector search as the canonical store.
