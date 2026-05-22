---
phase: 39-adapters-tools-taxonomy
subsystem: adapters
completed_date: 2026-05-22
requirements_completed:
  - ADPT-01
  - ADPT-02
  - ADPT-03
  - ADPT-04
  - ADPT-05
  - ADPT-06
key-files:
  created:
    - src/adapters/index.ts
    - src/application/bootstrap/adapters.ts
    - .planning/phases/39-adapters-tools-taxonomy/39-01-PLAN.md
  modified:
    - src/adapters/tools/*
    - src/adapters/persistence/*
    - src/adapters/models/*
    - src/application/bootstrap/index.ts
    - AGENTS.md
    - dependency-cruiser-baseline.json
metrics:
  npm_test_count: 211
decisions:
  - `in-memory-trace` joins `adapters/persistence/` as the trace-store adapter alongside file-backed stores (taxonomy is tools | persistence | models).
  - Bootstrap exports concrete store/embedding classes from `application/bootstrap/index.ts` for the CLI entry path; other application code imports the `adapters/index.js` barrel or `adapters/tools/*` from extension shims.
---

# Phase 39: Adapters & Tools Taxonomy — Summary

**One-liner:** Flat `src/adapters/*` split into `tools/`, `persistence/`, and `models/` with a root barrel, bootstrap adapter re-exports, and extension shims pointing at `adapters/tools/*` — no behavioral change; `npm run check` green at 211 tests.

## Plans executed

### 39-01 — Executable plan + taxonomy execution

`39-01-PLAN.md` committed first; implementation moves files with `git mv`, fixes port-relative imports, adds `src/adapters/index.ts` and `src/application/bootstrap/adapters.ts`, rewires `src/index.ts` to import session/memory stores from `application/bootstrap/index.js`, aligns `runtime-composition` and tests to the barrel, updates `AGENTS.md` and depcruise baseline `from` path for `web-fetch-tool`.

## Commits

| Hash (short) | Message |
| ------------ | ------- |
| `609a775` | docs(39-01): add adapters taxonomy executable plan |
| `9a1a732` | chore(39-01): group adapters into tools, persistence, models |

## Deviations from plan

None beyond noted decisions (trace adapter placement).

## Known stubs

None introduced.

## Threat flags

None new; `web-fetch-tool` → `application/content-tree` coupling remains a known depcruise waiver (baseline path updated).

## Self-Check: PASSED

- `39-SUMMARY.md` and `39-VERIFICATION.md` present under `.planning/phases/39-adapters-tools-taxonomy/`.
- Commits `609a775`, `9a1a732` on branch history.
- `npm run check` executed with exit 0 (see verification doc).
