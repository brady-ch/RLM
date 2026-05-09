# Stack Research

## Project Domain
Developer-facing recursive AI orchestration CLI + UI, local-first, Node + TypeScript + React.

## Recommended Baseline Stack
- Runtime: Node.js + TypeScript (existing)
- UI: React + Vite + graph view (`@xyflow/react`) (existing)
- Model backend: Ollama local HTTP (existing)
- Validation: `zod` schemas across adapters and control APIs (existing pattern)

## Why This Stack Fits
- Local developer workflow minimizes cloud setup friction.
- Existing code already follows ports/adapters and recursive engine boundaries.
- UI graph tooling is already in place for node visibility and manipulation.

## Gaps To Close for Target Vision
- Reliable approval-gate pause/resume semantics in UI + CLI.
- Mutable execution graph operations (add/edit/delete nodes) at every checkpoint.
- First-class model assignment visibility per node card.
- Explicit final-node model handoff support and override behavior.

## Suggested Tooling Additions
- Optional: schema-level validation for graph mutations before apply.
- Optional: stronger UI state contract tests for approval gate operations.
