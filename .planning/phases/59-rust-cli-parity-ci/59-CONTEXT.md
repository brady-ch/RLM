# Phase 59: Rust CLI + Parity CI - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — auto-accepted)

<domain>
## Phase Boundary

Expand Rust `rlm` binary for key CLI run modes, add `RLM_RUNTIME=node|rust` strangler switch, and wire golden fixture parity gate in CI.

</domain>

<decisions>
## Implementation Decisions

### CLI Subcommands
- `ui` (default), `ask` (stub), `plugin` (full surface), stubs for plan-node/workflow with actionable errors

### Runtime Switch
- `scripts/rlm-runtime.mjs` dispatches Node vs Rust based on `RLM_RUNTIME`
- npm scripts `rlm:node`, `rlm:rust`

### Parity Gate
- `npm run check:parity` runs TS integration fixtures + Rust fixture test + compare script

### Claude's Discretion
- Which run modes beyond ui/ask/plugin ship in v1.8 vs stub

</decisions>

<code_context>
## Existing Code Insights

- `crates/rlm-cli` — minimal ui-only entry before phase
- TS CLI: `src/index.ts`, `src/cli/run-modes/`
- Golden fixtures: `tests/fixtures/control-server/`

</code_context>

<specifics>
## Specific Ideas

None — standard strangler cutover path.

</specifics>

<deferred>
## Deferred Ideas

Full plan-only/workflow/session CLI parity — extend in follow-on if stubs insufficient.

</deferred>
