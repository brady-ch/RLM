# Roadmap: Recursive Language Model CLI

## Milestones

- 🚧 **v1.3 Desktop Product** — Phases 21-23 (in progress)
- ✅ **v1.2 Answer Quality Loops** — Phases 12-17 (shipped 2026-05-20; archive: `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.1 Interop, chat-first, plugins, constrained tools** — Phases 6-11, including inserted Phase 8.5 (shipped 2026-05-13; archive: `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-08; archive: `.planning/milestones/v1.0-ROADMAP.md`)

## Overview

v1.3 turns RLM into an installable desktop product. The milestone starts by formalizing runner adapters and sampling resolution, then adds an in-app model library with curated and Hugging Face-backed model installation, and finishes with a Tauri shell, cross-platform installers, and managed Ollama lifecycle.

## Phases

**Phase Numbering:**
- Phase numbers continue from previous milestones.
- v1.3 uses phases 21-23.

<details>
<summary>✅ v1.2 Answer Quality Loops (Phases 12-17) — SHIPPED 2026-05-20</summary>

See `.planning/milestones/v1.2-ROADMAP.md` and `.planning/milestones/v1.2-REQUIREMENTS.md`.

</details>

<details>
<summary>✅ v1.1 Interop, chat-first, plugins, constrained tools (Phases 6-11) — SHIPPED 2026-05-13</summary>

See `.planning/milestones/v1.1-ROADMAP.md` and `.planning/milestones/v1.1-phases/`.

</details>

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-05-08</summary>

See `.planning/milestones/v1.0-ROADMAP.md` and `.planning/milestones/v1.0-phases/`.

</details>

- [x] **Phase 21: Runner Registry and Sampling Cascade** - Formalize runners as adapters and implement global, model, and node sampling merge before product UI work.
- [x] **Phase 22: Model Library** - Build curated and Hugging Face-backed model installation, progress, compatibility, and installed-model selection.
- [ ] **Phase 23: Tauri Shell and Cross-Platform Installers** - Ship an installable desktop app that launches the UI, manages the control server and Ollama lifecycle, and passes first-run smoke.

## Phase Details

### Phase 21: Runner Registry and Sampling Cascade
**Goal**: Formalize runners as adapters and implement global -> model -> node sampling merge before product UI work.
**Depends on**: v1.2
**Requirements**: PROD-04, PROD-08, PROD-09, PROD-10, PROD-11, PROD-12
**Success Criteria** (what must be TRUE):
  1. CLI/YAML model host configuration still works after runner registry refactor.
  2. Global sampling defaults can be stored and resolved into completion calls.
  3. Per-model profiles override global sampling defaults, and per-node overrides override both.
  4. Execution trace or node metadata exposes effective sampling values and their source layer.
  5. Unsupported parameters and runner unavailability surface explicit, test-visible states.
**Plans**: 1 plan
**UI hint**: yes

Plans:
- [x] 21-01-PLAN.md — Implement runner registry and sampling cascade across config, model provider, adapters, node metadata, UI, and tests.

### Phase 22: Model Library
**Goal**: Build an in-app model catalog with curated recommendations, Hugging Face search, download progress, and installed-model library state tied to Ollama pull/import.
**Depends on**: Phase 21
**Requirements**: PROD-05, PROD-06, PROD-07
**Success Criteria** (what must be TRUE):
  1. User can browse a curated model catalog with tags, RAM hints, and underlying Ollama model ids.
  2. User can download a curated model with visible progress and a final Ready or Failed state.
  3. User can search Hugging Face and see only v1-compatible actions, with explicit unsupported or warning states where needed.
  4. Installed models appear in the local library and are selectable for tiers and node overrides.
  5. Download, runner, network, and disk failures surface actionable UI/API errors.
**Plans**: 1 plan
**UI hint**: yes

Plans:
- [x] 22-01-PLAN.md — Implement model library service, control API, UI panel, and tests.

### Phase 23: Tauri Shell and Cross-Platform Installers
**Goal**: Ship installable Windows, macOS, and Linux app builds that launch a Tauri webview, manage RLM child processes, ensure Ollama availability, and pass first-run smoke on clean machines.
**Depends on**: Phase 22
**Requirements**: PROD-01, PROD-02, PROD-03
**Success Criteria** (what must be TRUE):
  1. App launches without requiring the user to install Node/npm or manually start the control server.
  2. App starts or detects a compatible Ollama endpoint on first launch.
  3. App quit stops RLM-managed child processes cleanly and does not kill a separately managed user Ollama.
  4. Per-OS installer or packaged build artifacts exist for Windows, macOS, and Linux.
  5. Clean-machine smoke path works: launch app, see model library, install a curated model, and run a workflow without terminal setup.
**Plans**: TBD
**UI hint**: yes

## Candidate Future Themes

- Dynamic graph authoring: plan-from-node as the default graph creation path.
- Graph workflow export and replay: save approved graphs as playbook/pipeline workflow sidecars.
- Expert team and node assignment: visible expert presets, tool allowlists, and RLM/single-pass runtime choice per node.
- Session memory: scoped memory store, episodic log, save/reopen, and later vector retrieval.
- Multi-runner beyond bundled Ollama: llama.cpp, vLLM, or cloud adapters after v1.3 validates the desktop product path.

## Progress

**Execution Order:**
Phases execute in numeric order: 21 -> 22 -> 23

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 21. Runner Registry and Sampling Cascade | v1.3 | 1/1 | Complete | 2026-05-20 |
| 22. Model Library | v1.3 | 1/1 | Complete | 2026-05-20 |
| 23. Tauri Shell and Cross-Platform Installers | v1.3 | 0/TBD | Not Started | - |
| v1.2 Answer Quality Loops | v1.2 | archived | Complete | 2026-05-20 |
| v1.1 Interop, chat-first, plugins, constrained tools | v1.1 | archived | Complete | 2026-05-13 |
| v1.0 MVP | v1.0 | archived | Complete | 2026-05-08 |
