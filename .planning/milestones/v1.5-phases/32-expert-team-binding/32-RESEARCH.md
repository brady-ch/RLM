---
phase: 32-expert-team-binding
type: research
created: 2026-05-22
---

# Phase 32 Research

## Existing Patterns

- Planned child generation is centralized in `src/application/graph-planner.ts`; invalid structured output is already surfaced as `invalid_planner_output`.
- Mutable graph state and approval decisions are owned by `InteractiveExecutionSession` in `src/application/execution-controller.ts`.
- Runtime model routing already supports tier overrides through `PurposeRoutingLanguageModel` and `overrideModelSelection`.
- Recursive execution receives approved node decisions through `NodeApprovalDecision`, making it the right boundary for per-node expert metadata.
- The UI inspector already has patterns for editable model and sampling overrides.

## Findings

- Expert metadata can be added without introducing duplicate tool adapters by carrying a per-node tool allowlist and filtering the shared tool list at completion time.
- Purpose tier overrides should not beat explicit model overrides; explicit node model overrides remain strict and no-fallback.
- Current full graph traversal is still Phase 33. Phase 32 can bind expert fields at checkpoint/execution decision time and expose planner-created metadata for planned nodes.

