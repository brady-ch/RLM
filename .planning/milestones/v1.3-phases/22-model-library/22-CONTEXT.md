---
phase: 22
title: Model Library
status: completed
gathered: 2026-05-20
source: autonomous
---

# Phase 22: Model Library - Context

<domain>
## Phase Boundary

Build the first in-app model library slice for v1.3: curated recommendations, Hugging Face search, download/progress state, installed-model discovery, and installed-model selection for runtime tiers.

</domain>

<decisions>
## Implementation Decisions

### Curated Catalog
- Ship a small built-in curated catalog first, using Ollama model ids already present in project defaults.
- Catalog entries must show tags, RAM hints, and clear install state.

### Download Behavior
- v1 installs curated Ollama models only.
- Pull failures must be explicit and visible through API/UI state.
- Progress can be coarse for this phase; a queued/running/ready/failed job state is enough.

### Hugging Face Search
- Search is exploratory in Phase 22.
- Results must not imply one-click install unless they are mapped to a curated Ollama model.
- Unsupported Hugging Face results should show a reason instead of failing silently.

### Installed Model Selection
- Installed models can be assigned to existing tiers in the current runtime config.
- Selection changes are session-local for this phase; durable settings/persistence can build on this in later product hardening.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` - Phase 22 goal and success criteria.
- `.planning/REQUIREMENTS.md` - PROD-05, PROD-06, PROD-07.
- `.planning/phases/21-runner-registry-and-sampling-cascade/21-VERIFICATION.md` - completed sampling/runtime foundation.
- `src/application/control-server.ts` - UI API surface.
- `src/application/project-config.ts` - model tier config to update for selections.
- `ui/src/main.tsx` - existing node inspector and UI shell.

</canonical_refs>

<deferred>
## Deferred Ideas

- Durable persisted model library settings.
- Full GGUF import and compatibility mapping from Hugging Face into Ollama.
- Fine-grained streaming byte progress beyond coarse job status.

</deferred>
