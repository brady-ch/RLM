---
created: 2026-05-22T00:00:00.000Z
title: Rust structural architecture — Wave 2
area: rust-runtime
priority: medium
source: "$gsd-explore rust architecture"
depends_on: rust-functional-debt-wave1.md
resolves_phase: 76
status: cancelled
---

Superseded by v1.9 phases 62–71 shipped 2026-05-22; tracked in v1.10 Phases 72–76.

## Problem

Rust runtime mirrors TS concern map at a glance but lacks v1.6/v1.7 cleanup: domain→persistence boundary violation, no `application/` grouping, monolithic HTTP routes, oversized modules, no enforced dependency rules, single fat crate.

## Recommended order

A1 (during F2) → A2 + A3 → A4 → A5 → A6 (optional, triggered by compile pain).

---

### A1 — Domain boundary fix

**Target:** `domain/run_state_persistence.rs` → `FileRunStateStore`

- [ ] Define `RunStateStorePort` trait in `ports/`
- [ ] Move orchestration to `application/run_state/` or inject trait into domain helper
- [ ] `FileRunStateStore` implements port in `persistence/`
- [ ] Remove all `use crate::persistence` from `domain/`

**Acceptance:** No domain module imports `persistence/`, `adapters/`, or `control_server/`.

---

### A2 — Application layer grouping

**Target:** Flat top-level orchestration modules

- [ ] Introduce `crates/rlm-core/src/application/` with submodules: `execution/`, `graph/`, `memory/`, `config/`, `bootstrap/`
- [ ] Move or re-export existing modules; preserve public `lib.rs` API
- [ ] Extract runtime composition from `control_server/mod.rs` and `bootstrap/cli_runtime.rs` into application builders (Rust analog of pending TS todo `extract-runtime-composition-from-cli-entrypoint`)

**Acceptance:** `control_server/` and `rlm-cli` call application facades; composition wiring not duplicated in transport layer.

---

### A3 — Control server handler split

**Target:** `control_server/routes.rs` (1,525 lines)

- [ ] Split into `control_server/handlers/{session,graph,memory,model_library,plugins,chat}.rs`
- [ ] Leave `routes.rs` as thin router wiring only
- [ ] Align handler grouping with TS `application/control-server/handlers/`

**Acceptance:** No handler file exceeds ~400 lines; existing route integration tests pass unchanged.

---

### A4 — Large file decomposition

| File | Lines | Action |
|------|-------|--------|
| `recursive_language_model.rs` | 1,062 | Extract methods to `domain/recursion/` (quality loop module reduces this) |
| `execution/session_graph.rs` | 933 | Split graph mutations vs SSE/event emission |
| `plugins/registry_service.rs` | 640 | Split install/doctor/inspect vs catalog IO |
| `persistence/config.rs` | 465 | Split loader / validation / resolver (Rust analog of pending TS config split todo) |

- [ ] One focused PR/sub-plan per file; behavior-preserving only
- [ ] Existing test gates green after each split

**Acceptance:** No production module exceeds ~600 lines except generated or data tables; config split mirrors TS Phase 37 structure.

---

### A5 — Rust boundary enforcement + docs

- [ ] Add Rust concern map to `AGENTS.md` (mirror TS table: may import columns)
- [ ] Add `scripts/check-rust-boundaries.sh` or cargo-deny custom rules:
  - `domain` → no `persistence`, `adapters`, `control_server`, `execution`
  - `ports` → no `adapters`, `persistence`, `control_server`
  - `adapters`/`persistence` → no `control_server`
- [ ] Wire into `npm run check:rust`

**Acceptance:** Boundary violations fail CI; contributor map documents Rust layers.

---

### A6 — Crate split (optional)

See `.planning/seeds/rust-crate-split.md`.

- [ ] Evaluate compile/test iteration after A4
- [ ] If triggered: extract `rlm-ports` + `rlm-domain` (no tokio/axum); keep `rlm-core` as application + infrastructure

**Acceptance:** `cargo test` workspace times improve measurably; public API unchanged for `rlm-cli` and Tauri.
