# Phase 70 Verification

**Phase:** 70-rust-boundary-enforcement  
**Verified:** 2026-05-22  
**Gate:** Targeted only (full test suite deferred)

## Success Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| AGENTS.md Rust concern map with May import | PASS | `grep -c "May import" AGENTS.md` ≥ 2 |
| rust-boundary-rules.toml manifest | PASS | 16 forbidden arcs, `no-domain-to-persistence` present |
| Script fails on domain→persistence | PASS | Meta-test fixture + `--strict` |
| Domain production zero persistence imports | PASS | Tests relocated; strict scan clean |
| npm run check:rust invokes boundary check | PASS | `package.json` scripts |
| Baseline has zero domain→persistence | PASS | `rust-boundary-baseline.json` |

## Commands Run

```bash
node --test scripts/rust-boundary-check.test.mjs
npm run check:rust:boundaries
bash scripts/check-rust-boundaries.sh --strict  # fixture-only in meta-test
cargo check -p rlm-core -p rlm-cli
cargo test -p rlm-core --test run_state_persistence_boundary
```

## Deferred

- Full `cargo test --workspace` — milestone close
- Full `npm run check:rust` including clippy on all targets — operator may run locally
