# Phase 70: Rust Boundary Enforcement — Context

**Gathered:** 2026-05-22  
**Status:** Ready for planning  
**Source:** Infrastructure phase — discuss skipped; derived from ROADMAP goal, ARCH-05, REG-02, and v1.7 Phases 47–48 TS depcruise analog

<domain>
## Phase Boundary

Document and enforce Rust workspace layer boundaries mirroring the TypeScript concern map in `AGENTS.md`:

1. Publish Rust concern map in `AGENTS.md` with **May import** columns (ARCH-05).
2. Add `scripts/check-rust-boundaries.sh` that fails on forbidden arcs — **minimum:** `domain` → `persistence` (ROADMAP success criterion 2).
3. Wire boundary check into `npm run check:rust` (ARCH-05, REG-02).

Out of scope: workspace crate split (Phase 71); algorithm or API behavior changes; full workspace `cargo test` / clippy gate (deferred to milestone close — targeted script + compile verification only, per Phases 66–69 REG-02 pattern).

**Prerequisite:** Phase 69 large-file decomposition should land first (module paths stable for rule patterns).

</domain>

<decisions>
## Implementation Decisions

### TS analog (D-01)
- Mirror v1.7 Phase 47 concern map + Phase 48 strict enforcement pattern: rule names in `AGENTS.md`, machine-readable manifest, error severity on inner-layer rules.
- Scope analysis to `crates/rlm-core/src/**` and `crates/rlm-cli/src/**` (Rust production sources).

### Rule set (D-02)
- Enforce at **error** severity (no warn baseline for inner rules): `domain` must not import `persistence`, `adapters`, `application`, `control_server`, `plugins`, `interop`, `server`.
- Additional forbidden arcs documented in concern map and manifest: `ports` → infrastructure layers; `adapters`/`persistence` → `control_server`/`application`; `plugins` → `application`/`domain`/`persistence` (match TS `no-plugins-to-*` intent).
- Document **optional follow-on** exceptions in AGENTS.md (not enforced yet), matching TS pattern: `application` → `persistence`/`adapters` via bootstrap and handler wiring; `ports` → `domain` types; transitional `plugins/builtin` → `domain::types` until tool result types consolidate under `ports`.

### Known violation cleanup (D-03)
- Relocate `domain/run_state_persistence.rs` `#[cfg(test)]` import of `FileRunStateStore` to integration test under `crates/rlm-core/tests/` so production domain modules scan clean.
- Remaining transitional arcs (e.g. `plugins/runtime.rs` → `application`, `plugins/registry_service.rs` → `persistence`) may use checked-in baseline **only if** fixing them exceeds phase scope; `domain` → `persistence` must have **zero** baseline entries after D-03.

### CI wiring (D-04)
- Append `bash scripts/check-rust-boundaries.sh` to `npm run check:rust` after fmt/clippy/test chain (or before tests — executor chooses; script must run in gate).
- Add `check:rust:boundaries` npm script alias for fast iteration.

### Regression gate (D-05)
- Targeted verification only: boundary script self-test + `cargo check -p rlm-core -p rlm-cli`.
- Full `cargo test --workspace` deferred to milestone close.

### Claude's Discretion
- Shell vs small Node helper for parsing `use` statements.
- Exact baseline file format if needed for transitional arcs.
- Whether to strip `#[cfg(test)]` modules before scanning production paths.

</decisions>

<deferred>
## Deferred Ideas

- Full `npm run check:rust` workspace gate — milestone close
- Ratcheting optional `application` → `persistence` rule to error — post-v1.9
- Workspace crate split — Phase 71
- Moving `ToolExecutionResult` from domain to ports to eliminate plugins→domain imports

</deferred>
