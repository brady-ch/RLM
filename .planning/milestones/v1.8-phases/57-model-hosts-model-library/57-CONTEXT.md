# Phase 57: Model Hosts + Model Library - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — all recommendations auto-accepted)

<domain>
## Phase Boundary

Port Ollama inference and model library panel to Rust: `LanguageModelPort` with streaming + tool-calling policy, `/api/model-library/*` routes with v1.7 parity, and Hugging Face search/download without Python.

</domain>

<decisions>
## Implementation Decisions

### Ollama Language Model Adapter
- Mirror TS `OllamaLanguageModel`: streaming chat, `allowUnconstrainedToolCalls` from host config, temperature 0.2 default
- Wire plan/exec models through `RouterState` when `runtimeHost` resolves to Ollama host
- Health check via `/api/tags`; explicit degraded errors when host unavailable

### Model Library Routes
- Preserve TS route surface: GET catalog, GET search, POST install, POST select-tier; add POST download for HF GGUF (Rust-only extension)
- Return 404 + `{ error: "Model library is not configured." }` when no Ollama host configured (golden fixture parity)
- Curated catalog, install job tracking, tier selection match TS `ModelLibraryService` semantics

### Hugging Face Registry
- HTTP-only HF API (search + model tree); no Python dependency
- Download validates repo_id, writes to `.rlm/models/registry/` with manifest before catalog write
- Reject empty/whitespace repo_id with actionable error

### UI Contract
- No React changes — Rust routes must match existing UI expectations for catalog, search, install progress, tier badges
- Model library panel reads same JSON shapes as v1.7 TS handlers

### Claude's Discretion
- Fixture strategy for configured vs unconfigured model-library states
- Ollama install job polling implementation details
- HF download size limits and validation depth

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `crates/rlm-core/src/adapters/ollama_language_model.rs` — streaming + tool rounds started
- `crates/rlm-core/src/model_library/` — service, types, hf_registry partially implemented
- `crates/rlm-core/src/control_server/routes.rs` — model-library routes wired
- TS reference: `src/application/execution/model-library.ts`, `handlers/model-library.ts`

### Established Patterns
- Golden fixtures in `tests/fixtures/control-server/` gate handler parity (Phase 52)
- `RouterState::new` wires services from project YAML like TS bootstrap
- Phase 54 engine uses `LanguageModel` trait for plan/exec models

### Integration Points
- `RouterState.plan_model()` / `exec_model()` for recursive engine
- `/api/model-library/*` for UI model panel
- Project config `hosts.local_ollama`, `models.tiers`, `runtimeHost`

</code_context>

<specifics>
## Specific Ideas

- Fix `control_server_fixtures` test: unconfigured server must return 404 for model-library (fixture expects unconfigured state)
- Add configured-state golden fixture when Ollama host present in test project config
- Ensure MDLH-01/02/03 requirements marked complete in REQUIREMENTS.md traceability

</specifics>

<deferred>
## Deferred Ideas

- llama.cpp in-process runtime (INFR-01) — post-v1.8
- Multi-runner adapters beyond Ollama (INFR-03) — post-v1.8

</deferred>
