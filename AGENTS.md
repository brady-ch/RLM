# Agents and architecture

This repository is a **recursive language model CLI**: orchestration in `src/application/`, recursion policy in `src/domain/`, I/O and CLI in `src/cli/`, and boundaries in `src/ports/` with adapters under `src/adapters/`.

## Layout

| Area | Role |
|------|------|
| [`src/index.ts`](src/index.ts) | CLI entry: parse args, load YAML, create tools/models, run single agent or workflow, render output, shutdown cleanup. |
| [`src/cli/`](src/cli/) | Argument parsing (`args.ts`), result rendering (`render.ts`), stderr logging (`runtime-logger.ts`), signal handling (`shutdown.ts`). |
| [`src/application/project-config.ts`](src/application/project-config.ts) | Load and validate `rlm.config.yaml`, defaults, `resolveRuntimeConfig`, `applyModelOverride`, tier resolution. |
| [`src/application/agent-registry.ts`](src/application/agent-registry.ts) | Agent profiles and `selectAgent` for auto-routing. |
| [`src/application/agent-runner.ts`](src/application/agent-runner.ts) | `runConfiguredAgent`: memory reservation, purpose-routing model wrapper, `runRecursivePrompt`. |
| [`src/application/workflow-runner.ts`](src/application/workflow-runner.ts) | `runWorkflow`: multi-agent dispatch, QA, validation commands, combined metadata/trace. |
| [`src/application/memory-manager.ts`](src/application/memory-manager.ts) | RAM budgeting for concurrent agents. |
| [`src/application/model-provider.ts`](src/application/model-provider.ts) | `PurposeRoutingLanguageModel`: maps each completion’s `purpose` to a tier/model. |
| [`src/domain/recursive-language-model.ts`](src/domain/recursive-language-model.ts) | Core recursion: depth, classify, decompose, solve, summarize, synthesize; enforces `maxModelCalls` and tool rounds. |
| [`src/domain/types.ts`](src/domain/types.ts) | Shared config and result types. |
| [`src/ports/`](src/ports/) | Interfaces: language model, tools, trace, runtime logger. |
| [`src/adapters/`](src/adapters/) | Ollama model adapter, shell/file/web/search tools. |
| [`tests/`](tests/) | Integration-style tests for CLI parsing, engine, workflows. |

## Extending

- **New tools**: implement `ToolPort`, register the instance in [`src/index.ts`](src/index.ts) `toolsByName`, and allow the tool name under `agents.*.tools` in YAML.
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
