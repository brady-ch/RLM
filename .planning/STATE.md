---
gsd_state_version: 1.0
milestone: v1.17
milestone_name: Rust Infrastructure Layer
status: in_progress
last_updated: "2026-05-24T07:30:00.000Z"
progress:
  total_phases: 34
  completed_phases: 15
  total_plans: 19
  completed_plans: 22
  percent: 100
---

# Project State

**Current focus:** Phase 107 — Plugin Runtime & Registry Boundary Cleanup

## Current Position

Phase: 107
Plan: 02 complete
Status: Complete

## Decisions

- util.rs #[path] stub uses `../../tests/persistence/util.rs` (2 levels up from src/persistence/)
- file_vector_index.rs #[path] stub uses `../../tests/persistence/file_vector_index.rs` (2 levels up from src/persistence/)
- ann_vector_index.rs #[path] stub uses `../../tests/persistence/ann_vector_index.rs` (2 levels up from src/persistence/)
- AnnVectorIndex post-extraction: 262 lines — no split needed (threshold 300)
- run_state_store/mod.rs #[path] stub uses `../../../tests/persistence/run_state_store.rs` (3 levels from subdirectory)
- FileRunStateStore post-extraction: 372 lines — split into persist/mutation submodules
- PersistedRunState defined in mod.rs for sibling submodule field access
- session_store/mod.rs #[path] stub uses `../../../tests/persistence/session_store.rs` (3 levels from subdirectory)
- FileSessionStore post-extraction: 403 lines — split into persist/verify submodules
- memory_store/mod.rs #[path] stub uses `../../../tests/persistence/memory_store.rs` (3 levels from subdirectory)
- FileMemoryStore split into scope/episodic/audit submodules (scope.rs 279 lines)
- ollama_embedding.rs #[path] stub uses `../../tests/adapters/ollama_embedding.rs` (2 levels from src/adapters/)
- tests/adapters/ mirror tree established for adapters block (first adapters phase)
- CancellationController lives in ports/cancellation.rs with application/execution re-export
- ollama_language_model.rs post-extraction: 323 lines — split into request/response submodules
- ollama_language_model/mod.rs #[path] stub uses `../../../tests/adapters/ollama_language_model.rs` (3 levels from subdirectory)
- OllamaLanguageModel split: mod.rs 197, request.rs 62, response.rs 55 non-blank lines
- ToolExecutionResult lives in ports/tool.rs without domain re-export shim
- Boundary baseline ratcheted to 2 entries (runtime.rs, registry/service.rs only)
- AgentProfile and filter_agent_tools live in ports/agent.rs with application re-export shim
- PluginRegistryConfig injected at composition boundary; transitional baseline empty as of Phase 107
- manifest.rs #[path] stub uses `../../tests/plugins/manifest.rs` (2 levels from src/plugins/)
- manifest.rs post-extraction: 126 lines — no split needed (threshold 300)

## Milestone Goal

Extract inline tests to mirrored `tests/{persistence,adapters,plugins}/` trees, split oversized infrastructure modules, eliminate all transitional boundary baseline entries.

## Next Steps

1. Phase 108: Plugin manifest test extraction
2. Phases 109–112: Remaining plugin test extraction
3. **v1.18 queued:** Phases 113–120 Node Runtime Retirement (after v1.17)
4. **v1.19 queued:** Phases 121–128 UI Product Simplification (after v1.18)

## Roadmap Evolution

- Phases 113–120 added: **v1.18 Node Runtime Retirement** — incremental TS deletion, Rust-only runtime, constrained tool envelope post-cutover (from /gsd-explore 2026-05-24)
- Phases 121–128 added: **v1.19 UI Product Simplification** — audit-first prune, canvas-first shell, code/bundle lightening (from /gsd-explore 2026-05-24)
