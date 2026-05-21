# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-21  
**Milestone:** v1.4 Session Memory  
**Core Value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## v1.4 Requirements

### Session Durability

- [ ] **SESS-01**: User can save an interactive workflow session with root prompt, graph nodes, edges, layout, viewport, statuses, approval mode, pending approvals, clarification history, run metadata, and run summary.
- [ ] **SESS-02**: User can reopen a saved session and see the same graph, approval/clarification state, artifact references, and execution status that were saved.
- [ ] **SESS-03**: User can rerun or continue from the last safe approval or clarification boundary after reopening a saved session.
- [ ] **SESS-04**: User sees explicit restore verification results, including degraded or failed restore states when expected graph, run-state, artifact, or memory data is missing.

### Structured Memory

- [ ] **MEM-01**: User can persist structured memory scopes with `session`, `project`, or `permanent` lifetimes.
- [ ] **MEM-02**: Runtime enforces node `contextPolicy.memoryScopes`, reads, writes, and packet limits when resolving memory for model calls.
- [ ] **MEM-03**: Runtime rejects unauthorized memory writes with visible audit records instead of silently ignoring or applying them.
- [ ] **MEM-04**: Runtime maintains an append-only episodic log of node events, summaries, artifact refs, memory writes, and degraded memory/indexing events.
- [ ] **MEM-05**: Runtime assembles bounded context packets with provenance so users can inspect what memory was injected into a node or recursive sub-call.

### Preferences

- [ ] **PREF-01**: User can save project-level preferences that influence future planning or execution behavior.
- [ ] **PREF-02**: User can explicitly opt into longer-lived user preferences and see when they are applied.
- [ ] **PREF-03**: User can inspect, edit, or delete saved preferences so stale preference memory does not silently steer future runs.

### UI and CLI Surfaces

- [ ] **SURF-01**: User can list, save, reopen, and inspect sessions from the CLI.
- [ ] **SURF-02**: User can save, reopen, and inspect memory state from the UI.
- [ ] **SURF-03**: User can inspect memory scopes, episodic summaries, preference sources, restore status, and context packet provenance in UI/API responses.
- [ ] **SURF-04**: User sees explicit degraded states in CLI and UI when memory restore, memory resolution, indexing, or retrieval fails.

### Semantic Retrieval

- [ ] **RETR-01**: Runtime can generate local embeddings for memory text through an embedding adapter, with Ollama as the first provider.
- [ ] **RETR-02**: Runtime indexes eligible episodic entries, structured memory text, and selected artifact excerpts asynchronously without blocking node completion.
- [ ] **RETR-03**: Runtime retrieves relevant prior memory entries only when node policy requests them, filtered by authorized memory scopes and bounded by context limits.
- [ ] **RETR-04**: User can inspect retrieval hits with source, scope, snippet, score, and degraded/index-stale status.
- [ ] **RETR-05**: Saved sessions preserve or rebuild vector index metadata without making vector retrieval the canonical source of memory.

## Future Requirements

### Advanced Memory

- **MEMF-01**: User can sync memory across machines or projects through an explicit remote backend.
- **MEMF-02**: Runtime can resume in-flight model calls or half-finished recursive trees after process restart.
- **MEMF-03**: User can run hybrid lexical/vector/reranked retrieval across large artifact corpora.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud-hosted memory or vector database | Conflicts with current local-first product path and adds operational risk. |
| Silent memory fallback | Conflicts with the milestone priority that nothing gets lost silently. |
| Full artifact byte storage inside memory snapshots | Risks snapshot bloat; memory should store refs, summaries, hashes, and selected chunks. |
| Mid-model-call resume | Saved sessions are document snapshots, not frozen process continuations. |
| Cross-project permanent memory by default | Permanent memory must be explicit to avoid stale or surprising context leakage. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESS-01 | TBD | Pending |
| SESS-02 | TBD | Pending |
| SESS-03 | TBD | Pending |
| SESS-04 | TBD | Pending |
| MEM-01 | TBD | Pending |
| MEM-02 | TBD | Pending |
| MEM-03 | TBD | Pending |
| MEM-04 | TBD | Pending |
| MEM-05 | TBD | Pending |
| PREF-01 | TBD | Pending |
| PREF-02 | TBD | Pending |
| PREF-03 | TBD | Pending |
| SURF-01 | TBD | Pending |
| SURF-02 | TBD | Pending |
| SURF-03 | TBD | Pending |
| SURF-04 | TBD | Pending |
| RETR-01 | TBD | Pending |
| RETR-02 | TBD | Pending |
| RETR-03 | TBD | Pending |
| RETR-04 | TBD | Pending |
| RETR-05 | TBD | Pending |

**Coverage:**
- v1.4 requirements: 21 total
- Mapped to phases: 0
- Unmapped: 21

---
*Requirements defined: 2026-05-21*
*Last updated: 2026-05-21 after v1.4 requirements definition*
