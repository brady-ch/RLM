# Phase 71: Optional Crate Split — Defer Summary

**Decision: DEFER** — no crate extraction; compile iteration well below split thresholds.

## Decision

See [`71-DECISION.md`](./71-DECISION.md). Plan 01 measured post-Phase-69 baseline and evaluated seed triggers. All compile-pain triggers **failed** (metrics below thresholds). Route: defer closure, not `71-02` split.

## Measured Baseline

From [`71-BASELINE.md`](./71-BASELINE.md) (2026-05-22, rustc 1.94.0):

| Measurement | Wall seconds |
|-------------|-------------:|
| Clean build | 7 |
| Incremental domain | 2 |
| Incremental ports | 1 |
| Incremental application | 1 |
| Test iteration (lib) | 8 |

Re-run `./scripts/measure-rust-compile-baseline.sh` after Phase 70 (A5 boundary script) for authoritative post-prerequisite baseline.

## Rationale

1. **Test iteration:** 8s lib suite vs 120–180s split trigger — 15–22× below threshold.
2. **Incremental rebuilds:** 1–2s per layer vs 30s fan-out trigger — no evidence single-crate rebuild blocks unrelated work.
3. **Structural cleanup:** Phases 68–70 decomposition reduced monolith pain without Cargo-level extraction.
4. **Split cost:** `ports → domain::types` coupling (DTOs like `ChatMessage`, `ToolCallRequest`) would require upfront type placement work (D-03) with no compile benefit at current scale (~16k LOC, fast iteration).
5. **Prerequisite note:** Phase 70 (A5 boundary script) incomplete; defer is correct regardless — metrics alone do not justify split.

## Re-evaluation Triggers

Seed condition (verbatim from `.planning/seeds/rust-crate-split.md`):

> When Wave 2 structural work (A1–A4) stabilizes module boundaries AND cargo test/check iteration routinely exceeds team tolerance — e.g. full rlm-core test suite >2–3 min on dev machines, or frequent merge conflicts on unrelated modules due to single-crate rebuild fan-out

Operational thresholds for re-measurement:

| Trigger | Threshold |
|---------|-----------|
| Full `cargo test -p rlm-core` wall time | >180s sustained on dev hardware |
| Incremental domain edit rebuild | >30s sustained |
| Scale / conflict pressure | rlm-core LOC exceeds ~20k OR unrelated modules frequently conflict |

Current status (2026-05-22):

| Trigger | Status |
|---------|--------|
| Test suite >2–3 min | **FAIL** (8s lib tests) |
| Rebuild fan-out blocks work | **FAIL** (1–2s incremental) |
| Prerequisites A1–A5 | **PARTIAL** (A5 pending Phase 70) |

## Future Execution

If triggers fire, execute [`71-02-PLAN.md`](./71-02-PLAN.md):

- Extract `rlm-ports` + `rlm-domain` workspace members
- Preserve `rlm_core::` public API for `rlm-cli` and Tauri
- Resolve `ports → domain::types` coupling during split (D-03)

Prerequisite: Phase 70 `scripts/check-rust-boundaries.sh` must stay green before hardening crate boundaries.

## REG-02 Gate

Targeted compile gate used (full workspace suite deferred to milestone close):

```bash
cargo check -p rlm-core -p rlm-cli
```

## ARCH-06 Closure

ARCH-06 satisfied via **evaluated defer** — requirement calls for evaluation, not mandatory split. See [`71-VERIFICATION.md`](./71-VERIFICATION.md).

---
*Phase: 71-optional-crate-split*  
*Path: defer (71-03)*  
*Completed: 2026-05-22*
