---
title: First-Class Plugin Taxonomy for Future Tools
planted_date: 2026-05-22
trigger_condition: "Before adding the next batch of built-in tools or formalizing external tool plugin APIs"
status: active
---

## Intent

As more tools are added, avoid turning `src/adapters/` into a mixed grab bag of model adapters, persistence adapters, tracing adapters, and tool implementations.

Treat tools as plugin capabilities:

- Built-in tools live under a built-in plugin/tool taxonomy.
- External tools register through the extension/plugin host.
- Core runtime adapters remain in infrastructure-specific adapter folders.

## Candidate taxonomy

```text
src/plugins/
  builtin/
    shell/
      register.ts
      guarded-shell-tool.ts
    files/
      register.ts
      workspace-file-write-tool.ts
    web/
      register.ts
      web-search-tool.ts
      web-fetch-tool.ts
      search-query.ts
  external/
    plugin-loader.ts
    plugin-allowlist.ts
    plugin-manifest.ts

src/adapters/
  models/
  persistence/
  tracing/
```

## Constraints

- Preserve the existing `ToolPort` contract unless a concrete plugin requirement forces a change.
- Keep plugin registration explicit and auditable.
- Keep allowlist/approval behavior for external code loading.
- Avoid moving files before responsibility extraction has made module boundaries clear.

## Depends on

- Runtime composition extracted from the CLI entrypoint.
- Extension/plugin host naming and ownership clarified.

