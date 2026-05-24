# Phase 111: Builtin Shell Test Extraction - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Extract inline tests from `plugins/builtin/shell.rs` to mirrored `crates/rlm-core/tests/plugins/` tree. Zero inline test bodies after extraction.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Follow Phase 110 write_file pattern. Path depth: `src/plugins/builtin/` is 3 levels below crate root — stub path uses `../../../tests/plugins/builtin/shell.rs`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `crates/rlm-core/src/plugins/builtin/shell.rs` — 194 lines, tests from line 179
- Phase 110: `tests/plugins/builtin/write_file.rs` pattern with 3-level #[path] stub

### Tests to Extract
- `rejects_blocked_operators` — validates pipe operator rejection
- `allows_allowlisted_command` — validates pwd allowlist acceptance

</code_context>

<specifics>
## Specific Ideas

No specific requirements — test extraction only.

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
