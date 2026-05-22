# Architecture Boundary Cleanup Direction

**Date:** 2026-05-22  
**Context:** `$gsd-explore` on solidifying architecture boundaries before adding many more tools and future tool plugins.

## Direction

The architecture cleanup should happen in two passes:

1. **Responsibility extraction first**: split large files and move policy out of overloaded implementations before renaming directories.
2. **Directory taxonomy second**: once responsibilities are clearer, move files into homes that communicate intent.

This avoids a cosmetic folder shuffle that still leaves large mixed-responsibility modules behind.

## Plugin and adapter boundary

Tool plugins should be treated as **registration/distribution packages**, not as adapters themselves.

- **Port:** core contract, such as `ToolPort`, `LanguageModelPort`, or `MemoryStorePort`.
- **Adapter:** concrete implementation of a port.
- **Plugin/extension:** package that registers one or more tools/adapters plus related config, permissions, and metadata.
- **Application:** resolves configured capabilities and runs use cases.

A plugin may contain adapters, but the plugin boundary is broader than a single adapter.

## Working rules

- `src/adapters/` should be reserved for core runtime infrastructure implementations.
- Built-in tools should move toward plugin/tool capability areas rather than a flat adapter folder.
- External plugins should register capabilities through the extension/plugin host.
- Adapters may own I/O mechanics and format-specific parsing.
- Reusable business policy and orchestration decisions should live in domain or application code.

## Candidate responsibility extraction sequence

1. Extract runtime composition out of `src/index.ts`.
2. Split `src/application/project-config.ts` into loading, defaults, validation, runtime resolution, and model override responsibilities.
3. Split `src/application/execution-controller.ts` by approval gates, graph editing, node state transitions, event emission, and session/cancellation concerns.
4. Extract pure helpers from `src/domain/recursive-language-model.ts` before moving stateful orchestration.
5. Move reusable policy out of fat adapters where it is clearly shared across implementations.

## Later taxonomy target

Possible end-state directories:

```text
src/application/config/
src/application/execution/
src/application/workflows/
src/runtime/composition/
src/runtime/interop/
src/plugins/builtin/
src/adapters/persistence/
src/adapters/models/
src/adapters/tracing/
```

