# Phase 36: Dev Tooling Guardrails - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Maintainers have automated lint, format, and layer-boundary guardrails before large extraction diffs land. This phase adds ESLint 10 flat config, Prettier 3, dependency-cruiser baselines, and expands `npm run check` — with no intentional behavior changes to CLI, config, control-server, or graph/session flows.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Key constraints from requirements:
- ESLint 10 flat config with typescript-eslint for `src/` and `ui/src/`
- Prettier 3 with eslint-config-prettier; format-only changes isolated from logic refactors
- dependency-cruiser enforces AGENTS.md layer rules at warn severity with triaged baseline
- `npm run check` runs typecheck, lint, dependency-cruiser, and test once baselines green
- All existing tests must pass unchanged

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json` scripts: `check` currently runs typecheck + test only; `lint` aliases typecheck
- No ESLint, Prettier, or dependency-cruiser config exists yet
- `.planning/codebase/CONVENTIONS.md` documents strict TypeScript, ports/adapters boundaries, kebab-case files

### Established Patterns
- ESM with NodeNext, strict TS settings in tsconfig
- AGENTS.md defines layer rules: application/, domain/, ports/, adapters/, cli/
- Tests use `node:test` via `dist/tests/*.test.js` after build

### Integration Points
- CI gate is `npm run check` — extend here
- Layer boundaries documented in AGENTS.md map to dependency-cruiser rules

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Follow TOOL-01 through TOOL-04 and REG-01/REG-02 from REQUIREMENTS.md.

</specifics>

<deferred>
## Deferred Ideas

- ARCH-02 full dependency-cruiser error severity — ratchet incrementally during v1.6, not in this phase baseline

</deferred>
