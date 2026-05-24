# Phase 113: TS-Only Path Inventory

**Phase 113 scope is audit-only — no `src/` deletions in this phase.**

Generated: 2026-05-24  
Total TypeScript files: **148** under `src/`, **40** under `tests/` (188 combined)

---

## Summary

| Concern | src/ files | tests/ mirror | Target phase | Rust counterpart |
|---------|-------------|---------------|--------------|------------------|
| control-server (application) | 12 | 1 integration | **114** | `crates/rlm-core/src/control_server/` |
| cli | 12 | — | **115** | `crates/rlm-cli/src/` |
| runtime | 8 | 3 | **115** | `crates/rlm-core/src/interop/`, `plugins/` |
| application (excl. control-server) | 60 | 15 | **116** | `crates/rlm-core/src/application/` |
| domain | 11 | 5 | **117** | `crates/rlm-core/src/domain/` |
| ports | 11 | — | **117** | `crates/rlm-core/src/ports/` |
| adapters | 9 | 2 | **118** | `crates/rlm-core/src/adapters/`, `persistence/` |
| plugins | 24 | 3 | **118** | `crates/rlm-core/src/plugins/` |
| index.ts | 1 | — | **115** | `crates/rlm-cli/src/main.rs` |

---

## cli

- **File count:** 12
- **Subdirectories:** `src/cli/`, `src/cli/run-modes/`
- **Mirrored tests:** none (CLI tested via integration / Rust `rlm-cli` tests)
- **Target phase:** 115
- **Rust counterpart:** `crates/rlm-cli/src/` (flags, commands, dispatch)

Key files: `args.ts`, `render.ts`, `shutdown.ts`, `run-modes/agent-workflow.ts`, `run-modes/plan-node.ts`, `run-modes/ask.ts`, `run-modes/ui.ts`, `run-modes/workflow.ts`

---

## runtime

- **File count:** 8
- **Subdirectories:** `src/runtime/composition/`, `src/runtime/interop/`
- **Mirrored tests:** `tests/runtime/composition/` (2), `tests/runtime/interop/` (1)
- **Target phase:** 115
- **Rust counterpart:** `crates/rlm-core/src/interop/` (MCP/skill), `crates/rlm-core/src/plugins/` (composition/registry)

Key files: `build-runtime-context.ts`, `extension-host.ts`, `runtime-composition.ts`, `init-order.ts`, MCP/skill interop modules

---

## application (control-server subset)

- **File count:** 12
- **Subdirectories:** `src/application/control-server/`, `src/application/control-server/handlers/`
- **Mirrored tests:** `tests/integration/control-server-fixtures.test.ts`
- **Target phase:** 114
- **Rust counterpart:** `crates/rlm-core/src/control_server/` (Axum routes, handlers, state)

Key files: `index.ts` (startControlServer), handler modules for session, graph, memory, config routes

---

## application (remaining)

- **File count:** 60
- **Subdirectories:** `bootstrap/`, `config/`, `execution/`, `graph/`, `memory/`, `plugins/`
- **Mirrored tests:** `tests/application/` (15 files across bootstrap, config, execution, graph, memory, plugins)
- **Target phase:** 116
- **Rust counterpart:** `crates/rlm-core/src/application/` (execution, graph, memory, config, bootstrap)

Key files: `agent-runner.ts`, `execution-controller.ts`, `graph-planner.ts`, `memory-manager.ts`, `project-config.ts` facade chain

---

## domain

- **File count:** 11
- **Subdirectories:** `src/domain/`, `src/domain/recursion/`
- **Mirrored tests:** `tests/domain/` (5), `tests/domain/recursion/`
- **Target phase:** 117
- **Rust counterpart:** `crates/rlm-core/src/domain/` (recursive-language-model, recursion helpers)

Key files: `recursive-language-model.ts`, `types.ts`, `recursion/budget-guard.ts`, `recursion/prompt-utilities.ts`

---

## ports

- **File count:** 11
- **Subdirectories:** `src/ports/` (flat)
- **Mirrored tests:** none dedicated (ports tested via domain/application tests)
- **Target phase:** 117
- **Rust counterpart:** `crates/rlm-core/src/ports/` (language_model, tools, stores, extension_host)

Key files: `language-model-port.ts`, `tool-port.ts`, `memory-store-port.ts`, `extension-host-port.ts`

---

## adapters

- **File count:** 9
- **Subdirectories:** `src/adapters/models/`, `src/adapters/persistence/`
- **Mirrored tests:** `tests/adapters/persistence/` (2)
- **Target phase:** 118
- **Rust counterpart:** `crates/rlm-core/src/adapters/` (Ollama), `crates/rlm-core/src/persistence/` (stores, vector index)

Key files: Ollama model hosts, file stores (memory, session, run state), `InMemoryTrace`

---

## plugins

- **File count:** 24
- **Subdirectories:** `src/plugins/builtin/` (files, shell, web), `src/plugins/remote-fetch/`, manifest/loader
- **Mirrored tests:** `tests/plugins/` (3), `tests/plugins/builtin/web/`
- **Target phase:** 118
- **Rust counterpart:** `crates/rlm-core/src/plugins/` (registry, builtins, manifest)

Key files: `plugin-loader.ts`, `manifest-schema.ts`, builtin `register.ts` per category

---

## index.ts

- **File count:** 1 (`src/index.ts`)
- **Mirrored tests:** none (entry point)
- **Target phase:** 115
- **Rust counterpart:** `crates/rlm-cli/src/main.rs`

Node CLI entry: parses args, builds RuntimeContext, dispatches run modes, handles shutdown signals.

---

## Node-dependent scripts and CI

| Path | What it does | Boots TS server? | Removal phase |
|------|--------------|------------------|---------------|
| `scripts/parity/compare-runtimes.mjs` | Compares Rust vs TS control-server session routes | **yes** | 114 (retire or Rust-only rewrite) |
| `tests/integration/control-server-fixtures.test.ts` | Boots TS server; golden fixture parity on static routes | **yes** | 114 (delete; Rust fixture remains) |
| `package.json` `check:parity` | build + TS fixture test + compare-runtimes + Rust golden | **yes** | 114 (narrow to Rust-only) |
| `package.json` `dev` | `tsx src/index.ts` — Node CLI dev entry | no | 115 |
| `package.json` `start` | `node dist/src/index.js` — Node CLI prod entry | no | 115 |
| `package.json` `build` | `tsc -p tsconfig.json` — compiles TS runtime | no | 119 |
| `package.json` `rlm:node` | Direct Node dist entry bypassing dispatcher | no | 115 |
| `package.json` `bin.rlm` | Points to `dist/src/index.js` (bypasses dispatcher) | no | 115 (point at Rust wrapper) |
| `scripts/rlm-runtime.mjs` | Node/Rust dispatcher via `RLM_RUNTIME` | no | keep until 115; simplify in 119 |
| `package.json` `test` | Full Node test suite via `run-test-suite.mjs` | indirect | 119 (Rust-only CI) |
| `package.json` `check` | typecheck + lint + depcruise + npm test | indirect | 119 |
| `tests/ui/reg03-static-wiring.test.ts` | Static import checks referencing TS paths | no | 118 |
| `tests/runtime/composition/runtime-composition-init-order.test.ts` | Runtime composition init order | no | 118 |
| `tests/domain/recursion/recursive-language-model.test.ts` | Domain orchestrator tests | no | 117 |

---

## Explicitly kept (not deleted in 114–119)

- **`ui/`** — React source, Vite config, static asset build (no Node at runtime post-cutover)
- **`scripts/`** — packaging (`packaging/`), RAM gates (`lib/ram-gate.mjs`, `cargo-with-ram-gate.mjs`), Rust boundary checks, agent-safe verify, Tauri helpers; Node-specific scripts pruned per phase
- **`crates/`** — sole runtime (`rlm-core`, `rlm-cli`, `rlm-tauri`)
- **`src-tauri/`** — Tauri desktop shell (in-process Rust server)
- **`tests/fixtures/control-server/`** — shared golden JSON (used by Rust fixtures post-114)

---

## Deletion order (summary)

1. **Phase 114** — `src/application/control-server/`, `tests/integration/control-server-fixtures.test.ts`, `scripts/parity/compare-runtimes.mjs` TS boot — Gate: `control_server_matches_golden_fixtures` passes; no TS server in CI
2. **Phase 115** — `src/index.ts`, `src/cli/`, `src/runtime/`, `package.json bin.rlm` → dispatcher — Gate: `npm run rlm -- --help` via Rust; Tauri smoke
3. **Phase 116** — `src/application/` (execution, graph, memory, config, bootstrap, plugins facade) — Gate: `cargo test -p rlm-core`; ask/ui paths via Rust
4. **Phase 117** — `src/domain/`, `src/ports/`, `tests/domain/` — Gate: `cargo test -p rlm-core`; no TS imports in ui/scripts
5. **Phase 118** — `src/adapters/`, `src/plugins/`, mirrored `tests/adapters/`, `tests/plugins/`, `tests/runtime/`, TS integration — Gate: entire `src/` absent; `cargo test -p rlm-core`
6. **Phase 119** — npm TS build deps, depcruise, Node-specific scripts, `typecheck`/`check` consolidation — Gate: `npm run check:rust` + `build:ui`; AGENTS.md Rust-only
7. **Phase 120** — Constrained Ollama tool envelope (Rust only) — Gate: envelope tests per TOOL-CALLING research doc

Canonical teardown policy: `.planning/notes/rust-only-runtime-migration-decisions.md`

---

## Appendix A: src/ TypeScript files (148)

Run `find src -type f -name '*.ts' | sort` for the authoritative list. Snapshot from 2026-05-24:

```
src/adapters/index.ts
src/adapters/models/http-language-model.ts
src/adapters/models/ollama-embedding-model.ts
src/adapters/models/ollama-language-model.ts
src/adapters/persistence/file-memory-store.ts
src/adapters/persistence/file-run-state-store.ts
src/adapters/persistence/file-session-store.ts
src/adapters/persistence/file-vector-index.ts
src/adapters/persistence/in-memory-trace.ts
src/application/agent-registry.ts
src/application/agent-runner.ts
src/application/bootstrap/adapters.ts
src/application/bootstrap/build-runtime-context.ts
src/application/bootstrap/index.ts
src/application/bootstrap/types.ts
src/application/config/defaults.ts
src/application/config/host-resolution.ts
src/application/config/index.ts
src/application/config/loader.ts
src/application/config/model-override.ts
src/application/config/runtime-resolution.ts
src/application/config/schema.ts
src/application/config/starter-seed.ts
src/application/config/types.ts
src/application/config/validation.ts
src/application/config/yaml-merge.ts
src/application/control-server/control-server-deps.ts
src/application/control-server/handlers/graph.ts
src/application/control-server/handlers/model-library.ts
src/application/control-server/handlers/plugins.ts
src/application/control-server/handlers/session.ts
src/application/control-server/handlers/static-ui.ts
src/application/control-server/handlers/workflows.ts
src/application/control-server/http-utils.ts
src/application/control-server/index.ts
src/application/control-server/route-request.ts
src/application/control-server/start-input-from-bootstrap.ts
src/application/control-server/types.ts
src/application/execution/agent-registry.ts
src/application/execution/agent-runner.ts
src/application/execution-controller.ts
src/application/execution/execution-controller.ts
src/application/execution/model-library.ts
src/application/execution/model-provider.ts
src/application/execution/model-ram-guard.ts
src/application/execution/resource-cleanup.ts
src/application/execution/run-recursive-prompt.ts
src/application/execution/runtime-events.ts
src/application/execution/ui-execution-runner.ts
src/application/execution/workflow-runner.ts
src/application/graph-executor.ts
src/application/graph/graph-executor.ts
src/application/graph/graph-planner.ts
src/application/graph/graph-workflow-runner.ts
src/application/graph/graph-workflow-serializer.ts
src/application/graph/graph-workflow-store.ts
src/application/graph/graph-workflow-types.ts
src/application/graph-planner.ts
src/application/graph-workflow-runner.ts
src/application/graph-workflow-serializer.ts
src/application/graph-workflow-store.ts
src/application/graph-workflow-types.ts
src/application/memory-manager.ts
src/application/memory/memory-manager.ts
src/application/memory/memory-resolver.ts
src/application/memory-resolver.ts
src/application/memory/semantic-memory-index.ts
src/application/memory/session-memory-bridge.ts
src/application/model-library.ts
src/application/model-provider.ts
src/application/plugins/index.ts
src/application/plugins/paths.ts
src/application/plugins/plugin-registry-service.ts
src/application/project-config.ts
src/application/resource-cleanup.ts
src/application/run-recursive-prompt.ts
src/application/runtime-events.ts
src/application/semantic-memory-index.ts
src/application/session-memory-bridge.ts
src/application/ui-execution-runner.ts
src/application/workflow-runner.ts
src/cli/args.ts
src/cli/first-run.ts
src/cli/render.ts
src/cli/run-modes/agent-workflow.ts
src/cli/run-modes/plan-node.ts
src/cli/run-modes/plugin-commands.ts
src/cli/run-modes/session-commands.ts
src/cli/run-modes/ui.ts
src/cli/run-modes/workflow-graph-io.ts
src/cli/runtime-logger.ts
src/cli/shutdown.ts
src/cli/ui-dist-dir.ts
src/domain/agent-config.ts
src/domain/agents.ts
src/domain/execution-failure.ts
src/domain/recursion/budget-guard.ts
src/domain/recursion/execution-graph-sync.ts
src/domain/recursion/prompt-utilities.ts
src/domain/recursion/quality-loop.ts
src/domain/recursion/tool-round-loop.ts
src/domain/recursive-language-model.ts
src/domain/run-state-persistence.ts
src/domain/types.ts
src/index.ts
src/plugins/builtin/files/register.ts
src/plugins/builtin/files/workspace-file-write-tool.ts
src/plugins/builtin/index.ts
src/plugins/builtin/shell/guarded-shell-tool.ts
src/plugins/builtin/shell/register.ts
src/plugins/builtin/web/content-tree.ts
src/plugins/builtin/web/register.ts
src/plugins/builtin/web/search-query.ts
src/plugins/builtin/web/web-fetch-tool.ts
src/plugins/builtin/web/web-search-tool.ts
src/plugins/categories.ts
src/plugins/__depcruise-fixtures__/forbidden-application-import.ts
src/plugins/index.ts
src/plugins/legacy-extensions.ts
src/plugins/manifest-schema.ts
src/plugins/paths.ts
src/plugins/plugin-loader.ts
src/plugins/remote-fetch/archive-extract.ts
src/plugins/remote-fetch/constants.ts
src/plugins/remote-fetch/git-fetch.ts
src/plugins/remote-fetch/index.ts
src/plugins/remote-fetch/safe-path.ts
src/plugins/remote-fetch/url-detection.ts
src/plugins/types.ts
src/ports/embedding-port.ts
src/ports/extension-host-port.ts
src/ports/extension-port.ts
src/ports/language-model-port.ts
src/ports/memory-store-port.ts
src/ports/run-state-store-port.ts
src/ports/runtime-logger-port.ts
src/ports/session-store-port.ts
src/ports/skill-loader-port.ts
src/ports/tool-port.ts
src/ports/trace-port.ts
src/runtime/composition/build-runtime-context.ts
src/runtime/composition/extension-host.ts
src/runtime/composition/index.ts
src/runtime/composition/init-order.ts
src/runtime/composition/runtime-composition.ts
src/runtime/interop/index.ts
src/runtime/interop/interop-runtime.ts
src/runtime/interop/mcp-skill-runtime.ts
```

---

## Appendix B: tests/ TypeScript files (40)

Run `find tests -type f -name '*.ts' | sort` for the authoritative list. Snapshot from 2026-05-24:

```
tests/adapters/persistence/run-state-store.test.ts
tests/adapters/persistence/session-store.test.ts
tests/application/bootstrap/bootstrap-runtime.unit.test.ts
tests/application/config/config-resolution.unit.test.ts
tests/application/config/loader.unit.test.ts
tests/application/config/project-config-scopes.test.ts
tests/application/config/validation.unit.test.ts
tests/application/config/yaml-merge.unit.test.ts
tests/application/execution/model-host-routing.test.ts
tests/application/execution/model-library.test.ts
tests/application/graph/graph-executor-resume.test.ts
tests/application/graph/graph-executor.test.ts
tests/application/graph/graph-planner.test.ts
tests/application/graph/graph-workflow.test.ts
tests/application/memory/memory-store.test.ts
tests/application/memory/session-memory-bridge.test.ts
tests/application/plugins/plugin-registry-service.test.ts
tests/depcruise/concern-map-rules.unit.test.ts
tests/domain/constrained-tool-calling.test.ts
tests/domain/recursion/budget-guard.unit.test.ts
tests/domain/recursion/execution-graph-sync.unit.test.ts
tests/domain/recursion/prompt-utilities.unit.test.ts
tests/domain/recursion/recursive-language-model.test.ts
tests/helpers/mock-language-model.ts
tests/helpers/mock-plan-model.ts
tests/helpers/quality-loop-helpers.ts
tests/helpers/recursion-fixtures.ts
tests/helpers/simple-tools.ts
tests/integration/control-server-fixtures.test.ts
tests/integration/integration-v15.test.ts
tests/plugins/builtin/web/web-tools.test.ts
tests/plugins/plugin-loader.test.ts
tests/plugins/remote-fetch.test.ts
tests/runtime/composition/extension-host.test.ts
tests/runtime/composition/runtime-composition-init-order.test.ts
tests/runtime/interop/mcp-skill-interoperability.test.ts
tests/ui/first-run-launcher.test.ts
tests/ui/reg01-static-wiring.test.ts
tests/ui/reg03-static-wiring.test.ts
tests/ui/shell-boundaries.test.ts
```
