---
phase: 15
status: complete
created_at: 2026-05-18
---

# Phase 15 Research

## Relevant Patterns

- Model routing is centralized in `src/application/model-provider.ts`.
  - `PurposeRoutingLanguageModel.complete()` delegates to `selectModel()` unless `overrideModel` is supplied.
  - `selectModel()` maps `LanguageModelPurpose` to `agent.models[purpose]`, resolves dynamic tiers, and records host/model details.
- Config validation lives in `src/application/project-config.ts`.
  - `MODEL_PURPOSES`, `ModelPurpose`, `AgentConfig.models`, `agentModelsSchema`, `defaultAgentModels()`, and `validateConfigReferences()` are the model-purpose surface.
  - `RecursiveModelConfig` is merged by `resolveRuntimeConfig()` and already carries `qualityLoop`.
- Quality-loop runtime is centralized in `src/domain/recursive-language-model.ts`.
  - `completeQualityLoopPhase()` is the only quality-loop model call path.
  - `QualityLoopPhaseRecord` and `QualityLoopMetadata` already carry phase records, usage, selected candidate, gate, rubric, and selection metadata.
- CLI output is in `src/cli/render.ts`.
  - Compact rendering already has quality-loop lines for status, usage, rubric, and gate.
  - JSON rendering includes raw `qualityLoop` metadata.

## Implementation Guidance

- Add model purposes with names that are stable and explicit:
  - `quality_loop_draft`
  - `quality_loop_critique`
  - `quality_loop_refine`
  - `quality_loop_gate`
  - `quality_loop_best_of_progress`
- Default those purposes to `answer` behavior for existing configs so Phase 15 is backward compatible.
- Add `qualityLoop.phaseModels` to runtime config as a partial map from `QualityLoopPhaseName` to tier/model selection.
- For a configured phase override, pass it as `overrideModel` to the model provider and record it as the planned selection source for the loop phase.
- For no override, pass the phase-specific purpose and let the model provider resolve the agent's configured purpose route.
- Store per-phase planned purpose, requested model selection, effective model, tier/source, and host fields in metadata.
- Fail selected invalid/unavailable model tiers before model invocation by validating configured selections against known tiers or concrete model ids with a clear error.

## Risks

- Existing YAML configs currently omit new model purpose keys. The schema must fill defaults rather than reject old files.
- The term "model" can mean tier key or concrete model id. Metadata should preserve the requested selection and the effective model separately.
- Task-level node model override already exists. Phase-specific overrides should take precedence for quality-loop internal phases because that is the Phase 15 feature.
