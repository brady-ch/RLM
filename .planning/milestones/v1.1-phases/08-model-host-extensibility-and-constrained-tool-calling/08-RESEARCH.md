# Phase 8: Model Host Extensibility and Constrained Tool Calling - Research

**Date:** 2026-05-10
**Phase:** 8
**Status:** Ready for planning

## Summary

Phase 8 should be implemented in two waves:
- Wave 1 establishes host configuration, precedence resolution, runtime host selection policy, and unavailable-host pause/checkpoint control flow.
- Wave 2 adds adapter-owned constrained tool-calling envelopes, explicit degraded-mode policy, Ollama two-step execution semantics, and observability surfaces in CLI/UI traces.

This split minimizes regression risk by separating routing substrate changes from constrained-decoding behavior changes.

## Existing System Findings

- `src/application/project-config.ts` already owns YAML parsing/normalization and is the safest place to add typed host config contract.
- `src/application/model-provider.ts` and agent/runtime wiring are the integration point for effective host resolution semantics.
- `src/domain/recursive-language-model.ts` coordinates tool rounds and is where host-capability handoff contracts must remain stable.
- `src/adapters/ollama-language-model.ts` is the first constrained-calling target and must encode the two-step `selection -> tool execution` protocol.

## Decision Constraints From Context

Must preserve decisions from `08-CONTEXT.md`:
- D-08-01..D-08-02: `hosts` map contract + precedence `env > CLI > config > defaults`
- D-08-03..D-08-04: unavailable host pauses run with retry/switch/abort choices
- D-08-05..D-08-07: adapter-owned constraints, opt-in degraded mode only, Ollama two-step path with explicit markers

## Risks and Mitigations

1. Risk: precedence logic conflicts with existing CLI assumptions.
- Mitigation: centralize resolution in config normalization, add focused tests for precedence matrix.

2. Risk: host fallback behavior accidentally becomes silent.
- Mitigation: emit explicit checkpoint events for every unavailable-host branch and require operator action.

3. Risk: constrained decoding introduces incompatible adapter behavior.
- Mitigation: define shared adapter envelope contract with capability flags; keep enforcement local per adapter.

4. Risk: Ollama tools/format mutual exclusion causes runtime regressions.
- Mitigation: represent two-step pass as explicit internal protocol with clear trace markers and tests.

## Recommended Plan Shape

- Plan 08-01 (Wave 1): host config + routing + unavailable-host checkpoint semantics.
- Plan 08-02 (Wave 2): constrained envelopes + Ollama two-step + observability + tests.

## Verification Priorities

- Build and test suite pass.
- Unit/integration coverage for precedence matrix, unavailable-host checkpoint options, degraded-mode gates, and Ollama two-step markers.
- CLI `--json-stream` and UI event payload include effective host/endpoint metadata (with safe redaction where needed).

## Completion Marker

## RESEARCH COMPLETE
