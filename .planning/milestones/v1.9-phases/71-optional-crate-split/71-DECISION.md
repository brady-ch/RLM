---
decision: DEFER
phase: 71-optional-crate-split
plan: 01
blocked_on: Phase 70
next_plan: 71-03
---

# Phase 71 Split vs Defer Decision

## Summary

**Decision: DEFER** — execute `71-03-PLAN.md` (defer closure), not `71-02-PLAN.md` (crate split).

Phase 69 prerequisites are met (`69-VERIFICATION.md` and plan summaries exist). Phase 70 prerequisites are **not** met: no `70-01-SUMMARY.md`, `70-02-SUMMARY.md`, or `70-VERIFICATION.md`; `scripts/check-rust-boundaries.sh` is absent. Per D-02 gate protocol, baseline measurement is not authoritative until Phase 70 completes.

Even when Phase 70 lands, pre-planning and post-Phase-69 probe metrics indicate compile iteration is well below seed split thresholds. Split would add type-coupling overhead (ports→domain DTOs) without compile benefit at current scale.

## Metrics

Authoritative baseline captured in [`71-BASELINE.md`](./71-BASELINE.md) (2026-05-22):

| Measurement | Wall seconds | Split threshold |
|-------------|-------------:|-----------------|
| Clean build | 7 | N/A |
| Incremental domain | 2 | >30s sustained |
| Incremental ports | 1 | >30s sustained |
| Incremental application | 1 | >30s sustained |
| Test iteration (lib) | 8 | >120–180s |

> Phase 70 (A5 boundary script) still pending — re-run baseline after Phase 70 for final authoritative record.

## Trigger Evaluation

Seed conditions from `.planning/seeds/rust-crate-split.md`:

| Trigger | Threshold | Status | Evidence |
|---------|-----------|--------|----------|
| Full `rlm-core` test suite routinely >2–3 min | >120–180s wall | **FAIL** (no split trigger) | Lib tests: 8s (71-BASELINE.md) |
| Single-crate rebuild fan-out blocks unrelated module work | Incremental edits >30s sustained | **FAIL** (no split trigger) | Domain 2s, ports 1s, application 1s |
| Prerequisites A1–A5 complete | Phase 64 + 70 green | **PARTIAL** | Phase 69 ✅; Phase 70 ❌ (A5 boundary script pending) |

## Recommendation

**DEFER** crate extraction. Re-evaluate when:

- Phase 70 completes and authoritative baseline is captured
- `cargo test -p rlm-core` wall time exceeds **180s** sustained on dev hardware
- Incremental domain edit rebuild exceeds **30s** sustained
- `rlm-core` LOC exceeds ~20k or merge conflicts on unrelated modules increase

## Next Plan

Execute **`71-03-PLAN.md`** — defer closure with baseline capture, verification doc, and ARCH-06 traceability update.
