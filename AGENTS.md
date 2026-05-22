# Agents and architecture

This repository is a **recursive language model CLI**: CLI entry in `src/index.ts` composes a `RuntimeContext` via `src/runtime/composition/` (facaded through `src/application/bootstrap/`), orchestration in `src/application/`, recursion policy in `src/domain/` (orchestrator + `domain/recursion/` helpers), I/O in `src/cli/`, boundaries in `src/ports/`, infrastructure adapters under `src/adapters/` (`persistence/`, `models/`), plugin packages under `src/plugins/`, and runtime wiring under `src/runtime/` (`composition/`, `interop/`). The local control plane lives under `src/application/control-server/` (HTTP handlers in `handlers/`).

## Layout

| Area | Role |
|------|------|
| [`src/index.ts`](src/index.ts) | CLI entry: parse args, early exits, `buildRuntimeContext`, dispatch run modes, shutdown. |
| [`src/cli/`](src/cli/) | Argument parsing (`args.ts`), run-mode dispatch (`run-modes/`), result rendering (`render.ts`), stderr logging (`runtime-logger.ts`), signal handling (`shutdown.ts`). |
| [`src/application/config/`](src/application/config/) | Project YAML: types/schema, defaults, loader, validation, runtime resolution, model override, starter seed; [`project-config.ts`](src/application/project-config.ts) re-exports the public facade. |
| [`src/application/bootstrap/`](src/application/bootstrap/) | Thin facade re-exporting `buildRuntimeContext` from `src/runtime/composition/`; adapter exports for CLI wiring. |
| [`src/application/execution/`](src/application/execution/) | Agent/workflow runners, execution control, model provider/library, runtime events. |
| [`src/application/graph/`](src/application/graph/) | Graph planner, executor, workflow store/serializer/types. |
| [`src/application/memory/`](src/application/memory/) | Memory manager, resolver, semantic index. |
| [`src/application/plugins/`](src/application/plugins/) | Plugin manager application facade (list/doctor UX in later phases); re-exports discovery types from `src/plugins/`. |
| [`src/runtime/composition/`](src/runtime/composition/) | `ExtensionHost`, `PluginLoader` wiring site, `buildRuntimeContext`, tools resolver, init order. |
| [`src/runtime/interop/`](src/runtime/interop/) | MCP/skill interop runtime and tool factories. |
| [`src/plugins/`](src/plugins/) | Plugin taxonomy: manifest schema, categories, builtin packages, legacy YAML compat, installed catalog discovery. |
| [`src/plugins/builtin/`](src/plugins/builtin/) | First-party plugins (`shell/`, `files/`, `web/`) each with `rlm.plugin.json` + `register(host)`. |
| [`src/domain/recursive-language-model.ts`](src/domain/recursive-language-model.ts) | Core recursion orchestrator: depth, classify, decompose, solve, summarize, synthesize, quality loop, tool rounds; enforces `maxModelCalls`. |
| [`src/domain/recursion/`](src/domain/recursion/) | Pure helpers: [`prompt-utilities.ts`](src/domain/recursion/prompt-utilities.ts), [`budget-guard.ts`](src/domain/recursion/budget-guard.ts), [`execution-graph-sync.ts`](src/domain/recursion/execution-graph-sync.ts). |
| [`src/domain/types.ts`](src/domain/types.ts) | Shared config and result types. |
| [`src/ports/`](src/ports/) | Interfaces: language model, tools, trace, runtime logger, stores, extension host, etc. |
| [`src/adapters/`](src/adapters/) | Infrastructure only: persistence stores, model hosts, tracing; barrel [`src/adapters/index.ts`](src/adapters/index.ts) re-exports builtin tool classes from `plugins/builtin/` for tests and transitional imports. |
| [`tests/helpers/`](tests/helpers/) | Shared mocks and fixtures for engine and integration tests. |
| [`tests/domain/recursion/`](tests/domain/recursion/) | Engine tests aligned with `domain/recursion/` plus `recursive-language-model` integration coverage. |
| [`tests/plugins/`](tests/plugins/) | Plugin manifest validation and loader discovery tests. |
| [`tests/`](tests/) | Remaining integration and subsystem tests (`*.test.ts` under `tests/` and subfolders; `npm test` runs all compiled files under `dist/tests`). |

## Plugin taxonomy

Built-in and external plugins share one contract:

1. **`rlm.plugin.json`** at the plugin root — validated with Zod (`src/plugins/manifest-schema.ts`) **before** any `import()`.
2. **`register(host: ExtensionHostPort)`** module export — registers tools/skill loaders/model hosts on the shared extension host.
3. **Categories** — `shell`, `files`, `web`, `interop` (extensible enum in `src/plugins/categories.ts`).

Discovery order in `PluginLoader` (`src/plugins/plugin-loader.ts`):

1. Built-ins under `src/plugins/builtin/`
2. Configured entries (legacy `extensions.load` YAML normalized via compat shim)
3. Installed catalog at `.rlm/plugins/catalog.json`

MCP/skill interop tools are registered separately under `src/runtime/interop/` and use the `interop` category in manifests when packaged as plugins.

## Extending

- **New built-in tools**: add under `src/plugins/builtin/<category>/` with `rlm.plugin.json`, tool implementation, and `register.ts`; register the package in `src/plugins/builtin/index.ts`. Do **not** add new tool implementations under `src/adapters/tools/`.
- **New external plugins**: ship `rlm.plugin.json` + `register` export; enable via legacy `extensions.load` (compat shim) or installed catalog; allowlist approval still applies before `import()`.
- **New persistence or model hosts**: add under `src/adapters/persistence/` or `src/adapters/models/` and wire through bootstrap composition.
- **New config fields**: extend schema/types in `src/application/config/`, preserve validation messages with path context, and re-export through `project-config` if public.
- **New control-server endpoints**: add a handler module under `control-server/handlers/`; keep session/graph authority in execution services.
- **New agents**: add a block under `agents` in `rlm.config.yaml` (models + tools) and extend [`agent-registry.ts`](src/application/agent-registry.ts) if you need a dedicated profile constructor.
- **New workflows**: add under `workflows` in YAML; ensure agent ids exist in the registry.

For install, usage, and configuration fields, start with [`README.md`](README.md).

## GSD Project Context (2026-05-08)

- Project initialized for recursive workflow planning/execution UX hardening.
- Active roadmap: `.planning/ROADMAP.md` (milestone v1.7 adapter & plugin taxonomy).
- Current focus: Phase 46 — plugin taxonomy and built-in migration complete; Phase 47+ adds concern map tests and depcruise ratchet.
