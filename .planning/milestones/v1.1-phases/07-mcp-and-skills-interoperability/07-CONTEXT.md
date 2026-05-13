# Phase 7: MCP and Skills Interoperability - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver interoperable MCP server connectivity and skill loading that works with existing agent ecosystems while preserving existing non-MCP tool behavior (INT-01, INT-02).

This phase defines:
- MCP configuration and runtime disconnect behavior
- Skill search-path, duplicate resolution, and load strictness behavior
- Unified warning/audit event schema across MCP and skill lifecycle events

Out of scope here: host-level constrained tool-calling envelopes (Phase 8), typed artifact + state runtime (Phase 8.5), and chat-first graph authoring (Phase 9).

</domain>

<decisions>
## Implementation Decisions

### MCP policy model
- **D-07-01:** MCP server policy is configured per server in `rlm.config.yaml` with `required: true|false`.
- **D-07-02:** If an **optional** MCP server disconnects mid-run: pause at clarification checkpoint; continue when it reconnects.
- **D-07-03:** If a **required** MCP server disconnects mid-run: pause and wait indefinitely for reconnect.

### Skill interoperability behavior
- **D-07-04:** Skill lookup uses configurable ordered search paths (default includes current common layouts).
- **D-07-05:** Duplicate skill names resolve with first-match precedence by configured path order.
- **D-07-06:** Skill caching is configurable.
- **D-07-07:** Skill load strictness is configurable per skill path (`strict` / `lenient`).
- **D-07-08:** In lenient mode, invalid skills do not halt all loading; warnings must surface in CLI, structured run trace, and persisted audit records.

### Shared warning/audit event model (MCP + skill lifecycle)
- **D-07-09:** Event schema covers both skill-load events and MCP lifecycle events (connect/disconnect/reconnect).
- **D-07-10:** `severity` is enum-only: `info | warn | error`.
- **D-07-11:** Every event must include a stable machine code.
- **D-07-12:** Event identity uses both `event_id` UUID and deterministic fingerprint.
- **D-07-13:** Timestamps require UTC ISO-8601 plus per-run monotonic `seq`.
- **D-07-14:** `seq` allocation uses a central atomic counter in the state store.
- **D-07-15:** If state store is unavailable for event writes: pause run and wait for recovery (no degraded ordering mode).
- **D-07-16:** Outage severity escalates by duration thresholds:
  - warn at 10s
  - error at 60s
- **D-07-17:** On recovery, emit explicit `RECOVERED` event and reset severity flow to `info`.
- **D-07-18:** `RECOVERED` events always emit verbose impact metrics.
- **D-07-19:** Escalation events (`info→warn`, `warn→error`) must also emit verbose metrics:
  - `outage_duration_ms`
  - `events_blocked_count`
  - `current_pause_reason`
  - `last_successful_seq`
  - `affected_nodes` (node id + node type/model assignment)
  - `pending_checkpoint_count` (all paused edges, including system/internal)
- **D-07-20:** Warning persistence is dual-sink:
  - canonical in runtime state store
  - exported to local file for offline/debug use

</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — INT-01, INT-02 and adjacent ARTF-01 context
- `.planning/ROADMAP.md` — Phase 7 success criteria + downstream phase boundaries
- `.planning/notes/hybrid-artifact-state-architecture.md` — continuity/runtime constraints influencing event model interoperability
- `.planning/phases/06-extension-and-plugin-foundation/06-CONTEXT.md` — extension host and config decisions this phase builds on

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `src/application/extension-host.ts` — current extension lifecycle and registries
- `src/application/project-config.ts` — current YAML parsing path for extension config
- `src/index.ts` — composition root and tool wiring path used by runtime

### Integration points
- Config schema expansion for MCP/skill interoperability policies
- Runtime event emission path for structured lifecycle events
- Skill discovery/loader attachment point using extension architecture from Phase 6

</code_context>

<specifics>
## Specific Ideas

- Interoperability must remain compatible with other agent skill ecosystems.
- Runtime behavior should support operationally safe long-running workflows with explicit and auditable pause/recovery semantics.

</specifics>

<deferred>
## Deferred Ideas

- Host-specific constrained decoding semantics (Phase 8).
- Typed artifact + state runtime contracts for media pipelines (Phase 8.5).
- Chat-first graph UX and clarification authoring model (Phase 9).

</deferred>

---

*Phase: 7-MCP and Skills Interoperability*
*Context gathered: 2026-05-10*
