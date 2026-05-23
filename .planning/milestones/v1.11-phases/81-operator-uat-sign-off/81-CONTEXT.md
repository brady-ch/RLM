# Phase 81 Context: Operator UAT Sign-off

**Phase:** 81 — Operator UAT Sign-off  
**Milestone:** v1.11 UI Product Hardening  
**Requirements:** REG-01

## Goal

Close REG-01 by having an operator complete the merged browser UAT checklist on the Rust-served UI (with live Ollama where applicable), record evidence, and ratchet verification to `passed`. Phases 77–80 landed interaction polish, shell boundaries, and first-run launcher — this phase consolidates those into an updated checklist without faking operator sign-off.

## Decisions

| Area | Decision |
|------|----------|
| Checklist | Canonical v1.11 checklist in `81-UAT.md` — extends Phase 72 items 1–10 with Phase 80 launcher rows 11–13 |
| Prior artifact | `72-UAT.md` remains historical; superseded by `81-UAT.md` for v1.11 operator runs |
| Operator stack | `npm run build:ui` → `RLM_UI_DIST=$PWD/ui/dist cargo run -p rlm-cli -- ui --port 0` |
| Server lifecycle | Document `--stop` / `--replace` per Phase 77 runbook |
| Model tiers | Operator assigns tiers in **Advanced → Models** before Plan/Run |
| Evidence | Per-row Result/Notes/Evidence columns; optional screenshots under `evidence/` |
| Autonomous executor | Preflight + HTTP smoke only; browser rows stay PENDING until operator signs |
| Verification ratchet | `81-VERIFICATION.md` stays `human_needed` until operator approves; REG-01 not marked Complete in REQUIREMENTS until sign-off |

## Out of scope

- Production code fixes discovered during UAT (gap closure follow-on)
- Full `npm run check` gate (targeted preflight per Phase 72 D-06 pattern)
- Auto-approving browser checklist rows

## References

- `.planning/milestones/v1.10-phases/72-human-uat-sign-off/72-UAT.md`
- `.planning/phases/80-first-run-launcher/80-VERIFICATION.md`
- `.planning/phases/77-interaction-polish/77-CONTEXT.md`
- `docs/UI.md`
- `crates/rlm-core/tests/reg01_uat_smoke.rs`
- `tests/ui/reg01-static-wiring.test.ts`
