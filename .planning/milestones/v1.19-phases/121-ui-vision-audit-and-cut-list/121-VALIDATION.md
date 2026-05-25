---
phase: 121
slug: ui-vision-audit-and-cut-list
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-24
---

# Phase 121 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner + tsx import |
| **Config file** | none — `node --import tsx --test tests/ui` |
| **Quick run command** | `node --import ./scripts/test-ram-preload.mjs --import tsx --test tests/ui/cut-list-completeness.test.ts` |
| **Full suite command** | `node --import ./scripts/test-ram-preload.mjs --import tsx --test tests/ui` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run grep-based verify from plan `<verify><automated>` blocks
- **After plan 121-02 (wave 2):** Run cut-list-completeness test
- **Before `/gsd-verify-work`:** Cut list file exists; completeness test green; `git diff --quiet ui/src/`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 121-01-01 | 01 | 1 | Inventory scaffold | T-121-01 | Accurate file counts from find/wc | doc | `test -f .../121-CUT-LIST.md && grep audit-only` | ✅ | ⬜ pending |
| 121-01-02 | 01 | 1 | All surfaces scored | T-121-01 | 26 verdict rows (25 tsx + CSS) | doc | `grep -cE '\| (Keep\|Demote\|Delete) \|' ... \| awk '$1 >= 26'` | ✅ | ⬜ pending |
| 121-01-03 | 01 | 1 | Summary + cross-refs | T-121-02 | No ui/src edits | doc | `grep Summary && git diff --quiet ui/src/` | ✅ | ⬜ pending |
| 121-02-01 | 02 | 2 | Completeness test | T-121-03 | All auditable files in cut list | static | `node --import ... --test tests/ui/cut-list-completeness.test.ts` | ❌ W0 | ⬜ pending |
| 121-02-02 | 02 | 2 | Bundle baseline | — | Baseline recorded for Phase 127 | doc | `grep '### Bundle baseline'` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/ui/cut-list-completeness.test.ts` — created in plan 121-02 Task 1
- [ ] `.planning/phases/121-ui-vision-audit-and-cut-list/121-CUT-LIST.md` — created in plan 121-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verdict rationale quality | Roadmap SC-2 mandatory surfaces | Subjective vision alignment | Review ### Mandatory scored surfaces table for coherent one-line rationales |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-24
