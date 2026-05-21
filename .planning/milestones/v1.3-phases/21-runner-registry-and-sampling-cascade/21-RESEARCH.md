---
phase: 21
status: complete
generated: 2026-05-20
---

# Phase 21 Research: Runner Registry and Sampling Cascade

## Objective

Implement runner-adapter and sampling-cascade foundations for the desktop product while preserving existing CLI/YAML compatibility.

## Current Architecture

### Model Boundary

- `src/ports/language-model-port.ts` defines `LanguageModelPort.complete(messages, options)` and `LanguageModelCompleteOptions`.
- Existing options include `purpose`, `complexityDepth`, `overrideModel`, `overrideModelSelection`, tools, and constrained tool-calling flags.
- This is the right extension point for sampling input because every model call already passes through this options object.

### Runtime Selection

- `src/application/model-provider.ts` owns `PurposeRoutingLanguageModel`.
- It resolves purpose-to-tier model selection, host selection, override selection, and records model selection metadata.
- `ModelRuntimeSelection` currently carries `hostId`, `hostKind`, `baseUrl`, and `allowUnconstrainedToolCalls`.
- This is the right place to merge sampling layers because it already knows selected model, tier, purpose, and runtime host.

### Config

- `src/application/project-config.ts` owns `ProjectConfig`, Zod schema, defaults, and compatibility transforms.
- `hosts` already represent Ollama/HTTP runtime endpoints and must remain backward-compatible.
- New sampling config should default to empty/undefined so existing `rlm.config.yaml` files continue to parse.

### Adapters

- `src/adapters/ollama-language-model.ts` uses `ChatOllama`; constructor currently accepts a fixed `temperature`.
- `src/adapters/http-language-model.ts` sends `completeOptions` wholesale as `options`, so it can carry sampling without adapter-specific conversion.
- Phase 21 should pass runtime sampling per call rather than hardcoding only constructor temperature.

### UI and Graph Metadata

- `ui/src/main.tsx` already exposes node model trail and node model override.
- `src/domain/types.ts`, `src/application/execution-controller.ts`, and `src/domain/recursive-language-model.ts` already propagate planned/effective model metadata through graph nodes.
- Sampling metadata should follow the same route instead of inventing a separate state channel.

## Implementation Strategy

1. Add typed sampling config:
   - `LanguageModelSamplingOptions`
   - `EffectiveSamplingMetadata`
   - optional `sampling` on `LanguageModelCompleteOptions`
   - optional effective sampling/warnings on `LanguageModelResponse`

2. Add config layers:
   - global defaults under project config
   - per-model profiles keyed by model id/name
   - future-ready model profile storage for Phase 22

3. Add node layer:
   - graph node sampling override field
   - control-server endpoint to set/clear node sampling
   - UI inspector controls for the initial fields

4. Add resolver:
   - merge adapter defaults, global defaults, model profile, and node override
   - output both values and source map
   - record unsupported/ignored fields as warnings where adapters cannot apply them

5. Add adapter support:
   - Ollama: map supported fields to `ChatOllama` per-call invocation options where supported by LangChain; retain constructor default for compatibility if needed
   - HTTP: forward structured sampling to the remote host in `options`

6. Add verification:
   - config parsing/default compatibility tests
   - resolver precedence tests
   - adapter unsupported-parameter tests
   - UI source assertions for controls and metadata
   - existing model routing tests must remain green

## Risks

- Existing uncommitted changes touch `control-server`, `execution-controller`, `project-config`, `recursive-language-model`, and `index`. Implementation must preserve those edits.
- LangChain/Ollama per-call sampling support may be narrower than desired. Unsupported values should be visibly reported rather than silently dropped.
- Sampling metadata can become noisy. The UI should show compact effective values and source labels without expanding into a full settings page in Phase 21.

## Plan Recommendation

Use one plan for Phase 21. The work is cross-cutting and should land atomically so the type contract, resolver, adapters, UI/API, and tests stay consistent.
