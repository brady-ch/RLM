# Codebase Stack

## Snapshot
- Date: 2026-05-08
- Repo type: TypeScript monorepo-style app with CLI core and optional React UI.
- Primary runtime: Node.js (ESM, `type: module`).

## Languages and Runtime
- TypeScript across backend/CLI and UI.
- Node target with modern module mode:
  - `module: nodenext`
  - `target: esnext`
  - strict compiler settings enabled.

## Core Dependencies
- LLM and orchestration:
  - `langchain`, `@langchain/core`, `@langchain/langgraph`, `@langchain/ollama`, `deepagents`
- Validation/config:
  - `zod`, `yaml`
- UI:
  - `react`, `react-dom`, `@xyflow/react`, `lucide-react`

## Build and Tooling
- Compiler/build:
  - `typescript`, `tsx`
- UI dev/build:
  - `vite`, `@vitejs/plugin-react`
- Key scripts in `package.json`:
  - `npm run dev` -> run CLI via `tsx src/index.ts`
  - `npm run dev:ui` -> run Vite UI
  - `npm run build` -> compile TS to `dist/`
  - `npm test` -> build first, then run Node built-in tests from `dist/tests/*.test.js`

## Config Surfaces
- Main app config: `rlm.config.yaml`
- TS config: `tsconfig.json`
- UI-specific TS/Vite config: `ui/tsconfig.json`, `ui/vite.config.ts`

## Model/Runtime Defaults
- Model backend: Ollama over HTTP (`http://127.0.0.1:11434` default in adapter).
- Tiered model configuration defined in `rlm.config.yaml` under `models.tiers`.
- Runtime limits configured in `rlm.config.yaml` (`maxModelCalls`, `maxToolRounds`, depth/branch settings).

## Entry Points
- CLI entrypoint: `src/index.ts`
- Build output entrypoint: `dist/src/index.js`
- UI entrypoint: `ui/src/main.tsx`

## Notable Architectural Stack Choices
- Ports/adapters style boundaries:
  - Ports in `src/ports/`
  - Adapters in `src/adapters/`
- Domain logic isolated in `src/domain/`.
- Workflow/application orchestration in `src/application/`.

## Operational Assumptions
- Local execution, local filesystem access, and local Ollama availability are expected.
- Tooling assumes shell utilities are available for web-search adapter (`curl`, `sed`).
