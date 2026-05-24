---
title: Loop Controller for Structured Artifacts and Implementation
planted_date: 2026-05-14
trigger_condition: "After answer-quality refinement loop nodes prove useful and the project is ready to extend the loop primitive beyond natural-language answers"
status: active
updated: 2026-05-24
resolves_milestone: v1.22
resolves_phases: "141–142"
---

## Intent

Reuse the hybrid loop controller for two later capabilities:

1. Structured artifact refinement, where each cycle improves schema-valid outputs until validation passes or the loop reaches its iteration cap.
2. Implementation/code-change refinement, where each cycle drafts a change, critiques risks or test failures, refines the implementation, and gates on explicit completion criteria.

## Notes

- Keep answer-quality refinement as the first implementation target.
- Preserve the same audit model: append-only iteration history, visible stop reason, and best-of-progress final selection.
- Allow phase-specific model overrides to carry forward: draft, critique, refine, gate, and best-of-progress may each use distinct model assignments.
- Prefer pluggable gate policies so structured artifacts can combine model judgment with deterministic schema validation.

