# Phase 6 — Nyquist validation map

**Derived from:** `06-RESEARCH.md` § Validation Architecture, `06-01-PLAN.md`, `06-02-PLAN.md`  
**Status:** Pre-execution — execute checks after corresponding plan waves complete.

## Requirement coverage (PLUG-01)

| Behavior | Evidence | Plan | Automated |
|----------|----------|------|-----------|
| Extension port contracts published (`ExtensionManifest`, `ExtensionRegistryEntry`, `SkillLoaderPort` stub) | `npm run build`; types importable | 06-01 T1 | ✓ |
| `ExtensionHost` registries + `loadExternal` allowlist gate before `import()` | Unit/integration tests + code review | 06-01 T2 | ✓ |
| YAML `extensions` optional block parses; backward compatible | `npm test` existing + config parse tests | 06-01 T3 | ✓ |
| Built-in tools register only via first-party shims + `loadBuiltins` | `grep` / review `src/index.ts` for no direct `new *Tool` | 06-02 T4 | ✓ manual + test |
| Third-party tool loads from tmp fixture without editing core | `tests/extension-host.test.ts` | 06-02 T5 | ✓ |
| Missing `register` export → clear error | Test assertion | 06-02 T5 | ✓ |
| Duplicate tool name → throws (no silent overwrite) | Test assertion | 06-02 T5 | ✓ |
| `LanguageModelPort` unchanged | `git diff` / interface snapshot | 06-02 T4–5 | ✓ review |

## Wave alignment

| Wave | Plan | Validation focus |
|------|------|------------------|
| 1 | `06-01-PLAN.md` | Build + schema + host API surface |
| 2 | `06-02-PLAN.md` | End-to-end tool resolution + PLUG-01 integration tests + SUMMARY |

## Commands

- `npm run build`
- `npm test`

## Open gaps (fill during execution)

- [ ] Record actual test file names if renamed.
- [ ] Note any CLI flag added for `interactive: false` in CI (if applicable).
