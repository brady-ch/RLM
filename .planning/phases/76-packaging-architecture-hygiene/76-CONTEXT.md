# Phase 76: Packaging & Architecture Hygiene — Context

**Goal:** Default test gate includes packaging smoke; architecture docs, baselines, and milestone meta artifacts are accurate.

**Requirements:** PACK-04, ARCH-07, ARCH-08, META-01

**Depends on:** Phase 75 — roadmap sequencing only.

## Decisions

### D-01: PACK-04 — npm test includes packaging

Change root `package.json` `"test"` script to run existing `test:packaging` (`node --test scripts/packaging/deb-smoke-lib.test.mjs`) as part of default developer loop — after or chained with current `npm run build && node --test dist/tests`. Do not remove standalone `test:packaging` script.

### D-02: ARCH-07 — 71-DECISION refresh + baseline script

Update `.planning/milestones/v1.9-phases/71-optional-crate-split/71-DECISION.md`: Phase 70 prerequisites are **met** (boundary script shipped); remove stale "Phase 70 pending" language. Verify `scripts/measure-rust-compile-baseline.sh` preserves cargo exit status via `run_timed_step` — add regression test or script self-check if not already covered by 71-REVIEW fix.

### D-03: ARCH-08 — transitional boundary arcs

Seven arcs in `scripts/rust-boundary-baseline.json` remain baselined. **Do not** change default `check:rust:boundaries` to strict mode this phase unless code moves eliminate arcs. Publish explicit ratchet table in `AGENTS.md` Rust section: each baseline arc, why transitional, target phase/condition to remove. Optionally reduce count if a zero-behavior-change import move is trivial — not required.

### D-04: META-01 — wave todos + summary frontmatter

Move `.planning/todos/pending/rust-functional-debt-wave1.md` and `rust-structural-architecture-wave2.md` to `.planning/todos/done/` with cancelled/completed header noting v1.9 phases 62–71 shipped. Add YAML frontmatter to `.planning/milestones/v1.9-phases/66-cli-full-parity/66-01-SUMMARY.md` including `requirements-completed: [CLI-01, CLI-02, REG-02]` matching body content.

### D-05: Targeted verification only

Phase verify uses scoped commands (`npm run test:packaging`, `npm run check:rust:boundaries`, targeted node test). **Full `npm test` / full suite gate deferred** as milestone hygiene note — except PACK-04 itself wires packaging into `npm test` for future runs.

## Claude's Discretion

- Exact AGENTS.md ratchet table format — use concise markdown table matching existing concern map style.
- Whether to add `scripts/measure-rust-compile-baseline.sh` dry-run test in `scripts/` vs document manual verify — prefer small bash test if cheap.

## Deferred Ideas

- Eliminating all 7 baseline arcs in this phase — only required if trivial; otherwise document per D-03.
- Re-running full compile baseline capture — optional note in 71-DECISION, not blocking.
- Archiving other pending todos (`2026-05-22-*`) — out of scope unless explicitly stale.

## Upstream

- v1.9 audit: PACK-04, ARCH-07, ARCH-08, META-01 listed as v1.10 debt (`v1.9-MILESTONE-AUDIT.md`, `STATE.md`).
- Phase 70 shipped `check-rust-boundaries.sh`; 71-DECISION still claims Phase 70 unmet.
- `66-01-SUMMARY.md` lacks frontmatter though body lists CLI-01/02 satisfied.
