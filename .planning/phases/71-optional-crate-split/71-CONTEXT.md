# Phase 71: Optional Crate Split — Context

**Gathered:** 2026-05-22  
**Status:** Ready for planning  
**Source:** ROADMAP goal, ARCH-06, REG-02, `.planning/seeds/rust-crate-split.md`, `.planning/notes/rust-architecture-improvement-plan.md`

<domain>
## Phase Boundary

Measure Rust compile/test iteration after Wave 2 structural cleanup (Phases 68–70), then **either**:

1. **Split path:** Extract `rlm-ports` + `rlm-domain` workspace members from monolithic `rlm-core`; preserve `rlm_core::` public API for `rlm-cli` and Tauri.
2. **Defer path:** Document measured baseline, defer rationale, and seed trigger conditions in phase summary — no crate extraction.

Out of scope: splitting `rlm-adapters`, `rlm-persistence`, or `rlm-application` into separate crates (seed lists as optional later); publishing to crates.io; algorithm or HTTP API behavior changes; full `npm run check:rust` gate (deferred to milestone close — targeted compile/test only per REG-02 pattern).

**Prerequisites (must be green before Plan 01 baseline):** Phase 69 (A4 decomposition) and Phase 70 (A5 boundary script + AGENTS.md concern map) complete per seed.

</domain>

<decisions>
## Implementation Decisions

### Measurement-first gate (D-01)
- Capture baseline **after** Phases 69–70 land — not against pre-cleanup monolith.
- Record: clean `cargo build -p rlm-core`, incremental rebuild after touching `domain/`, `ports/`, and `application/` files, and `cargo test -p rlm-core` wall time.
- Persist metrics to `71-BASELINE.md`; post-split remeasurement only if split path chosen.

### Trigger evaluation (D-02)
- Apply seed thresholds from `.planning/seeds/rust-crate-split.md`:
  - **SPLIT** if full `rlm-core` test iteration routinely exceeds **2–3 minutes** on dev hardware **or** single-crate rebuild fan-out blocks unrelated module work (document evidence).
  - **DEFER** if metrics are below thresholds and prerequisites are met — default recommendation when compile iteration is acceptable.
- Executor writes explicit `71-DECISION.md` with SPLIT or DEFER before Plan 02/03.

### Type placement for crate boundaries (D-03)
- `rlm-ports` holds trait contracts **and** shared DTOs currently imported by ports from `domain/types` (`ChatMessage`, `LanguageModelResponse`, `ToolCallRequest`, `TraceEvent`, `ToolExecutionResult`, run-state port types).
- `rlm-domain` depends on `rlm-ports` only — no tokio/axum in `rlm-ports` or `rlm-domain` manifests.
- Resolve existing `ports → domain::types` coupling during split, not after.

### Public API stability (D-04)
- `rlm-core` `lib.rs` keeps all current crate-root `pub use` paths (`rlm_core::domain::*`, `rlm_core::ports::*`, application facades).
- `rlm-cli` and `src-tauri` continue depending on `rlm-core` only — no new direct deps on `rlm-ports`/`rlm-domain`.

### Regression gate (D-05)
- Targeted tests only (match Phases 66–69 REG-02 pattern):
  - Split path: `cargo check -p rlm-ports -p rlm-domain -p rlm-core -p rlm-cli`, `cargo test -p rlm-domain`, `cargo test -p rlm-core --test recursive_engine_session --test quality_loop_parity`
  - Defer path: baseline script re-runnable; `cargo check -p rlm-core -p rlm-cli`
- Full workspace clippy/test suite deferred to milestone close.

### Claude's Discretion
- Exact subset of `domain/types.rs` moved to `rlm-ports` vs kept in `rlm-domain`.
- Whether domain unit tests live in `rlm-domain` `[dev-dependencies]` or stay in `rlm-core` integration tests.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/seeds/rust-crate-split.md` — trigger conditions, proposed layout, success criteria
- `.planning/todos/pending/rust-structural-architecture-wave2.md` — A6 acceptance criteria
- `.planning/research/ARCHITECTURE.md` — workspace member dependency rules
- `crates/rlm-core/src/lib.rs` — public re-export surface to preserve
- `crates/rlm-core/src/ports/` — trait modules (5 files)
- `crates/rlm-core/src/domain/` — engine + recursion helpers

</canonical_refs>

<deferred>
## Deferred Ideas

- `rlm-persistence` crate extraction — seed optional-later
- Full `npm run check:rust` / workspace clippy gate — milestone close
- crates.io publishing
- Splitting before Phase 69–70 complete

</deferred>

---

*Phase: 71-optional-crate-split*  
*Context gathered: 2026-05-22 — infrastructure phase, discuss skipped*
