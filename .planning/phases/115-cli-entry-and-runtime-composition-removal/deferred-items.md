# Phase 115 Deferred Items

## Pre-existing (out of scope)

| Item | Detail | Gate |
|------|--------|------|
| model_library_routes tests | 2 failures in `crates/rlm-core/tests/model_library_routes.rs` (400 vs 200) | `cargo test -p rlm-core` |
| Tauri package name | Plan references `-p rlm-tauri`; actual package is `recursive-language-model` in `src-tauri/Cargo.toml`. Use `cargo check --manifest-path src-tauri/Cargo.toml` | 113-GATES Phase 115 |

## Transitional (Phase 116–119)

| Item | Detail |
|------|--------|
| TS compile | `src/application/bootstrap/` imports deleted cli/runtime |
| Full npm test | Remaining tests may import broken bootstrap paths |
