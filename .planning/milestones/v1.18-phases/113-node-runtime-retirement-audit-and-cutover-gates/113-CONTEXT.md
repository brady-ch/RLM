# Phase 113: Node Runtime Retirement Audit and Cutover Gates - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped in autonomous --auto mode)

<domain>
## Phase Boundary

Inventory TS-only paths; define per-layer verification gates; flip default runtime to Rust. This phase is audit-and-gates only — no deletion of TS layers yet (that begins Phase 114).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Follow `.planning/notes/rust-only-runtime-migration-decisions.md` for teardown order and verification gates.

Key constraints from migration decisions:
- Incremental teardown: control server → CLI/composition → application → domain/ports → adapters/plugins → npm toolchain → constrained envelope
- Keep `ui/`, `scripts/`, `crates/`; prune Node-specific scripts per phase
- Golden fixtures (`control_server_matches_golden_fixtures`) are sole HTTP contract gate post-114
- Default `RLM_RUNTIME` must flip from `node` to `rust` in `scripts/rlm-runtime.mjs`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/rlm-runtime.mjs` — runtime dispatcher (currently defaults to `node`)
- `.planning/notes/rust-only-runtime-migration-decisions.md` — authoritative teardown order and gates
- Rust golden fixtures in `crates/rlm-core` for control server parity
- `RLM_RUNTIME=rust` already functional for ask/ui paths

### Established Patterns
- Strangler pattern: dual runtime via env var until cutover complete
- Per-phase verification: `cargo test -p rlm-core` green after each deletion step
- Phase artifacts live under `.planning/phases/113-*/`

### Integration Points
- `package.json` bin entry points through `scripts/rlm-runtime.mjs`
- CI scripts may reference TS server boot — inventory needed
- Tauri uses in-process Rust server (no Node child)

</code_context>

<specifics>
## Specific Ideas

Deliverables:
1. TS-only path inventory with deletion order (can extend migration note or separate audit doc in phase dir)
2. Flip default in `scripts/rlm-runtime.mjs` to `rust`
3. Per-phase verification gates documented in migration note
4. Document Rust golden fixtures as sole HTTP contract gate post-114

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
