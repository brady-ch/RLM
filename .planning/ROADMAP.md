# Roadmap: Recursive Language Model CLI

## Milestones

- 🚧 **v1.4 Session Memory** — Phases 25-29 (requirements defined; roadmap pending approval)
- ✅ **v1.3 Desktop Product** — Phases 21-24 (shipped 2026-05-21; archive: `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.2 Answer Quality Loops** — Phases 12-17 (shipped 2026-05-20; archive: `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.1 Interop, chat-first, plugins, constrained tools** — Phases 6-11, including inserted Phase 8.5 (shipped 2026-05-13; archive: `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-08; archive: `.planning/milestones/v1.0-ROADMAP.md`)

## Overview

v1.4 adds durable session memory. The milestone prioritizes "nothing gets lost": saved sessions must restore graph state, run metadata, artifacts, memory scopes, episodic history, preferences, and degraded states explicitly. Semantic/vector retrieval is included, but it builds on top of canonical structured memory rather than replacing it.

## Phases

**Phase Numbering:**
- Phase numbers continue from previous milestones.
- v1.4 uses phases 25-29.

<details>
<summary>✅ v1.3 Desktop Product (Phases 21-24) — SHIPPED 2026-05-21</summary>

See `.planning/milestones/v1.3-ROADMAP.md` and `.planning/milestones/v1.3-REQUIREMENTS.md`.

</details>

- [ ] **Phase 25: Session Snapshot Store** - Create durable session save/reopen foundation with restore verification and safe continuation boundaries.
- [ ] **Phase 26: Structured Memory Store and Resolver** - Persist structured memory scopes, episodic logs, ACL/audit records, and bounded context packets.
- [ ] **Phase 27: Memory Preferences and Inspection Surfaces** - Add project/user preference memory plus CLI, API, and UI inspection/edit controls.
- [ ] **Phase 28: Semantic Retrieval Pipeline** - Add local embeddings, async indexing, scoped retrieval, visible retrieval hits, and degraded index states.
- [ ] **Phase 29: End-to-End Memory Hardening** - Verify integrated save/reopen, memory injection, preferences, retrieval, packaging, and no-silent-loss behavior.

## Phase Details

### Phase 25: Session Snapshot Store
**Goal**: Create the durable session bundle foundation for saving, listing, reopening, and verifying interactive workflow sessions.
**Depends on**: v1.3
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SURF-01
**Success Criteria** (what must be TRUE):
  1. User can save a session containing prompt, graph, layout, viewport, statuses, approval mode, pending approvals, clarifications, run metadata, and run summary.
  2. User can list and reopen saved sessions from the CLI.
  3. Reopened sessions restore graph, approval/clarification state, artifact refs, execution status, and safe continuation metadata.
  4. Restore verification reports complete, degraded, or failed status with concrete missing/corrupt fields.
  5. Reopened sessions only continue from safe approval or clarification boundaries, not mid-model-call state.
**Plans**: 0 plans
**UI hint**: yes

### Phase 26: Structured Memory Store and Resolver
**Goal**: Add canonical structured memory and episodic continuity, then resolve bounded, provenance-rich context packets for node/model calls.
**Depends on**: Phase 25
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, MEM-05
**Success Criteria** (what must be TRUE):
  1. User can persist memory scopes with `session`, `project`, or `permanent` lifetimes.
  2. Runtime enforces node `contextPolicy.memoryScopes`, reads, writes, and limits when resolving memory.
  3. Unauthorized memory writes are rejected with audit records visible to callers.
  4. Runtime appends episodic entries for node events, summaries, artifact refs, memory writes, and degraded memory events.
  5. Context packets include bounded memory content with provenance and truncation/degraded metadata.
**Plans**: 0 plans
**UI hint**: yes

### Phase 27: Memory Preferences and Inspection Surfaces
**Goal**: Make memory visible and controllable through CLI/API/UI, including explicit preference sources and edit/delete workflows.
**Depends on**: Phase 26
**Requirements**: PREF-01, PREF-02, PREF-03, SURF-02, SURF-03, SURF-04
**Success Criteria** (what must be TRUE):
  1. User can save project-level preferences that affect future planning or execution behavior.
  2. User can explicitly opt into longer-lived user preferences and see when they are applied.
  3. User can inspect, edit, and delete saved preferences.
  4. UI/API responses expose memory scopes, episodic summaries, preference sources, restore status, and context packet provenance.
  5. CLI and UI show degraded states when memory restore or resolution fails.
**Plans**: 0 plans
**UI hint**: yes

### Phase 28: Semantic Retrieval Pipeline
**Goal**: Add local semantic retrieval over eligible memory entries while keeping structured memory as the canonical source of truth.
**Depends on**: Phase 27
**Requirements**: RETR-01, RETR-02, RETR-03, RETR-04, RETR-05
**Success Criteria** (what must be TRUE):
  1. Runtime can generate local embeddings for memory text through an embedding adapter, with Ollama as the first provider.
  2. Eligible episodic entries, structured memory text, and selected artifact excerpts are indexed asynchronously without blocking node completion.
  3. Retrieval only runs when node policy requests relevant memory entries, filtered by authorized scopes and bounded by context limits.
  4. UI/API/CLI inspection exposes retrieval source, scope, snippet, score, and degraded or index-stale status.
  5. Saved sessions preserve or rebuild vector index metadata without making retrieval required for restore correctness.
**Plans**: 0 plans
**UI hint**: yes

### Phase 29: End-to-End Memory Hardening
**Goal**: Prove v1.4 works as one product slice and that memory loss, partial restore, indexing failure, and preference drift are visible.
**Depends on**: Phase 28
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, PREF-01, PREF-02, PREF-03, SURF-01, SURF-02, SURF-03, SURF-04, RETR-01, RETR-02, RETR-03, RETR-04, RETR-05
**Success Criteria** (what must be TRUE):
  1. A full interactive run can save, close, reopen, inspect memory, and continue/rerun with restored graph and memory state.
  2. Restore verification catches intentionally missing or corrupt graph, memory, run-state, artifact, and index data.
  3. Retrieval/index failures degrade visibly while structured session restore still succeeds.
  4. Preference application is source-attributed and can be removed without stale effects.
  5. Automated tests cover the main CLI/API/UI memory paths and existing `npm test` passes.
**Plans**: 0 plans
**UI hint**: yes

## Candidate Future Themes

- Dynamic graph authoring: plan-from-node as the default graph creation path.
- Graph workflow export and replay: save approved graphs as playbook/pipeline workflow sidecars.
- Expert team and node assignment: visible expert presets, tool allowlists, and RLM/single-pass runtime choice per node.
- Multi-runner beyond bundled Ollama: llama.cpp, vLLM, or cloud adapters after v1.3 validates the desktop product path.
- Release hardening: signed/reproducible artifacts, Windows/macOS package builds, GUI clean-machine smoke, and auto-update channel.

## Progress

**Execution Order:**
Phases execute in numeric order: 25 -> 26 -> 27 -> 28 -> 29

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 25. Session Snapshot Store | v1.4 | 0/0 | Not Started | — |
| 26. Structured Memory Store and Resolver | v1.4 | 0/0 | Not Started | — |
| 27. Memory Preferences and Inspection Surfaces | v1.4 | 0/0 | Not Started | — |
| 28. Semantic Retrieval Pipeline | v1.4 | 0/0 | Not Started | — |
| 29. End-to-End Memory Hardening | v1.4 | 0/0 | Not Started | — |
| v1.3 Desktop Product | v1.3 | archived | Complete | 2026-05-21 |
| v1.2 Answer Quality Loops | v1.2 | archived | Complete | 2026-05-20 |
| v1.1 Interop, chat-first, plugins, constrained tools | v1.1 | archived | Complete | 2026-05-13 |
| v1.0 MVP | v1.0 | archived | Complete | 2026-05-08 |
