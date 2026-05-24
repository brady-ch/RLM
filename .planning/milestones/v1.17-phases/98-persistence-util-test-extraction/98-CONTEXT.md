# Phase 98: Persistence Util Test Extraction - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Extract inline tests from `persistence/util.rs` to mirrored `crates/rlm-core/tests/persistence/` tree. Zero inline test bodies after extraction.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Follow v1.14–v1.16 `#[path]` stub pattern from domain/application test extraction. Match existing `tests/application/config/loader.rs` stub on persistence loader. Keep `sanitize_id` and helper functions testable via stub without widening visibility.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `crates/rlm-core/src/persistence/util.rs` — inline `#[cfg(test)] mod tests` at line 81
- `crates/rlm-core/tests/application/config/loader.rs` — `#[path]` stub reference pattern
- Phase 90 domain extraction — established mirrored test tree pattern

### Established Patterns
- `#[path = "../../../tests/persistence/util.rs"]` stub in source module
- Tests mirror source concern under `tests/persistence/`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure test extraction phase.

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
