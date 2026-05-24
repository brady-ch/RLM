# Phase 112: Builtin Web Tools Test Extraction - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Extract inline tests from `plugins/builtin/web_fetch.rs` and `plugins/builtin/web_search.rs` to mirrored `crates/rlm-core/tests/plugins/builtin/` tree. Zero inline test bodies after extraction.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Follow Phase 110 write_file test mirror pattern. Path depth: `src/plugins/builtin/` is 3 levels below crate root — stub path uses `../../../tests/plugins/builtin/`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `crates/rlm-core/src/plugins/builtin/web_fetch.rs` — `extracts_title_from_html` test ~line 194
- `crates/rlm-core/src/plugins/builtin/web_search.rs` — `builds_query_from_terms` test ~line 228
- Phase 110: `tests/plugins/builtin/write_file.rs` pattern with 3-level #[path] stub

</code_context>

<specifics>
## Specific Ideas

No specific requirements — test extraction only.

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
