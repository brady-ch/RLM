---
created: 2026-05-24T00:00:00.000Z
title: Phase 141 — Loop controller structured artifact refinement
area: domain
resolves_phase: 141
priority: medium
milestone: v1.22
---

## Problem

Quality loop handles natural-language answers only; structured schema-valid outputs need the same audit model.

## Solution

Extend loop primitive for schema-valid artifact refinement with pluggable gate policies.

## Acceptance checks

- Cycles improve schema-valid outputs until pass or cap
- Gate policies combine model judgment + deterministic validation
- Append-only history, stop reason, best-of-progress preserved
- Phase-specific model overrides supported
