---
phase: "10"
plan: "10-01"
completed: "2026-05-12"
requirements_addressed:
  - DIST-01
---

## Outcome

Automated `npm run package:build` stages `dist/release/<platform-arch>/` with mirrored `dist/` output, `ui-dist/` assets, and `rlm`/`rlm.cmd` shims. CLI resolves UI assets via `RLM_UI_DIST`, packaged `ui-dist/`, or repo `ui/dist`.

## Key files

- `scripts/packaging/build-release.mjs`
- `src/cli/ui-dist-dir.ts`
- `src/index.ts` (wired resolver)
- `.github/workflows/package-smoke.yml`
- `package.json` (`package:build` / `package:smoke`)

## Verification

- `npm run package:build`
- `npm test`

## Self-Check: PASSED
