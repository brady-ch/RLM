# Hybrid Artifact + State Architecture

**Date:** 2026-05-10  
**Context:** `$gsd-explore` on recursive, node-based text-to-audio workflow for full-book processing.

## Decision

Use a **hybrid continuity model**:
- Typed artifact schema on every node edge (contract between nodes)
- External run-state store for long-horizon continuity and resumability
- Code-only nodes are first-class: they validate/transform artifacts and can read/write approved state paths

Use **mutable, queryable state documents** with strict mutation guardrails:
- Optimistic concurrency (`version`/`etag` checks)
- Path-level mutation ACL per node type
- Append-only audit log for every mutation attempt

## Why

- Whole-book runs need consistent character/voice/style continuity across many segments.
- Artifact-only continuity grows too large and is difficult to patch globally.
- State-only continuity weakens replayability and edge-level determinism.
- Hybrid preserves deterministic handoffs while enabling scalable continuity memory.

## Baseline Contract

1. Node input includes typed artifact + state reference/version.
2. Node reads state snapshot at start.
3. Node writes scoped state patch only to allowed paths, with version check.
4. Node emits typed output artifact including upstream refs and the state version used.
5. Runtime records audit event for all write attempts (accepted/rejected).

## Initial State Partitioning

- **Artifact payload**: segment/chunk content, segment id, pipeline intent, upstream refs, validation metadata.
- **External state**: run-level continuity (`voice_profile`, `entity_map`, pronunciation rules, style constraints), progress/checkpoints, retries/errors.

## Compatibility Constraint

This runtime must stay compatible with skills/tooling used by other agents by exposing:
- Stable typed artifact schema versions
- Stable state API contract for read/patch/audit
- Explicit capability metadata for model-typed and code-only nodes
