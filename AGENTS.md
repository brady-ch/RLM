# Agents and architecture

This repository is a **recursive language model CLI**: CLI entry in `src/index.ts` composes a `RuntimeContext` via `src/application/bootstrap/`, orchestration in `src/application/`, recursion policy in `src/domain/` (orchestrator + `domain/recursion/` helpers), I/O in `src/cli/`, boundaries in `src/ports/`, and adapters under `src/adapters/` (`tools/`, `persistence/`, `models/`). The local control plane lives under `src/application/control-server/` (HTTP handlers in `handlers/`).

## Layout

| Area | Role |
|------|------|
| [`src/index.ts`](src/index.ts) | CLI entry: parse args, early exits, `buildRuntimeContext`, dispatch run modes, shutdown. |
| [`src/cli/`](src/cli/) | Argument parsing (`args.ts`), run-mode dispatch (`run-modes/`), result rendering (`render.ts`), stderr logging (`runtime-logger.ts`), signal handling (`shutdown.ts`). |
| [`src/application/config/`](src/application/config/) | Project YAML: types/schema, defaults, loader, validation, runtime resolution, model override, starter seed; [`project-config.ts`](src/application/project-config.ts) re-exports the public facade. |
| [`src/application/bootstrap/`](src/application/bootstrap/) | `buildRuntimeContext()`: extension host, tools, agent registry, model factory, execution control, stores, shutdown wiring. |
| [`src/application/agent-registry.ts`](src/application/agent-registry.ts) | Agent profiles and `selectAgent` for auto-routing. |
| [`src/application/agent-runner.ts`](src/application/agent-runner.ts) | `runConfiguredAgent`: memory reservation, purpose-routing model wrapper, `runRecursivePrompt`. |
| [`src/application/workflow-runner.ts`](src/application/workflow-runner.ts) | `runWorkflow`: multi-agent dispatch, QA, validation commands, combined metadata/trace. |
| [`src/application/memory-manager.ts`](src/application/memory-manager.ts) | RAM budgeting for concurrent agents. |
| [`src/application/model-provider.ts`](src/application/model-provider.ts) | `PurposeRoutingLanguageModel`: maps each completion’s `purpose` to a tier/model. |
| [`src/application/control-server/`](src/application/control-server/) | `startControlServer` and HTTP routing; [`handlers/`](src/application/control-server/handlers/) group session, graph, workflows, model library, static UI. |
| [`src/domain/recursive-language-model.ts`](src/domain/recursive-language-model.ts) | Core recursion orchestrator: depth, classify, decompose, solve, summarize, synthesize, quality loop, tool rounds; enforces `maxModelCalls`. |
| [`src/domain/recursion/`](src/domain/recursion/) | Pure helpers: [`prompt-utilities.ts`](src/domain/recursion/prompt-utilities.ts), [`budget-guard.ts`](src/domain/recursion/budget-guard.ts), [`execution-graph-sync.ts`](src/domain/recursion/execution-graph-sync.ts). |
| [`src/domain/types.ts`](src/domain/types.ts) | Shared config and result types. |
| [`src/ports/`](src/ports/) | Interfaces: language model, tools, trace, runtime logger, stores, etc. |
| [`src/adapters/`](src/adapters/) | Model hosts, tools, persistence (`tools/`, `persistence/`, `models/`); barrel [`src/adapters/index.ts`](src/adapters/index.ts). |
| [`tests/helpers/`](tests/helpers/) | Shared mocks and fixtures for engine and integration tests. |
| [`tests/domain/recursion/`](tests/domain/recursion/) | Engine tests aligned with `domain/recursion/` plus `recursive-language-model` integration coverage. |
| [`tests/`](tests/) | Remaining integration and subsystem tests (`*.test.ts` under `tests/` and subfolders; `npm test` runs all compiled files under `dist/tests`). |

## Extending

- **New tools**: implement `ToolPort`, register the instance in [`src/index.ts`](src/index.ts) (or extension/bootstrap path used there), and allow the tool name under `agents.*.tools` in YAML. Prefer living under `src/adapters/tools/` (or an extension module) rather than ad-hoc `application` imports.
- **New persistence or model hosts**: add under `src/adapters/persistence/` or `src/adapters/models/` and wire through bootstrap composition so `index.ts` stays thin.
- **New config fields**: extend schema/types in `src/application/config/`, preserve validation messages with path context, and re-export through `project-config` if the field is part of the public `ProjectConfig` surface.
- **New control-server endpoints**: add a handler module under `control-server/handlers/`, keep session/graph authority in execution services (`InteractiveExecutionSession`, execution-controller); route registration stays transport-only.
- **New agents**: add a block under `agents` in `rlm.config.yaml` (models + tools) and extend [`agent-registry.ts`](src/application/agent-registry.ts) if you need a dedicated profile constructor.
- **New workflows**: add under `workflows` in YAML; ensure agent ids exist in the registry.

For install, usage, and configuration fields, start with [`README.md`](README.md).

## GSD Project Context (2026-05-08)

- Project initialized for recursive workflow planning/execution UX hardening.
- Active roadmap: `.planning/ROADMAP.md` (5 phases, vertical MVP mode).
- Current focus: Phase 1 (`$gsd-discuss-phase 1`) — planned graph + approval gate foundation.
- Key v1 priorities:
  - Approval checkpoint edit/add/delete across execution graph.
  - Node-card model visibility and per-node override.
  - Initial-plan-only approval override mode.
  - No silent failures.
