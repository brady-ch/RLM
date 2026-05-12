---
phase: "10"
plan: "10-02"
completed: "2026-05-12"
requirements_addressed:
  - DIST-02
  - DIST-03
---

## Outcome

Config loads from `~/.rlm/` and `<cwd>/.rlm/` (with `config.yaml`, `agents/*.yaml`, `models/*.yaml`) layered on built-in defaults; project agents/tiers replace global entries by id. TTY launches show a numbered UI vs CLI chooser (skippable via env); non-TTY defaults to UI. First UI run without `rlm.config.yaml` seeds `<cwd>/.rlm/` with starter templates and logs to stderr.

## Key files

- `src/application/project-config.ts` — merge + `seedProjectRlmStarter`
- `src/cli/first-run.ts` — `resolveLaunchMode`, argv injection
- `src/index.ts` — wizard + seed + UI dist
- `src/cli/args.ts` — env docs, UI bootstrap prompt
- `tests/project-config-scopes.test.ts`

## Verification

- `npm test`

## Self-Check: PASSED
