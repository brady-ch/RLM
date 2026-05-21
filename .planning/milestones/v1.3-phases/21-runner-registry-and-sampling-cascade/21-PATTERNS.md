# Phase 21 Patterns

## Closest Existing Patterns

| Need | Existing Pattern | Files |
|------|------------------|-------|
| Purpose/model selection | Central resolver with selection records and runtime logging | `src/application/model-provider.ts` |
| Backward-compatible config evolution | Zod defaults, optional fields, transforms | `src/application/project-config.ts` |
| Per-node override metadata | Graph node fields plus control-server endpoints and UI inspector | `src/domain/types.ts`, `src/application/execution-controller.ts`, `src/application/control-server.ts`, `ui/src/main.tsx` |
| CLI/UI render metadata | Add compact fields to node metadata and renderer output | `src/cli/render.ts`, `ui/src/main.tsx` |
| Adapter boundary | Convert generic options into provider-specific calls | `src/adapters/ollama-language-model.ts`, `src/adapters/http-language-model.ts` |
| Regression coverage | Node test fake models record `LanguageModelCompleteOptions` | `tests/recursive-language-model.test.ts`, `tests/project-config-scopes.test.ts` |

## Conventions To Follow

- Keep config additions optional and defaulted.
- Prefer explicit failure or warning metadata over silent fallback.
- Store user overrides on graph nodes, not hidden UI-local state.
- Keep UI controls minimal in this phase; Phase 22 owns richer model-library UX.
- Preserve existing `hosts` semantics and names.

## Files Expected To Change

- `src/ports/language-model-port.ts`
- `src/application/model-provider.ts`
- `src/application/project-config.ts`
- `src/adapters/ollama-language-model.ts`
- `src/adapters/http-language-model.ts`
- `src/domain/types.ts`
- `src/application/execution-controller.ts`
- `src/application/control-server.ts`
- `src/domain/recursive-language-model.ts`
- `src/cli/render.ts`
- `ui/src/main.tsx`
- `tests/project-config-scopes.test.ts`
- `tests/recursive-language-model.test.ts`
