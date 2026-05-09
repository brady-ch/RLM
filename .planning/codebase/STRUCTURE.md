# Repository Structure

## Snapshot
- Date: 2026-05-08
- Organization: single package with backend core and colocated UI app under `ui/`.

## Top-Level Layout
- `src/` -> application source
- `tests/` -> test sources (compiled to `dist/tests` before execution)
- `ui/` -> React + Vite UI client
- `dist/` -> TypeScript build output
- `rlm.config.yaml` -> runtime/agent/model/workflow config
- `AGENTS.md` -> repository architecture and agent instructions

## Source Layout (`src/`)
- `src/index.ts`
  - CLI entrypoint and dependency composition.
- `src/cli/`
  - `args.ts`, `render.ts`, `runtime-logger.ts`, `shutdown.ts`
- `src/application/`
  - orchestration and runtime control (`workflow-runner.ts`, `agent-runner.ts`, etc.)
- `src/domain/`
  - recursive engine and shared domain types
- `src/ports/`
  - interfaces for model/tools/trace/logging
- `src/adapters/`
  - concrete tool/model implementations

## UI Layout (`ui/`)
- `ui/src/main.tsx` -> app shell and execution graph handling
- `ui/src/styles.css` -> UI styles
- `ui/index.html` -> Vite HTML entry
- `ui/vite.config.ts` -> Vite config

## Testing Layout
- Primary test file currently concentrated in:
  - `tests/recursive-language-model.test.ts`
- Test command behavior:
  - builds TS first, then runs Node test runner over built JS.

## Naming and File Patterns
- Adapter files typically end in `-tool.ts` or descriptive adapter names.
- Application modules use responsibility-based names (`workflow-runner.ts`, `memory-manager.ts`).
- Ports are named as `*-port.ts`.

## Key Paths for Common Tasks
- Add CLI behavior: `src/cli/args.ts`, `src/index.ts`
- Add/modify recursive policy: `src/domain/recursive-language-model.ts`
- Add integrations/tools: `src/adapters/` + register in `src/index.ts`
- Tune runtime defaults: `rlm.config.yaml`
- Update output presentation: `src/cli/render.ts`
