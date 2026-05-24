---
created: 2026-05-24T00:00:00.000Z
title: Phase 144 — Specialized tool surfaces role wrappers
area: plugins
resolves_phase: 144
priority: medium
milestone: v1.22
---

## Problem

Small models fail constrained tool calling for specific roles; audit (Phase 143) may justify narrower tool surfaces.

## Solution

Ship role-specific built-in wrappers (e.g. `web_fetch_docs`, `grep_repo`) as thin layers over shared adapters.

## Acceptance checks

- At least one role wrapper shipped behind allowlist
- No forked execution stacks
- Regression fixtures show improvement vs baseline
- Tools map to `agents.*.tools` allowlists
