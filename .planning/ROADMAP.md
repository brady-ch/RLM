# Roadmap: Recursive Language Model CLI

## Milestones

- 🚧 **v1.17 Rust Infrastructure Layer** — Phases 97–112 (in progress)
- ✅ **v1.16 Rust Application Memory & Config** — Phases 92–96 (shipped 2026-05-24)
- ✅ **v1.15 Rust Application Layer Architecture** — Phase 91 (shipped 2026-05-24)
- ✅ **v1.14 Rust Architecture & Test Layout** — Phase 90 (shipped 2026-05-23)
- ✅ **v1.13 Runtime Safety & WSL Hardening** — Phases 86-89 (shipped 2026-05-24)

## Overview

**Current milestone:** v1.17 Rust Infrastructure Layer — persistence → adapters → plugins; readability + boundary ratchet to zero baseline entries.

**Milestone Goal:** Extract inline tests to mirrored `tests/{persistence,adapters,plugins}/` trees, split oversized infrastructure modules, eliminate all transitional boundary baseline entries.

## Phases

### v1.17 Rust Infrastructure Layer (Phases 97–112)

**Persistence block**
- [ ] **Phase 97: Persistence Config Facade** — Move config loaders behind facade/port; drop `no-persistence-to-application` baseline — in progress
- [ ] **Phase 98: Persistence Util Test Extraction**
- [ ] **Phase 99: File Vector Index Test Extraction**
- [ ] **Phase 100: ANN Vector Index Architecture & Test Extraction**
- [ ] **Phase 101: Run State Store Architecture & Test Extraction**
- [ ] **Phase 102: Session Store Architecture & Test Extraction**
- [ ] **Phase 103: Memory Store Architecture & Test Extraction**

**Adapters block**
- [ ] **Phase 104: Ollama Embedding Test Extraction**
- [ ] **Phase 105: Ollama Language Model Architecture & Test Extraction**

**Plugins block**
- [ ] **Phase 106: Tool Result Type Ports Consolidation** — Move tool result to `ports/`; drop 4× `no-plugins-to-domain`
- [ ] **Phase 107: Plugin Runtime & Registry Boundary Cleanup**
- [ ] **Phase 108: Plugin Manifest Test Extraction**
- [ ] **Phase 109: Plugin Remote Fetch Test Extraction**
- [ ] **Phase 110: Builtin Write File Test Extraction**
- [ ] **Phase 111: Builtin Shell Test Extraction**
- [ ] **Phase 112: Builtin Web Tools Test Extraction** — `web_fetch` + `web_search`

**Reference:** `.planning/notes/rust-infrastructure-layer-decomposition.md`

## Phase Details

### Phase 97: Persistence Config Facade

**Goal:** Move config loaders behind persistence facade/port; drop `no-persistence-to-application` baseline entry
**Plans:** 2 plans in 2 waves
**Success Criteria:**
1. `persistence/config.rs` no longer re-exports `application::config` loaders directly
2. Config resolution reachable through persistence facade or port at composition root
3. `no-persistence-to-application` removed from `scripts/rust-boundary-baseline.json`
4. Existing config load behavior unchanged; tests pass

Plans:
- [x] 97-01-PLAN.md — Move config modules to persistence/config/; resolve memory-budget dependency
- [x] 97-02-PLAN.md — Remove application/config; drop baseline entry; verify boundaries

**Wave 1** *(parallel-safe)*
- 97-01 — persistence/config/ submodule tree with loader, validation, defaults, yaml_merge, budget

**Wave 2** *(blocked on Wave 1 completion)*
- 97-02 — delete application/config, ratchet rust-boundary-baseline.json, update AGENTS.md

### Phase 98: Persistence Util Test Extraction

**Goal:** Extract inline tests from `persistence/util.rs` to mirrored `tests/persistence/` tree
**Plans:** 1 plan
**Success Criteria:**
1. Zero inline test bodies in `util.rs`
2. Tests mirrored under `crates/rlm-core/tests/persistence/`
3. `#[path]` stub pattern used where private access needed
4. `cargo test -p rlm-core` passes

Plans:
- [x] 98-01-PLAN.md — extract util.rs inline tests to tests/persistence/util.rs with #[path] stub

### Phase 99: File Vector Index Test Extraction

**Goal:** Extract inline tests from `file_vector_index.rs` to mirrored test tree
**Plans:** 1 plan
**Success Criteria:**
1. Zero inline test bodies in `file_vector_index.rs`
2. Tests under `crates/rlm-core/tests/persistence/`
3. `cargo test -p rlm-core` passes

Plans:
- [x] 99-01-PLAN.md — extract file_vector_index.rs inline tests to tests/persistence/file_vector_index.rs with #[path] stub

### Phase 100: ANN Vector Index Architecture & Test Extraction

**Goal:** Extract tests from `ann_vector_index.rs`; split module if >300 lines after extraction
**Success Criteria:**
1. Inline tests extracted to `tests/persistence/`
2. Module split only if file remains hard to scan post-extraction
3. `cargo test -p rlm-core` passes

### Phase 101: Run State Store Architecture & Test Extraction

**Goal:** Extract tests from `run_state_store.rs`; split read/write or snapshot vs persist if needed
**Success Criteria:**
1. Inline tests extracted to `tests/persistence/`
2. Split applied only if post-extraction file exceeds readability threshold
3. `cargo test -p rlm-core` passes

### Phase 102: Session Store Architecture & Test Extraction

**Goal:** Extract tests from `session_store.rs`; split if needed after extraction
**Success Criteria:**
1. Inline tests extracted to `tests/persistence/`
2. `cargo test -p rlm-core` passes

### Phase 103: Memory Store Architecture & Test Extraction

**Goal:** Full paired pass on `memory_store.rs` — split by concern (scope, episodic, audit, facade)
**Success Criteria:**
1. Inline tests extracted to `tests/persistence/`
2. Module split by concern if file exceeds ~300 lines
3. `cargo test -p rlm-core` passes

### Phase 104: Ollama Embedding Test Extraction

**Goal:** Extract inline tests from `adapters/ollama_embedding.rs` to `tests/adapters/`
**Success Criteria:**
1. Zero inline test bodies in `ollama_embedding.rs`
2. Tests mirrored under `crates/rlm-core/tests/adapters/`
3. `cargo test -p rlm-core` passes

### Phase 105: Ollama Language Model Architecture & Test Extraction

**Goal:** Extract tests from `ollama_language_model.rs`; split request vs response if needed
**Success Criteria:**
1. Inline tests extracted to `tests/adapters/`
2. Split only if post-extraction readability requires it
3. `cargo test -p rlm-core` passes

### Phase 106: Tool Result Type Ports Consolidation

**Goal:** Move tool result type to `ports/`; update all four builtins; drop 4× `no-plugins-to-domain`
**Success Criteria:**
1. `ToolExecutionResult` (or equivalent) lives under `ports/`
2. All four builtin tools updated to use ports type
3. Four `no-plugins-to-domain` baseline entries removed
4. `cargo test -p rlm-core` passes

### Phase 107: Plugin Runtime & Registry Boundary Cleanup

**Goal:** Extract runtime/registry tests; inject config and tool filter via port/bootstrap
**Success Criteria:**
1. `no-plugins-to-application` and `no-plugins-to-persistence` removed from baseline
2. `filter_agent_tools` exposed through port/bootstrap
3. Registry service config injected via port, not direct `LoadedProjectConfig` import
4. `cargo test -p rlm-core` passes

### Phase 108: Plugin Manifest Test Extraction

**Goal:** Extract inline tests from `plugins/manifest.rs` to `tests/plugins/`
**Success Criteria:**
1. Zero inline test bodies in `manifest.rs`
2. Tests under `crates/rlm-core/tests/plugins/`
3. `cargo test -p rlm-core` passes

### Phase 109: Plugin Remote Fetch Test Extraction

**Goal:** Extract inline tests from `remote_fetch.rs` to mirrored test tree
**Success Criteria:**
1. Zero inline test bodies in `remote_fetch.rs`
2. Tests under `crates/rlm-core/tests/plugins/`
3. `cargo test -p rlm-core` passes

### Phase 110: Builtin Write File Test Extraction

**Goal:** Extract inline tests from `builtin/write_file.rs` to `tests/plugins/`
**Success Criteria:**
1. Zero inline test bodies in `write_file.rs`
2. Tests under `crates/rlm-core/tests/plugins/`
3. `cargo test -p rlm-core` passes

### Phase 111: Builtin Shell Test Extraction

**Goal:** Extract inline tests from `builtin/shell.rs` to mirrored test tree
**Success Criteria:**
1. Zero inline test bodies in `shell.rs`
2. Tests under `crates/rlm-core/tests/plugins/`
3. `cargo test -p rlm-core` passes

### Phase 112: Builtin Web Tools Test Extraction

**Goal:** Extract inline tests from `web_fetch.rs` and `web_search.rs` to mirrored test tree
**Success Criteria:**
1. Zero inline test bodies in both web tool modules
2. Tests under `crates/rlm-core/tests/plugins/`
3. `cargo test -p rlm-core` passes
4. `scripts/rust-boundary-baseline.json` empty (strict mode passes)

<details>
<summary>✅ v1.16 Rust Application Memory & Config (Phases 92–96) — SHIPPED 2026-05-24</summary>

- [x] **Phase 92: Rust RAM Guard Architecture & Test Extraction** — completed 2026-05-24
- [x] **Phase 93: Rust Session Memory Bridge Test Extraction** — completed 2026-05-24
- [x] **Phase 94: Rust Semantic Memory Index Test Extraction** — completed 2026-05-24
- [x] **Phase 95: Rust Memory Resolver Test Extraction** — completed 2026-05-24
- [x] **Phase 96: Rust Config Loader Test Extraction** — completed 2026-05-24

Full details: `.planning/milestones/v1.16-ROADMAP.md`

</details>

<details>
<summary>✅ v1.15 Rust Application Layer Architecture (Phase 91) — SHIPPED 2026-05-24</summary>

- [x] **Phase 91: Rust Graph Executor Architecture & Test Extraction** — completed 2026-05-24

Full details: `.planning/milestones/v1.15-ROADMAP.md`

</details>

<details>
<summary>✅ v1.14 Rust Architecture & Test Layout (Phase 90) — SHIPPED 2026-05-23</summary>

- [x] **Phase 90: Rust Domain Layer Architecture & Test Extraction** — completed 2026-05-23

</details>

---
*Roadmap updated: 2026-05-24 — v1.17 Phases 97–112 from /gsd-explore*
