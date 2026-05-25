---
gsd_state_version: 1.0
milestone: v1.19
milestone_name: UI Product Simplification
status: ready_for_operator_signoff
last_updated: "2026-05-25T06:00:00.000Z"
last_activity: 2026-05-25 -- Phase 128 execution complete (operator UAT pending)
progress:
  total_phases: 29
  completed_phases: 12
  total_plans: 12
  completed_plans: 15
  percent: 41
---

# Project State

**Current focus:** Phase 128 complete — v1.19 execution done; operator browser UAT sign-off pending

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-24)

**Core value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

**Current focus:** v1.19 UI Product Simplification — execution complete; operator sign-off via 128-UAT-CHECKLIST.md

## Current Position

Phase: 128
Plan: 01 complete
Status: Ready for operator sign-off (automated preflight passed)
Last activity: 2026-05-25 -- Phase 128 execution complete

## Deferred Items

Items acknowledged and deferred at v1.18 milestone close on 2026-05-24:

| Category | Item | Status |
|----------|------|--------|
| verification | Phases 114, 116–120 lack VERIFICATION.md | deferred |
| nyquist | Zero *-VALIDATION.md across v1.18 phases (8 phases) | deferred |
| uat | Tauri interactive dev window smoke (Phase 115) | deferred |
| todo | 55+ pending backlog todos (architecture, rust-architecture) | deferred |

Items from prior milestones (v1.17):

| Category | Item | Status |
|----------|------|--------|
| verification | Phases 100–105, 107 lack VERIFICATION.md | deferred |
| cosmetic | Config loader tests at crates/rlm-core/tests/application/config/ | deferred |
| nyquist | Zero *-VALIDATION.md across v1.17 phases (16 phases) | deferred |
| requirement | PLUG-106-04, PLUG-107-05 partial (full cargo test env-dependent) | deferred |

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
- Phase 120: Per-tool const branches in envelope oneOf for args discrimination (Option A)
- Phase 120: useToolEnvelope default false; two-phase constrained path unchanged when off
- Phase 120: Ollama format and tools mutually exclusive per ollama#8095
- Phase 128: Automated preflight passed (verify:light + 36/36 tests/ui); interactive browser UAT human_needed
- Phase 128: Tauri desktop smoke deferred to Phase 135 (v1.20)

## Milestone Goal

v1.19 UI Product Simplification execution complete. Operator browser UAT (128-UAT-CHECKLIST.md) pending before milestone ship.

## Next Steps

1. Operator completes browser UAT per `.planning/phases/128-ui-simplification-uat/128-UAT-CHECKLIST.md`
2. After operator sign-off: run `/gsd-complete-milestone` to archive v1.19
3. **v1.20 next:** Phases 129–135 Product Desktop & Run Outcome
4. **v1.21 queued:** Phases 136–140 Inference Expansion
5. **v1.22 queued:** Phases 141–144 Agent Primitives
6. **v1.23 queued:** Phase 145 Documentation & Architecture Audit

## Roadmap Evolution

- Phases 136–145 added: **v1.21 Inference**, **v1.22 Agent Primitives**, **v1.23 Docs Audit** — seed backlog resolution (from /gsd-explore 2026-05-24)
- Nine seeds archived as shipped; four active seeds linked to v1.21–v1.22 phases

## Operator Next Steps

- Complete browser UAT: `.planning/phases/128-ui-simplification-uat/128-UAT-CHECKLIST.md`
- Tauri packaged smoke deferred to Phase 135 (v1.20)
- Optional: run `/gsd-complete-milestone` after operator sign-off
