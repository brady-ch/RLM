---
gsd_state_version: 1.0
milestone: v1.18
milestone_name: Node Runtime Retirement
status: ready_for_verification
last_updated: "2026-05-24T15:46:00Z"
last_activity: 2026-05-24
progress:
  total_phases: 32
  completed_phases: 10
  total_plans: 27
  completed_plans: 27
  percent: 100
---

# Project State

**Current focus:** Phase 119 — npm toolchain cleanup (execution complete)

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-24)

**Core value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## Current Position

Phase: 119
Plan: 3 of 3 complete
Status: Execution complete — ready for verification
Last activity: 2026-05-24

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-05-24:

| Category | Item | Status |
|----------|------|--------|
| verification | Phases 100–105, 107 lack VERIFICATION.md | deferred |
| test_env | model_library_routes tier-select RAM flake on low-RAM hosts | resolved in 116-03 (explicit memory cap in fixture) |
| cosmetic | Config loader tests at crates/rlm-core/tests/application/config/ (TS mirror removed Phase 116) | deferred |
| nyquist | Zero *-VALIDATION.md across v1.17 phases (16 phases) | deferred |
| requirement | PLUG-106-04, PLUG-107-05 partial (full cargo test env-dependent) | deferred |
| todo | 56 pending backlog todos (architecture, rust-architecture) | deferred |
| uat | Phase 89 UAT operator_signed (0 open scenarios) | acknowledged |

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
- remote_fetch.rs #[path] stub uses `../../tests/plugins/remote_fetch.rs` (2 levels from src/plugins/)
- remote_fetch.rs post-extraction: 187 lines — no split needed (threshold 300)
- write_file.rs #[path] stub uses `../../../tests/plugins/builtin/write_file.rs` (3 levels from src/plugins/builtin/)
- write_file.rs post-extraction: 133 lines — no split needed (threshold 300)
- shell.rs #[path] stub uses `../../../tests/plugins/builtin/shell.rs` (3 levels from src/plugins/builtin/)
- shell.rs post-extraction: 181 lines — no split needed (threshold 300)
- web_fetch.rs #[path] stub uses `../../../tests/plugins/builtin/web_fetch.rs` (3 levels from src/plugins/builtin/)
- web_fetch.rs post-extraction: 191 lines — no split needed (threshold 300)
- web_search.rs #[path] stub uses `../../../tests/plugins/builtin/web_search.rs` (3 levels from src/plugins/builtin/)
- web_search.rs post-extraction: 225 lines — no split needed (threshold 300)
- Phase 114: check:parity is Rust-only via control_server_matches_golden_fixtures
- Phase 114: TS control-server deleted; Node ui command redirects to npm run rlm -- ui
- Phase 114: Vite dev proxies /api to Rust on RLM_CONTROL_PORT (default 8787)
- Golden fixture test strips host-dependent runBlocked fields before compare
- Phase 115: npm rlm is Rust-only; src/cli/, src/runtime/, src/index.ts deleted
- Phase 115: Tauri uses rlm_core::start_server in-process (no Node RLM child)
- Phase 115: Tauri interactive dev smoke deferred to operator UAT
- Phase 116: src/application/ and tests/application/ deleted; Rust application layer sole implementation
- Phase 116: agent-safe-verify light/reg03 use cargo test -p rlm-core loader smoke
- Phase 116: model_library_routes fixture uses explicit memory.maxRamMb for host-independent tests
- Phase 117: src/domain/, src/ports/, tests/domain/ deleted; Rust crates/rlm-core canonical for domain and ports
- Phase 117: UI labels comment references crates/rlm-core/src/domain/types.rs ExecutionStatus
- Phase 117: Legacy Phase 40 peel/stitch scripts removed; orphan test helpers pruned
- Phase 118: src/adapters/, src/plugins/, tests/adapters/, tests/plugins/, tests/helpers/ deleted; entire src/ absent
- Phase 118: Rust crates/rlm-core is sole runtime; AGENTS.md and ARCHITECTURE.md updated for Rust-only boundary
- Phase 118: npm run build/typecheck expected fail until Phase 119; depcruise src/ refs deferred to Phase 119
- Phase 119: npm toolchain Rust-only; npm run check = UI lint/format + check:rust; tsc/depcruise removed
- Phase 119: tests/depcruise removed; tests/ui/ and tests/fixtures/ are kept Node test paths

## Milestone Goal

Delete TypeScript runtime layers; Rust-only orchestration, CLI, and control server.

## Next Steps

1. Phase 120: Constrained Ollama Tool Envelope (Rust)
2. **v1.18 in progress:** Phases 113–120 Node Runtime Retirement (119 execution complete)
3. **v1.19 queued:** Phases 121–128 UI Product Simplification (after v1.18)
4. **v1.20 queued:** Phases 129–135 Product Desktop & Run Outcome (after v1.19)
5. **v1.21 queued:** Phases 136–140 Inference Expansion (after v1.20)
6. **v1.22 queued:** Phases 141–144 Agent Primitives (after v1.21)
7. **v1.23 queued:** Phase 145 Documentation & Architecture Audit (after v1.22)

## Roadmap Evolution

- Phases 136–145 added: **v1.21 Inference**, **v1.22 Agent Primitives**, **v1.23 Docs Audit** — seed backlog resolution (from /gsd-explore 2026-05-24)
- Nine seeds archived as shipped; four active seeds linked to v1.21–v1.22 phases

## Operator Next Steps

- Phase 119 executed 2026-05-24; gates green via test:agent:verify:light
