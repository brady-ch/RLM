# Architecture Overview

## Snapshot
- Date: 2026-05-08
- Pattern: Layered architecture with ports/adapters and explicit domain/application split.

## High-Level Shape
- CLI and user I/O layer:
  - `src/cli/` and `src/index.ts`
- Application orchestration layer:
  - `src/application/`
- Domain/engine layer:
  - `src/domain/recursive-language-model.ts`
- Boundary interfaces (ports):
  - `src/ports/`
- Concrete external implementations (adapters):
  - `src/adapters/`

## Core Runtime Flow
1. CLI parses args and config in `src/index.ts` + `src/cli/args.ts`.
2. Project runtime config is loaded/resolved in `src/application/project-config.ts`.
3. Agent/profile selection occurs via `src/application/agent-registry.ts`.
4. Model routing is applied through `src/application/model-provider.ts`.
5. Recursive execution engine runs in `src/domain/recursive-language-model.ts`.
6. Optional workflow fanout/QA runs through `src/application/workflow-runner.ts`.
7. Result rendering happens via `src/cli/render.ts`.

## Domain Responsibilities
- Recursion policy and budget controls:
  - depth selection
  - classify/decompose/answer/summarize/synthesize steps
  - tool-round and model-call budgeting
- Execution graph eventing and control integration for interactive mode.

## Application Responsibilities
- Agent run lifecycle (`agent-runner.ts`)
- Memory reservation and capacity management (`memory-manager.ts`)
- Workflow orchestration across multiple agents (`workflow-runner.ts`)
- Interactive execution control and HTTP UI server (`execution-controller.ts`, `control-server.ts`)

## Data and Control Boundaries
- Domain depends on abstract ports (language model, tools, trace/logging interfaces).
- Adapters provide implementations for:
  - Ollama model calls
  - shell/web/file tools
  - in-memory trace

## Architectural Strengths
- Clear separation of concerns between policy (domain) and integration (adapters).
- Config-driven agent and model tier behavior via YAML.
- Execution graph model supports both headless and UI inspection.

## Architectural Tensions
- `src/index.ts` is a dense composition root with many responsibilities.
- Workflow and execution-control concerns are broad and may continue to expand.
- Test strategy is integration-heavy; unit boundaries exist but are not deeply isolated everywhere.
