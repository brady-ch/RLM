---
created: 2026-05-24T00:00:00.000Z
title: Phase 143 — Specialized tool surfaces failure audit
area: plugins
resolves_phase: 143
priority: medium
milestone: v1.22
---

## Problem

Role-specific tool surfaces should not ship without measured expert-team failure evidence.

## Solution

Build regression fixtures for small-model constrained calling; document failure modes per role; define Phase 144 go/no-go.

## Acceptance checks

- Fixtures per expert role with baseline metrics
- Failure modes documented (schema, selection, parse)
- Go/no-go criteria for wrappers defined
- Allowlist-only alternative evaluated
