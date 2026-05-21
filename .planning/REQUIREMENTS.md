# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-20  
**Milestone:** v1.3 - Desktop Product  
**Sources:** `$gsd-explore` desktop product vision; `.planning/notes/desktop-product-vision.md`  
**Core Value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## v1.3 Requirements

### Desktop Shell and Installers

- [x] **PROD-01**: Windows, macOS, and Linux installers ship a launchable desktop app without requiring Node/npm or manual runner setup.
- [x] **PROD-02**: Tauri shell opens the graph UI in an embedded webview; app quit stops RLM-managed child processes cleanly.
- [x] **PROD-03**: Installer bundles Ollama or detects a compatible existing install; app ensures a listening Ollama endpoint on first launch.

### Runner Registry and Sampling

- [x] **PROD-04**: Runner integration uses an adapter pattern through `LanguageModelPort`; Ollama is one adapter, not hard-coded in domain or UI layers.
- [x] **PROD-08**: Global sampling defaults, including temperature, top-p, and related supported parameters, are editable in app settings.
- [x] **PROD-09**: Each installed model may store a profile that overrides global sampling defaults.
- [x] **PROD-10**: Node inspector supports per-node sampling overrides that take precedence over model profile and global defaults.
- [x] **PROD-11**: Execution trace or node metadata shows effective sampling values and which cascade layer supplied each value.
- [x] **PROD-12**: Runner unavailability, download failure, and insufficient-RAM conditions surface explicit UI errors with no silent fallback to a different model or runner.

### Model Library

- [x] **PROD-05**: Model library UI shows a curated catalog with use-case tags, RAM hints, and one-click download with progress and Ready state.
- [x] **PROD-06**: Model library supports Hugging Face search; results are filtered to v1-compatible models with explicit unsupported or warning states before download.
- [x] **PROD-07**: User can install multiple models into a local library; installed models are selectable for tiers and node overrides without re-download per session.

## Future Requirements

### Dynamic Graph Authoring

- **PLAN-01**: UI loads with a seeded empty `root-composer` node focused for input; user can submit a non-empty prompt without a separate global chat step.
- **PLAN-02**: Submitting on any editable node invokes model-driven planning that creates or refreshes child nodes from that node's prompt.
- **PLAN-03**: Submitting on a child node plans only that node's subtree, inheriting ancestor prompt context and the existing plan budget root semantics.
- **PLAN-04**: Resubmitting a parent replans descendant planned structure; pristine descendants replan without a dialog.
- **PLAN-05**: Protected descendants trigger Replace subtree, Merge, or Cancel before parent replan applies.
- **PLAN-06**: Merge preserves protected nodes and regenerates or adjusts only non-protected planned descendants.
- **PLAN-07**: Planning failures and budget exhaustion surface explicit UI/CLI states.

### Graph Workflow Export

- **EXPORT-01**: User can save an approved graph as a `kind: graph` workflow sidecar without lossy conversion.
- **EXPORT-02**: Save dialog offers Playbook, Pipeline, or Both.
- **EXPORT-03**: Playbook stores literal node prompts; Pipeline stores template prompts with `{{input}}` at least at root.
- **EXPORT-04**: User can import a saved graph workflow for edit and re-export.
- **EXPORT-05**: Saved graph workflows run through a graph executor without replan unless edited.
- **EXPORT-06**: CLI and UI support explicit `--variant playbook|pipeline` override and display which variant ran.
- **EXPORT-07**: Missing agents, models, or template variables fail explicitly at run start.

### Expert Team

- **TEAM-01**: Planner assigns an expert preset per graph node at plan time.
- **TEAM-02**: Node inspector shows Expert preset and custom status.
- **TEAM-03**: User can override expert preset, tool allowlist, purpose-to-tier map, or single-purpose model.
- **TEAM-04**: Expert presets use shared tool implementations with allowlists.
- **TEAM-05**: Expert presets define purpose-to-tier maps in config.
- **TEAM-06**: Planner sets `runtime: rlm` on high-complexity nodes at plan time.
- **TEAM-07**: Node execution binds expert tools, tiers, and runtime mode with explicit trace/UI metadata.
- **TEAM-08**: Graph workflow export includes expert assignment, custom overrides, and runtime mode.

### Session Memory

- **MEM-01**: `MemoryStorePort` provides session-scoped structured documents keyed by scope id with optimistic versioning on patch.
- **MEM-02**: Node `contextPolicy` enforces ACL on memory access.
- **MEM-03**: Episodic log appends node/run events with summaries and artifact refs.
- **MEM-04**: `MemoryResolver` builds bounded context packets before model completion.
- **MEM-05**: User sets per-scope lifetime: `session`, `project`, or `permanent`.
- **MEM-06**: User can save a session snapshot and reopen as an editable workspace.
- **MEM-07**: Reopened sessions support re-run or continue from last approval gate.
- **MEM-08**: Memory stores artifact references and summaries rather than inlined full payloads by default.
- **MEM-09**: Execution trace or UI shows memory scopes that contributed to a node's context packet.
- **MEM-10**: Vector index supports async indexing and scope-filtered top-k retrieval when policy requests relevant memory entries.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bundled llama.cpp or vLLM | v1.3 keeps Ollama as the sole managed runner to constrain installer size and lifecycle complexity. |
| Direct GGUF runner management | Captured by `.planning/seeds/multi-runner-adapters.md` for after the Ollama-backed desktop product ships. |
| Mac App Store or Microsoft Store distribution | Installer packaging is enough for this milestone; store distribution adds policy and signing overhead. |
| Auto-update channel | Useful later, but not required to prove install, launch, model download, and local execution. |
| Dynamic graph authoring, export, expert team, and session memory | Explored and retained as future tracks, but not part of v1.3 Desktop Product. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROD-04 | Phase 21 | Complete |
| PROD-08 | Phase 21 | Complete |
| PROD-09 | Phase 21 | Complete |
| PROD-10 | Phase 21 | Complete |
| PROD-11 | Phase 21 | Complete |
| PROD-12 | Phase 21 | Complete |
| PROD-05 | Phase 22 | Complete |
| PROD-06 | Phase 22 | Complete |
| PROD-07 | Phase 22 | Complete |
| PROD-01 | Phase 24 | Complete |
| PROD-02 | Phase 24 | Complete |
| PROD-03 | Phase 24 | Complete |

**Coverage:**
- v1.3 requirements: 12 total
- Complete: 12
- Partial: 0
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-05-20*
*Last updated: 2026-05-21 after Phase 24 verification*
