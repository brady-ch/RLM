# Phase 97 Deferred Items

## Pre-existing: no-adapters-to-application violation

- **File:** `crates/rlm-core/src/adapters/ollama_language_model.rs`
- **Import:** `use crate::application::execution::CancellationController;`
- **Impact:** `npm run check:rust:boundaries` fails in baseline mode (unrelated to Phase 97 config move)
- **Suggested phase:** 105 (Ollama Language Model Architecture & Test Extraction)

## Environment-flaky: control_server golden fixture

- **Test:** `control_server_matches_golden_fixtures`
- **Cause:** resourceGuard.runBlocked depends on host available RAM
- **Impact:** Full `cargo test -p rlm-core` may fail on low-RAM hosts
- **Not introduced by Phase 97**
