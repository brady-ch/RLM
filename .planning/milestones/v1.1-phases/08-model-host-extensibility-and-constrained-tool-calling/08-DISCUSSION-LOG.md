# Phase 8: Model Host Extensibility and Constrained Tool Calling - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 8-Model Host Extensibility and Constrained Tool Calling
**Areas discussed:** Host config contract and precedence, Routing semantics across tiers and nodes, Constrained tool-calling envelope strategy per host

---

## Host config contract and precedence

| Option | Description | Selected |
|--------|-------------|----------|
| `hosts` map keyed by host id | Reusable global host definitions with typed fields per host kind | ✓ |
| Flat per-tier host fields | Simpler file shape but duplicates host config | |
| Hybrid map + inline one-off hosts | Flexible but adds complexity and ambiguity | |

**User's choice:** `hosts` map keyed by host id
**Notes:** Preferred reusable host catalog model.

| Option | Description | Selected |
|--------|-------------|----------|
| `CLI > env > config > defaults` | CLI strongest override | |
| `env > CLI > config > defaults` | Ops-managed environment takes precedence | ✓ |
| Strict conflict error | Reject conflicting values and stop run | |

**User's choice:** `env > CLI > config > defaults`
**Notes:** Environment-managed deployment precedence preferred.

---

## Routing semantics across tiers and nodes

| Option | Description | Selected |
|--------|-------------|----------|
| Fail node immediately | No runtime recovery path | |
| Fallback to backup host | Automatic fallback with warning | |
| Pause for user decision | Explicit runtime decision at checkpoint | ✓ |

**User's choice:** Pause for user decision
**Notes:** Avoid silent routing changes.

| Option | Description | Selected |
|--------|-------------|----------|
| Retry/switch/abort | Full operational control at checkpoint | ✓ |
| Retry only | Keep host fixed during paused run | |
| Abort only | Require relaunch for host changes | |

**User's choice:** Retry same host, switch allowed host, or abort
**Notes:** Explicit operator control required during outages.

---

## Constrained tool-calling envelope strategy per host

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter-owned enforcement | Each host adapter enforces constrained envelope semantics | ✓ |
| Central generic enforcement | Single domain-layer envelope for all hosts | |
| Hybrid central + adapter | Mixed enforcement responsibilities | |

**User's choice:** Adapter-owned per host
**Notes:** Shared contract/events should still align behavior.

| Option | Description | Selected |
|--------|-------------|----------|
| Hard fail if unsupported | No degraded execution path | |
| Explicit opt-in degraded mode | Allow only when configured; warning/audit required | ✓ |
| Always auto-degrade | Convenience over strictness | |

**User's choice:** Explicit opt-in degraded mode with warning/audit
**Notes:** Degradation must never be implicit.

| Option | Description | Selected |
|--------|-------------|----------|
| Two-step Ollama round | Constrained selection pass + executable tool call pass | ✓ |
| Disable constrained mode with tools | Sacrifice constraints for compatibility | |
| Disallow tool rounds in constrained mode | Hard incompatibility | |

**User's choice:** Two-step Ollama round with explicit trace markers
**Notes:** Preserve both constraints and tool execution semantics.

---

## the agent's Discretion

- Exact schema keys and naming conventions for host definitions.
- Event code namespace for degraded-mode warnings and two-step round markers.

## Deferred Ideas

- Typed artifact contracts + external run-state continuity (Phase 8.5).
- Chat-first clarification UX policies (Phase 9).
