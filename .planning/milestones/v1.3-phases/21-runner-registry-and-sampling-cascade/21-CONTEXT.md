# Phase 21: Runner Registry and Sampling Cascade - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 21 formalizes model runners as adapter-backed runtime selections and implements the sampling cascade needed by the desktop product: global defaults, per-model profiles, and per-node overrides must merge before model completion, while existing CLI/YAML model host behavior remains compatible.

</domain>

<decisions>
## Implementation Decisions

### Runner Boundary
- Keep `LanguageModelPort` as the completion boundary and add runner metadata/config around it instead of replacing the port.
- Preserve existing `hosts` YAML compatibility; layer runner registry/profile concepts without forcing a breaking migration.
- Centralize runtime/model/sampling selection in `PurposeRoutingLanguageModel` or a dedicated resolver it calls.
- Phase 21 ships Ollama and HTTP only; design extension points for later llama.cpp, vLLM, and cloud runners.

### Sampling Cascade
- Add optional first-pass sampling fields: `temperature`, `topP`, `topK`, `repeatPenalty`, `maxTokens`, and `seed`.
- Omit unsupported adapter parameters where necessary and surface visible warning/degraded metadata rather than silently ignoring important configuration.
- Store effective sampling values and source-layer metadata in response, trace, and node metadata where the runtime already records model selection.
- Precedence is node override > model profile > global defaults > adapter default.

### UI/API Surface
- Phase 21 should expose enough API and minimal UI inspector/settings fields to prove cascade behavior before the full model library arrives in Phase 22.
- Persist global settings in project/config scope and node overrides in session graph node fields; make model profile schema ready for Phase 22.
- Prioritize unit tests for resolver/config/adapters and focused UI source assertions for controls and metadata.
- Runner unavailability and unsupported required sampling must produce explicit structured errors; no fallback to a different model or runner.

### the agent's Discretion
The agent may choose exact type names, resolver boundaries, and storage layout as long as existing CLI/YAML behavior remains backward-compatible and the cascade/source metadata is test-visible.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LanguageModelPort` and `LanguageModelCompleteOptions` in `src/ports/language-model-port.ts` are the completion boundary.
- `PurposeRoutingLanguageModel` in `src/application/model-provider.ts` already centralizes purpose-to-tier model selection, host selection, selection logging, and override resolution.
- `ProjectConfig` and Zod schema in `src/application/project-config.ts` already define `hosts`, model tiers, agent models, and runtime config defaults.
- `createModelFactory` in `src/application/runtime-composition.ts` already instantiates Ollama vs HTTP adapters from runtime host selection.
- UI node inspector in `ui/src/main.tsx` already displays model trail and supports node-level model overrides.

### Established Patterns
- Host selection is strict: unavailable selected hosts raise explicit errors unless a caller supplies an unavailable-host decision.
- Model override behavior is represented on graph nodes with `modelOverride`, `modelOverrideSource`, `plannedModel`, and `effectiveModel`.
- Runtime traces and CLI render output already surface model and host metadata rather than hiding fallback behavior.
- Config parsing uses Zod defaults and transforms to keep old config files working.

### Integration Points
- Extend `LanguageModelCompleteOptions` for sampling input and `LanguageModelResponse` for effective sampling/warning output.
- Add config schema for global sampling defaults and per-model profile entries in `ProjectConfig`.
- Add cascade resolution to `PurposeRoutingLanguageModel.complete` before delegating to adapters.
- Pass supported sampling options into `OllamaLanguageModelAdapter` and `HttpLanguageModelAdapter`; record unsupported/degraded metadata.
- Extend execution graph node metadata, control-server API/session state, UI inspector, and CLI render surfaces where model metadata is already exposed.

</code_context>

<specifics>
## Specific Ideas

- The default desktop path should hide runner complexity, while advanced panels may name Ollama and later runner kinds.
- Ollama remains the only managed runner for v1.3; multi-runner expansion is captured in `.planning/seeds/multi-runner-adapters.md`.
- Phase 21 should not implement Tauri packaging or the model library download UX; those belong to Phases 22 and 23.

</specifics>

<deferred>
## Deferred Ideas

- Direct llama.cpp/vLLM runners and direct GGUF management.
- Full model catalog UI and Hugging Face compatibility/download workflows.
- Tauri process lifecycle, installers, and cross-platform smoke packaging.

</deferred>
