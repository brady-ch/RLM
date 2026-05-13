---
phase: 10
slug: cross-platform-executable-packaging-and-install-ux
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-11
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | none — uses `dist/tests/*.test.js` |
| **Quick run command** | `npm run build && node --test --test-concurrency=4 dist/tests/*.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30–120s (environment-dependent) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` (and targeted tests when tests touched)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite green on executor machine
- **Max feedback latency:** 120s (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | DIST-01 | T-10-01 / — | Packaging scripts do not download unverified binaries without checksum gate | script | `npm run build && npm run build:ui` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | DIST-01 | T-10-02 | CI matrix secrets not echoed in logs | CI | workflow dry-run | ✅ | ⬜ pending |
| 10-02-01 | 02 | 1 | DIST-02 | T-10-03 | Path resolution stays under home + cwd scopes | unit | `npm test` | ✅ | ⬜ pending |
| 10-02-02 | 02 | 1 | DIST-03 | T-10-04 | No silent privileged install | unit + manual | `npm test` + UAT | ✅ | ⬜ pending |

---

## Wave 0 Requirements

- Existing `npm test` and TypeScript build cover Wave 0 — no new framework install.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Packaged binary launches on target OS | DIST-01 | CI may not cover all host OS | Build artifact locally or from CI; double-click / run `rlm`; expect `--help` exit 0 |
| First-run UI path without editing YAML | DIST-03 | Browser + human readability | Install fresh; choose UI; confirm browser opens and sample graph visible |

---

## Validation Sign-Off

- [x] All tasks have `<verify>` or manual table entries
- [x] Sampling continuity maintained
- [x] No watch-mode flags
- [ ] `nyquist_compliant: true` set after wave green

**Approval:** pending
