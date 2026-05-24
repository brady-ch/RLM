# Phase 120: Constrained Ollama Tool Envelope (Rust) - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure — autonomous --auto)

<domain>
Implement constrained JSON-envelope tool calling in Rust Ollama adapter per TOOL-CALLING-CONSTRAINED-DECODING.md. Post-cutover hardening, not a blocker for prior phases.

</domain>

<decisions>
### Claude's Discretion
Follow `.planning/research/TOOL-CALLING-CONSTRAINED-DECODING.md` Option A. Add tests for envelope parsing/decoding in Rust.

</decisions>

<code_context>
Existing Rust two-phase Ollama path in crates/rlm-core/src/adapters/ollama_language_model/

</code_context>

<specifics>
ROADMAP: constrained tool envelope in Rust; tests pass; documented behavior.

</specifics>

<deferred>
None.
</deferred>
