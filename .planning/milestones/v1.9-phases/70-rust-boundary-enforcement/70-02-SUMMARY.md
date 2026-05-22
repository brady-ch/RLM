---
phase: 70-rust-boundary-enforcement
plan: 02
subsystem: infra
tags: [rust, boundaries, bash, npm, ci]

requires:
  - phase: 70-01
    provides: rust-boundary-rules.toml and AGENTS.md rule names
provides:
  - check-rust-boundaries.sh CI gate
  - npm run check:rust:boundaries and updated check:rust chain
  - Clean domain production imports (tests in integration crate)
affects: [71, REG-02, ARCH-05]

tech-stack:
  added: []
  patterns:
    - "Bash layer scanner with JSON baseline for transitional arcs"
    - "cfg(test) module stripping before production import scan"

key-files:
  created:
    - scripts/check-rust-boundaries.sh
    - scripts/rust-boundary-baseline.json
    - scripts/rust-boundary-check.test.mjs
    - crates/rlm-core/tests/run_state_persistence_boundary.rs
  modified:
    - crates/rlm-core/src/domain/run_state_persistence.rs
    - package.json

key-decisions:
  - "Baseline documents 6 transitional plugins arcs; zero no-domain-to-persistence entries"
  - "check:rust uses targeted cargo check; full workspace test deferred to milestone close"

patterns-established:
  - "Meta-test uses temp fixture with --strict for domain rule probe"

requirements-completed: [ARCH-05, REG-02]

duration: 25min
completed: 2026-05-22
---

# Phase 70 Plan 02: Boundary Enforcement Summary

**Rust layer boundary gate detects forbidden imports, domain production code is persistence-free, and npm check:rust runs the scanner.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-22T22:45:00Z
- **Completed:** 2026-05-22T23:10:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Implemented `scripts/check-rust-boundaries.sh` with TOML rules, baseline, and `--strict` mode
- Relocated `run_state_persistence` unit tests to `crates/rlm-core/tests/run_state_persistence_boundary.rs`
- Wired `check:rust:boundaries` and updated `check:rust` to run boundaries + `cargo check`

## Task Commits

1. **Task 1 (TDD):** `0e9dbeb` (test), `28f3bd8` (feat) — boundary script + meta-test
2. **Task 2: Relocate domain persistence test import** - `475a506` (feat)
3. **Task  3: Wire npm check:rust** - `5d8e7b8` (feat)

## Verification (targeted, REG-02)

```bash
node --test scripts/rust-boundary-check.test.mjs   # pass
npm run check:rust:boundaries                        # pass
cargo check -p rlm-core -p rlm-cli                   # pass
cargo test -p rlm-core --test run_state_persistence_boundary  # 3/3 pass
```

Full `cargo test --workspace` and full `npm run check:rust` clippy chain deferred per phase D-05.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: scripts/check-rust-boundaries.sh
- FOUND: scripts/rust-boundary-check.test.mjs
- FOUND: crates/rlm-core/tests/run_state_persistence_boundary.rs
- FOUND: 0e9dbeb, 28f3bd8, 475a506, 5d8e7b8
