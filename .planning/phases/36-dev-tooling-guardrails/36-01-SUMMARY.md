---
phase: 36-dev-tooling-guardrails
plan: "01"
subsystem: testing
tags: [eslint, prettier, typescript-eslint, flat-config]

requires:
  - phase: —
    provides: —
provides:
  - ESLint 10 flat config for backend and UI TypeScript trees
  - Prettier 3 with check/write npm scripts and ignore rules
  - Lint script uses ESLint (no longer aliases typecheck)

affects:
  - Phase 37+ (maintainers run lint/format/check before refactors)

tech-stack:
  added:
    - eslint ^10
    - @eslint/js
    - typescript-eslint
    - prettier ^3
    - eslint-config-prettier
    - globals
  patterns:
    - "Separate parserOptions.project for root tsconfig vs ui/tsconfig"
    - "Unused binds ignore ^_ prefix for tests and mocks"

key-files:
  created:
    - eslint.config.js
    - .prettierrc.json
    - .prettierignore
  modified:
    - package.json
    - package-lock.json
    - tests/recursive-language-model.test.ts

key-decisions:
  - "Used typescript-eslint recommended (non-type-aware strict) plus eslint-config-prettier for a quiet first baseline."
  - "Mass Prettier formatting applied in commit isolated from configs (see style commit)."
  - "`ui/src` linted separately with ui/tsconfig.json; `tests/**/*.ts` use root tsconfig."

patterns-established:
  - "`npm run lint` → eslint; typecheck stays `npm run typecheck`."

requirements-completed:
  [TOOL-01, TOOL-02]

duration: unknown
completed: 2026-05-22
---

# Phase 36 Plan 01: ESLint + Prettier Summary

**ESLint 10 flat config with typescript-eslint and Prettier 3 wired for `src/`, `tests/`, and `ui/src/` with eslint-config-prettier disabling stylistic clashes.**

## Performance

- **Tasks:** 3
- **Files modified:** Config and lockfile tooling; codebase-wide formatting in separate style commit.

## Accomplishments

- Installed ESLint 10, typescript-eslint, Prettier 3, eslint-config-prettier, and globals; `npm run lint` runs ESLint over `src`, `tests`, and `ui/src`.
- Added `.prettierrc.json`, `.prettierignore`, `format` / `format:check` scripts.
- Narrow ESLint tweak: underscore-prefixed unused parameters allowed; mock `LanguageModelPort` in recursive-language-model test renamed unused `options` to `_options`.

## Task Commits

1. **Task 1–3:** Tooling, configs, and scripts — recorded in repo `chore(36-tooling)` commit hash after push.
2. **Formatting:** Dedicated `style(36-tooling)` commit applying Prettier only.

## Deviations from Plan

### Auto-fixed Issues

None beyond ESLint `_options`/argsIgnorePattern calibration for existing tests.

## Known Stubs

None introduced by this plan.

## Self-Check: PASSED

- `eslint.config.js`, `.prettierrc.json`, `.prettierignore` exist.
- `npm run lint` and `npm run format:check` verified green before final `npm run check`.
