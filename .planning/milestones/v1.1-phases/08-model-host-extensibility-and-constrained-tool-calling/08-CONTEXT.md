# Phase 8: Model Host Extensibility and Constrained Tool Calling - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver configurable local and remote model hosts with consistent runtime routing semantics, and enforce host-appropriate constrained tool-calling envelopes for tool selection and arguments (HOST-01, TCON-01), including explicit handling for Ollama `tools` + `format` constraints.

</domain>

<decisions>
## Implementation Decisions

### Host configuration contract and precedence
- **D-08-01:** Use a YAML `hosts` map keyed by host id (for example `local_ollama`, `remote_http`) with typed fields per host kind.
- **D-08-02:** Conflict precedence is `env > CLI > config > defaults`.

### Routing semantics and host unavailability behavior
- **D-08-03:** If requested host is unavailable at runtime, pause execution for explicit user decision instead of silent fallback.
- **D-08-04:** Unavailable-host checkpoint options are: retry same host, switch to another allowed host, or abort run.

### Constrained tool-calling envelope behavior
- **D-08-05:** Constrained tool-calling enforcement is adapter-owned per host; shared contracts/events define required envelope behavior across adapters.
- **D-08-06:** Unconstrained degraded mode is opt-in only via explicit config (for example `allow_unconstrained_tool_calls: true`) and must emit warning/audit events.
- **D-08-07:** Ollama path uses a two-step tool round: constrained selection pass followed by executable tool call pass, with explicit trace markers.

### the agent's Discretion
- Exact host schema field names and discriminators per host kind.
- Whether allowed-host switching scope is tier-bound only or additionally constrained by node-level allowlists.
- Exact warning/audit code taxonomy for degraded tool-calling mode.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and phase scope
- `.planning/REQUIREMENTS.md` — HOST-01 and TCON-01 requirement definitions and v1.1 traceability
- `.planning/ROADMAP.md` — Phase 8 goal, constraints, and success criteria
- `.planning/PROJECT.md` — milestone v1.1 scope and non-silent-failure product stance

### Prior locked decisions this phase builds on
- `.planning/phases/06-extension-and-plugin-foundation/06-CONTEXT.md` — extension-registration constraints for new host adapters
- `.planning/phases/07-mcp-and-skills-interoperability/07-CONTEXT.md` — explicit pause/recovery and auditable runtime behavior norms

### Host/tool-calling design references
- `.planning/research/TOOL-CALLING-CONSTRAINED-DECODING.md` — constrained decoding strategy and host-specific implications

### Existing implementation touchpoints
- `src/application/project-config.ts` — config parsing/resolution integration point
- `src/application/model-provider.ts` — purpose/tier routing integration point
- `src/domain/recursive-language-model.ts` — recursive tool round orchestration boundary
- `src/adapters/ollama-language-model.ts` — Ollama host-specific constrained calling behavior

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/application/model-provider.ts`: existing routing abstraction to extend with host selection semantics.
- `src/application/project-config.ts`: established YAML resolution and runtime-config normalization path.
- `src/adapters/ollama-language-model.ts`: concrete host adapter to evolve for two-step constrained tool rounds.

### Established Patterns
- Ports/adapters separation keeps host-specific behavior in adapters while preserving domain orchestration boundaries.
- Config-driven runtime behavior via `rlm.config.yaml` and resolved runtime config is already an established repo convention.

### Integration Points
- Add host definitions and resolution policy to project config schema and resolver.
- Thread effective host/endpoint metadata through node execution events and JSON stream output.
- Introduce adapter-level constrained envelope contracts without changing `LanguageModelPort` shape unless strictly required by Phase 8 criteria.

</code_context>

<specifics>
## Specific Ideas

- Host declarations should be reusable by id and not duplicated per tier block.
- Unavailable host handling should stop and ask explicitly rather than auto-degrading behavior.
- Ollama constrained tool calling should be explicit and traceable as two distinct sub-steps.

</specifics>

<deferred>
## Deferred Ideas

- Full typed artifact contracts and stateful workflow continuity remain Phase 8.5 scope.
- Chat-first clarification UX remains Phase 9 scope.

</deferred>

---

*Phase: 8-Model Host Extensibility and Constrained Tool Calling*
*Context gathered: 2026-05-10*
