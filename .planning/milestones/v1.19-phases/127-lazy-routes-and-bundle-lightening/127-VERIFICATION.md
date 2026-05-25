---
status: passed
phase: 127
verified: 2026-05-24
---

# Phase 127 Verification

## Goal

Code-split Advanced hub; measure and reduce bundle size; workflow-first load skips Advanced chunks until navigated.

## Must-haves

| ID | Requirement | Status |
|----|-------------|--------|
| UI-127-01 | Advanced routes lazy-loaded via React.lazy | ✅ PASS — AppShell LazyAdvancedHub + per-tab lazy in AdvancedHub |
| UI-127-02 | Before/after bundle size documented | ✅ PASS — see Bundle comparison below |
| UI-127-03 | Workflow-first load skips Advanced chunks | ✅ PASS — main chunk 480.34 kB; Advanced chunks separate |
| UI-127-04 | npm run test:agent:verify:light passes | ✅ PASS |
| UI-127-05 | tests/ui static tests pass | ✅ PASS — shell-boundaries 14/14 |

## Success criteria (ROADMAP)

1. Advanced routes lazy-loaded via `React.lazy` — ✅
2. Before/after bundle size documented — ✅
3. Workflow-first load skips Advanced chunks until navigated — ✅

## Bundle comparison

| Metric | Phase 121 baseline | Pre-127 (single chunk) | Post-127 (workflow-first) | Delta vs 121 |
|--------|-------------------|------------------------|---------------------------|--------------|
| Main JS | 522.60 kB | 509.88 kB | **480.34 kB** | **−42.26 kB (−8.1%)** |
| CSS | 45.52 kB | 42.22 kB | 42.22 kB | −3.30 kB |

### Deferred Advanced chunks (loaded on navigate only)

| Chunk | Size (minified) |
|-------|-----------------|
| AdvancedHub | 2.68 kB |
| ModelsView | 3.93 kB |
| SessionsView | 3.34 kB |
| PluginsView | 5.64 kB |
| MemoryView | 2.89 kB |
| SettingsView | 14.33 kB |
| Lucide icon shards | ~1.0 kB |

**Main chunk reduction (pre→post lazy):** 509.88 kB → 480.34 kB (−29.54 kB, −5.8%)

## Automated checks

- `npm run test:agent:verify:light` — exit 0
- `node --test tests/ui/shell-boundaries.test.ts` — 14/14 pass
- `npm run build:ui` — exit 0, multiple JS chunks emitted

## Code review

- `127-REVIEW.md` — status: clean (0 critical, 0 warning)
