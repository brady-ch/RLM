# Phase 7: MCP and Skills Interoperability - Discussion Log

> **Audit trail only.** Do not use as planning input; canonical decisions are in `07-CONTEXT.md`.

**Date:** 2026-05-10
**Phase:** 7-MCP and Skills Interoperability
**Areas discussed:** MCP server policy, skill loading behavior, shared event schema, outage/recovery telemetry

---

## MCP server policy

| Option | Description | Selected |
|--------|-------------|----------|
| Global runtime flags | One policy for all servers | |
| Per-server in YAML | `required: true|false` per server entry | ✓ |
| Both | Per-server + global override | |

**User's choice:** Per-server policy in `rlm.config.yaml`.

### Disconnect behavior

| Case | Options considered | Selected |
|------|--------------------|----------|
| Optional server disconnect | fail / pause-and-continue-on-reconnect / retry-then-degrade | Pause at checkpoint; continue on reconnect |
| Required server disconnect | fail / pause-indefinitely / pause-with-timeout | Pause indefinitely |

---

## Skill interoperability

| Area | Options considered | Selected |
|------|--------------------|----------|
| Search layout | fixed path / parity mode / ordered configurable paths | Ordered configurable paths |
| Duplicate name resolution | first match / error / namespace required | First match by path order |
| Caching | always off / always on / configurable | Configurable |
| Parse/validation strictness | global strict / global lenient / per-path strictness | Per-path strictness |

**Lenient mode handling:** CLI warning + structured run-trace event + persisted audit warning.

---

## Shared warning/audit event schema

| Area | Options considered | Selected |
|------|--------------------|----------|
| Event domain | skill-only / broad MCP+skill / staged extension | Broad MCP+skill |
| Severity encoding | enum / numeric / both | Enum only (`info|warn|error`) |
| Machine code requirement | required / optional / required only for warn+error | Required for all events |
| Event identity | UUID only / deterministic hash only / both | Both |
| Time ordering | timestamp only / timestamp + seq / local wall-clock | UTC timestamp + per-run monotonic seq |
| Seq allocation | central atomic / local+merge / block allocation | Central atomic |
| Store outage behavior | pause / local buffer / degraded ordering | Pause |
| Pause severity progression | fixed error / fixed warn / duration escalation | Duration escalation |

### Escalation/recovery policy

- `warn` at 10s; `error` at 60s
- Emit explicit `RECOVERED` event on reconnect, reset flow to `info`
- `RECOVERED` events: always verbose metrics
- Escalation events: also always verbose metrics
- Warning persistence: state store canonical + local export

### Required escalation metrics

- `outage_duration_ms`
- `events_blocked_count`
- `current_pause_reason`
- `last_successful_seq`
- `affected_nodes` (id + node type/model assignment)
- `pending_checkpoint_count` (all paused edges including system/internal)

---

## Deferred to downstream phases

- Phase 8: host-specific constrained decoding semantics
- Phase 8.5: typed artifact + external run-state contracts for media pipelines
- Phase 9: chat-first graph authoring UX details
