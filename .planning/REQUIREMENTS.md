# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-22  
**Milestone:** v1.8 — Rust Runtime Migration  
**Core Value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## v1.8 Requirements

### Regression Gate

- [ ] **REG-01**: Existing UI workflows (graph authoring, execution, session save/reopen, model library, plugin panel) behave as before when served by the Rust runtime — no intentional semantic drift except documented Rust-mode plugin limitations.
- [ ] **REG-02**: Combined CI gate stays green: `npm run check` for UI/tooling plus `check:rust` (fmt, clippy, test) for the Rust workspace; parity fixture job compares TS golden responses to Rust before Node removal.
- [x] **REG-03**: On-disk formats under `.rlm/` remain readable across migration — dual-read or lossless import paths for session bundles, memory stores, preferences, run-state, and vector index JSON.

### Rust Workspace & Control Server

- [ ] **RWRK-01**: Cargo workspace at repo root with `rlm-core` library crate and `rlm-cli` binary; dependency direction mirrors v1.7 concern map (`ports` traits → domain → adapters → application → runtime → control-server).
- [ ] **RWRK-02**: Axum control server on loopback preserves existing REST route surface and `/api/events` SSE contract; golden JSON/SSE fixtures gate handler parity.
- [ ] **RWRK-03**: Static UI assets served from Rust control server (or Tauri asset path) with same base URL contract the React app expects today.

### Persistence

- [x] **PERS-01**: File-based session store supports save/reopen with the same bundle envelope and verification semantics as v1.4/v1.7.
- [x] **PERS-02**: Memory scopes, episodic logs, preferences, and ACL filtering behave as today with explicit degraded states when stores are corrupt or missing.
- [x] **PERS-03**: Run-state checkpoint/resume and workflow sidecar persistence remain compatible with existing graph workflow formats.
- [x] **PERS-04**: Project YAML config loads via Rust with equivalent validation messages and path context as `application/config/`.

### Recursive Engine & Graph Execution

- [ ] **ENGN-01**: `RecursiveLanguageModel` port in Rust preserves depth limits, budget guards, quality loop phases, tool rounds, and cancellation/stop semantics from the TypeScript orchestrator.
- [ ] **ENGN-02**: ExecutionController exposes the same approval, clarification, and stale-mutation handling as the current control-server session authority.
- [ ] **GRPH-01**: GraphExecutor walks approved topology with bind-time expert resolution, descendant blocking on failure, and single-pass/RLM enforcement matching v1.5 behavior.
- [ ] **GRPH-02**: All `/api/nodes/*`, `/api/graph/*`, and workflow export/import routes required by the UI and CLI are implemented in Rust with matching status codes and error vocabulary.

### Vector Index & Embeddings

- [ ] **VIDX-01**: Rust ANN index (usearch primary, documented fallback) replaces JSON linear scan with scope-filtered top-k retrieval and visible degraded/empty states.
- [ ] **VIDX-02**: Existing `vector-index.json` records import lazily on first open without data loss; session save/reopen merges vector metadata losslessly.
- [ ] **VIDX-03**: Embeddings use Ollama HTTP by default during migration; embedding host unavailability surfaces explicit degraded state in UI/CLI.

### Model Hosts & Library

- [ ] **MDLH-01**: Ollama HTTP adapter implements `LanguageModelPort` including streaming completions and tool-calling policy flags used by the recursive engine.
- [ ] **MDLH-02**: Model library routes (curated catalog, search, install progress, tier selection) preserve v1.3/v1.7 semantics against Ollama as default host.
- [ ] **MDLH-03**: Hugging Face search and artifact metadata work without Python; download path validates manifests/artifacts before catalog write.

### Plugins & Tools

- [ ] **PLUG-01**: Built-in shell, file-write, web-search, and web-fetch tools register through Rust `ExtensionHostPort` with the same trust and guard semantics as v1.7 builtins.
- [ ] **PLUG-02**: Plugin manifest validation, discovery order (builtins → configured → catalog), and `PluginRegistryService` parity for list/install/enable/disable/uninstall/doctor/inspect/validate.
- [ ] **PLUG-03**: MCP/skill interop wiring ports to Rust with preserved init order: plugins → interop → tools resolver → agent registry → models.
- [ ] **PLUG-04**: Remote plugin fetch (HTTPS/git) security defenses from v1.7 (zip-slip, size limits, confirm gate, doctor `--fix`) are reimplemented in Rust before cutover.

### CLI & Packaging

- [ ] **CLI-01**: Rust `rlm` binary replaces Node entry for all run modes: ask, ui (headless server), plan-only, workflow, session/memory flags, and full `rlm plugin` subcommand surface.
- [ ] **CLI-02**: `RLM_RUNTIME=node|rust` switch supports strangler development; default production desktop uses Rust only after Phase 59.
- [ ] **PACK-01**: Tauri embeds Rust control server in-process on `127.0.0.1` — no managed Node child process; graceful shutdown on window close.
- [ ] **PACK-02**: Desktop release bundle contains no bundled Node runtime; ships Rust binary, static UI assets, and documented Ollama readiness check in Rust.
- [ ] **PACK-03**: Linux `.deb` (and existing packaging scripts) produce installable artifacts passing package smoke with Rust-only runtime layout.

## Future Requirements

### Post–v1.8 (Deferred)

- **INFR-01**: Managed in-process llama.cpp runtime (`llama-cpp-2` or equivalent) with GPU backend matrix.
- **INFR-02**: WASM or subprocess bridge for external ESM plugins beyond Rust-native builtins.
- **INFR-03**: Multi-runner adapters (vLLM, cloud APIs) beyond Ollama HTTP.
- **INFR-04**: Fine-tuning / LoRA / QLoRA workflows.
- **INFR-05**: Product shell convergence (guided composer, session launcher) — separate milestone theme.
- **INFR-06**: Release hardening (signed artifacts, Windows/macOS packages, auto-update channel).

## Out of Scope

| Feature | Reason |
|---------|--------|
| React UI rewrite | UI stays TypeScript/React in Tauri webview per direction note |
| Python runtime or HF training stack | Explicitly excluded — Rust + Ollama/llama.cpp handoff only |
| Replacing Ollama on day one | Strangler path keeps Ollama default until Rust core stable |
| Fine-tuning / LoRA | Deferred to separate milestone; compute and ecosystem cost |
| Embedded SQLite/Postgres for run state | ARTF-01 deferred; file-based persistence sufficient for v1.8 |
| Plugin hot reload without restart | Conflicts with v1.7 `requiresRestart` semantics |
| Silent auto-fallback on errors | Conflicts with core value — explicit failure visibility |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REG-01 | Phase 60 | Pending |
| REG-02 | Phase 59 | Pending |
| REG-03 | Phase 53 | Complete |
| RWRK-01 | Phase 52 | Pending |
| RWRK-02 | Phase 52 | Pending |
| RWRK-03 | Phase 52 | Pending |
| PERS-01 | Phase 53 | Complete |
| PERS-02 | Phase 53 | Complete |
| PERS-03 | Phase 53 | Complete |
| PERS-04 | Phase 53 | Complete |
| ENGN-01 | Phase 54 | Pending |
| ENGN-02 | Phase 54 | Pending |
| GRPH-01 | Phase 55 | Pending |
| GRPH-02 | Phase 55 | Pending |
| VIDX-01 | Phase 56 | Pending |
| VIDX-02 | Phase 56 | Pending |
| VIDX-03 | Phase 56 | Pending |
| MDLH-01 | Phase 57 | Pending |
| MDLH-02 | Phase 57 | Pending |
| MDLH-03 | Phase 57 | Pending |
| PLUG-01 | Phase 58 | Pending |
| PLUG-02 | Phase 58 | Pending |
| PLUG-03 | Phase 58 | Pending |
| PLUG-04 | Phase 58 | Pending |
| CLI-01 | Phase 59 | Pending |
| CLI-02 | Phase 59 | Pending |
| PACK-01 | Phase 60 | Pending |
| PACK-02 | Phase 60 | Pending |
| PACK-03 | Phase 60 | Pending |

**Coverage:**
- v1.8 requirements: 28 total
- Mapped to phases: 28/28 ✓
- Unmapped: 0

---
*Requirements defined: 2026-05-22*
