# Phase 7: MCP and Skills Interoperability — Research

**Researched:** 2026-05-10  
**Domain:** MCP lifecycle policy, skill path interoperability, runtime event/audit contracts  
**Confidence:** HIGH

---

## Summary

Phase 7 should be implemented in two waves:

1. **Wave 1 (07-01)**: configuration and runtime policy surface for MCP servers and skill resolution
2. **Wave 2 (07-02)**: unified lifecycle events/audit schema, persistence, and operational pause/recovery behavior

The design should build directly on Phase 6 extension infrastructure:
- Keep configuration YAML-first in `project-config`
- Keep composition in `src/index.ts`
- Keep runtime orchestration in application layer, not domain contracts

`LanguageModelPort` remains unchanged in Phase 7.

---

## Locked Decisions Applied

- MCP policy is per-server in `rlm.config.yaml` with `required: true|false`.
- Optional MCP disconnect pauses with clarification and continues on reconnect.
- Required MCP disconnect pauses indefinitely for reconnect.
- Skill paths are configurable ordered search paths with first-match precedence.
- Skill caching is configurable.
- Skill strictness is configurable per path (`strict|lenient`).
- Lenient failures produce CLI + trace + persisted warnings.
- Shared event schema spans both MCP and skill lifecycle with required machine codes.
- Event identity uses both UUID + deterministic fingerprint.
- Event timing uses UTC + monotonic per-run `seq` from central atomic counter.
- Store outage pauses run; severity escalates at 10s/60s; recovery emits verbose metrics.

---

## Architecture Split

### Configuration and schema
- `src/application/project-config.ts`
  - Add MCP server config schema
  - Add skill resolution/search-path/caching config schema
  - Add event/audit policy defaults

### Runtime policy orchestration
- New runtime manager in `src/application/` for:
  - MCP server lifecycle state
  - Skill discovery/load policy
  - Shared lifecycle event emission
  - Pause/recovery state transitions

### Composition root wiring
- `src/index.ts`
  - Load config
  - Initialize MCP+skill interoperability manager
  - Merge MCP tools + local tools into the existing agent tool resolution path

### Test coverage
- Add focused integration tests for:
  - Required/optional disconnect behavior
  - Skill path precedence and strictness
  - Event schema correctness and sequence semantics
  - Outage escalation and recovery events

---

## Primary Risks and Mitigations

1. **Policy drift across MCP and skill paths**
   - Mitigation: single event schema + central policy handler in application layer
2. **Nondeterministic event ordering**
   - Mitigation: central atomic sequence allocation and hard pause on store outage
3. **Silent compatibility regressions for non-MCP tools**
   - Mitigation: explicit acceptance criteria + regression tests that default behavior is unchanged

---

## Recommendation

Produce two executable plans:
- `07-01-PLAN.md`: config schema + MCP/skill policy integration
- `07-02-PLAN.md`: event/audit system + pause/recovery semantics + tests + summary

Keep all behavior backward-compatible by default:
- Existing projects without MCP configuration continue to run as-is.
