# Phase 37: Config Layer Split - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure/refactor phase — discuss skipped)

<domain>
## Phase Boundary

Split `src/application/project-config.ts` into focused modules under `application/config/` with a stable barrel facade. Preserve all import sites, validation error shapes, runtime host selection, tier resolution, model override, and starter seeding behavior. Add unit tests for config resolution modules.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices at Claude's discretion — pure refactor phase. Constraints:
- Modules: types/schema, defaults, loader, validation, runtime resolution, model override, starter seed
- Barrel re-export from `project-config.ts` or `application/config/index.ts` for backward compatibility
- No flag-day rename of ~20 import sites
- Validation errors keep file/path context
- `npm run check` must stay green (205+ tests)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Monolithic `src/application/project-config.ts` — config loading, zod validation, defaults, resolveRuntimeConfig, applyModelOverride, seedProjectRlmStarter
- Import sites across application/, cli/, index.ts

### Established Patterns
- Strict TypeScript, zod schemas in adapters/tools
- Phase 36 tooling: ESLint, Prettier, dependency-cruiser baselines active

### Integration Points
- CLI entry loads config via project-config
- Model provider uses tier resolution from config
- UI starter seed for first-run flows

</code_context>

<specifics>
## Specific Ideas

Follow CONF-01 through CONF-06 from REQUIREMENTS.md. Extract incrementally; verify behavior with unit tests before removing from monolith.

</specifics>

<deferred>
## Deferred Ideas

None — refactor stays within config layer boundary.

</deferred>
