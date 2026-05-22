---
created: 2026-05-22T00:00:00.000Z
title: Split config loader, resolver, and validation responsibilities
area: architecture
files:
  - src/application/project-config.ts
---

## Problem

`src/application/project-config.ts` mixes defaults, schema interpretation, YAML/file loading, starter seeding, model override handling, runtime host resolution, tier resolution, and validation.

The file is large enough that unrelated config behavior is hard to modify safely, especially as plugins, tool manifests, model hosts, and runtime modes grow.

## Solution

Split config responsibilities into focused modules before any broader directory taxonomy move.

Candidate modules:

- `project-config-defaults.ts`
- `project-config-loader.ts`
- `project-config-validation.ts`
- `runtime-config-resolution.ts`
- `model-override.ts`
- `starter-config-seed.ts`

Keep public exports compatible at first, then gradually update callers once tests protect behavior.

## Acceptance checks

- Existing config-loading tests pass unchanged or with only import updates.
- Validation errors preserve useful file/path context.
- Runtime host and tier resolution behavior is unchanged.
- Starter seeding behavior is unchanged.
- The split reduces cross-purpose edits in future plugin/model config work.

