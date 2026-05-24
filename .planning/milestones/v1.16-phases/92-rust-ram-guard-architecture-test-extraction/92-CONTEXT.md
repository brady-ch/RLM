# Phase 92: Rust RAM Guard Architecture & Test Extraction - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — `/gsd-autonomous --auto`)

<domain>
## Phase Boundary

Full concern split on `ram_guard.rs` + mirrored test extraction per `.planning/notes/rust-memory-block-decomposition.md`. Split into `ram_probe.rs`, `ram_budget.rs`, `ram_eligibility.rs`, `ollama_ram.rs` with facade re-exports; extract inline tests to `tests/application/memory/`.

</domain>

<decisions>
## Implementation Decisions

### Module Split
- `ram_probe.rs`: `is_wsl`, `current_free_ram_mb`
- `ram_budget.rs`: config parsing, `available_model_ram_mb`, `validate_memory_budget`, `peak_runtime_model_ram_mb`, `configured_model_names`, `estimate_model_ram_mb`
- `ram_eligibility.rs`: `RamSnapshot`, `ModelRamEligibility`, `ram_snapshot`, `model_ram_eligibility`, sync `assert_*`, `resource_guard_json`
- `ollama_ram.rs`: `ollama_loaded_ram_mb`, `unload_ollama_models`, async `assert_*`
- `ram_guard.rs`: re-export facade; preserve public API via `memory/mod.rs`

### Test Extraction
- `tests/application/memory/ram_budget.rs`: `validate_memory_budget`
- `tests/application/memory/ram_eligibility.rs`: fixed-cap blocking, ollama-loaded budget reduction
- Use `#[path]` stubs for private access; no test logic in source files

### Claude's Discretion
- Exact internal module visibility and helper placement within the split modules
- Whether `ram_guard.rs` remains as facade file or re-exports move entirely to `mod.rs`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 91 pattern: `execution_order.rs`, `run_state_sync.rs`, slim `executor.rs` with `#[path]` test stubs under `tests/application/graph/`
- Phase 90 domain recursion test extraction pattern with `#[path]` stubs

### Established Patterns
- Paired pass: extract tests + split modules where natural seams exist
- Flat integration tests at `crates/rlm-core/tests/*.rs` unchanged
- `npm run check:rust:boundaries` — no new baseline entries

### Integration Points
- Public API preserved via `application/memory/mod.rs` re-exports
- Callers import from `ram_guard` module path through mod.rs facade

</code_context>

<specifics>
## Specific Ideas

Per `.planning/todos/pending/phase-92-ram-guard-paired-pass.md` acceptance checks. No TS mirror — Rust-only concern.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase within scope.

</deferred>
