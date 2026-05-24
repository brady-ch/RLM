# Phase 113: TS-Only Path Inventory

**Phase 113 scope is audit-only — no `src/` deletions in this phase.**

Total TypeScript files under `src/`: **148** (verified via `find src -type f -name '*.ts' | wc -l`).

Total TypeScript files under `tests/`: **40** (verified via `find tests -type f -name '*.ts' | wc -l`).

---

## cli

- **File count:** 12
- **Subdirectories:** `src/cli/`, `src/cli/run-modes/`
- **Mirrored tests path:** No direct `tests/cli/` mirror; UI wiring tests at `tests/ui/`
- **Target phase:** 115
- **Rust counterpart:** `crates/rlm-cli/src/` (command dispatch, stderr logging, shutdown)

Files:

```
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
```

---

## runtime

- **File count:** 8
- **Subdirectories:** `src/runtime/composition/`, `src/runtime/interop/`
- **Mirrored tests path:** `tests/runtime/composition/`, `tests/runtime/interop/`
- **Target phase:** 115
- **Rust counterpart:** `crates/rlm-core/src/plugins/` (composition/registry), `crates/rlm-core/src/interop/` (MCP/skill runtime)

Files:

```
src/runtime/composition/build-runtime-context.ts
src/runtime/composition/extension-host.ts
src/runtime/composition/index.ts
src/runtime/composition/init-order.ts
src/runtime/composition/runtime-composition.ts
src/runtime/interop/index.ts
src/runtime/interop/interop-runtime.ts
src/runtime/interop/mcp-skill-runtime.ts
```

Mirrored tests (3 files):

```
tests/runtime/composition/extension-host.test.ts
tests/runtime/composition/runtime-composition-init-order.test.ts
tests/runtime/interop/mcp-skill-interoperability.test.ts
```

---

## application (control-server subset)

- **File count:** 12 (under `src/application/control-server/`)
- **Subdirectories:** `src/application/control-server/`, `src/application/control-server/handlers/`
- **Mirrored tests path:** `tests/integration/control-server-fixtures.test.ts`
- **Target phase:** 114
- **Rust counterpart:** `crates/rlm-core/src/control_server/`

Files:

```
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
```

Related TS UI bootstrap: `src/cli/run-modes/ui.ts` (boots TS control server — Phase 114).

---

## application (remainder)

- **File count:** 60 (72 total minus 12 control-server)
- **Subdirectories:** `bootstrap/`, `config/`, `execution/`, `graph/`, `memory/`, `plugins/`, plus legacy root re-exports
- **Mirrored tests path:** `tests/application/bootstrap/`, `tests/application/config/`, `tests/application/execution/`, `tests/application/graph/`, `tests/application/memory/`, `tests/application/plugins/`
- **Target phase:** 116
- **Rust counterpart:** `crates/rlm-core/src/application/`

Key subdirectories:

```
src/application/bootstrap/     (4 files)
src/application/config/        (11 files)
src/application/execution/     (11 files)
src/application/graph/         (6 files)
src/application/memory/        (5 files)
src/application/plugins/       (3 files)
src/application/*.ts             (legacy root re-exports, 20 files)
```

Mirrored tests (14 files under `tests/application/`).

---

## domain

- **File count:** 11
- **Subdirectories:** `src/domain/`, `src/domain/recursion/`
- **Mirrored tests path:** `tests/domain/`, `tests/domain/recursion/`
- **Target phase:** 117
- **Rust counterpart:** `crates/rlm-core/src/domain/`

Files:

```
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
```

Mirrored tests (5 files under `tests/domain/`).

---

## ports

- **File count:** 11
- **Subdirectories:** `src/ports/` (flat)
- **Mirrored tests path:** No dedicated `tests/ports/` mirror (contracts tested via domain/application tests)
- **Target phase:** 117
- **Rust counterpart:** `crates/rlm-core/src/ports/`

Files:

```
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
```

---

## adapters

- **File count:** 9
- **Subdirectories:** `src/adapters/models/`, `src/adapters/persistence/`
- **Mirrored tests path:** `tests/adapters/persistence/`
- **Target phase:** 118
- **Rust counterpart:** `crates/rlm-core/src/adapters/`, `crates/rlm-core/src/persistence/`

Files:

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
```

Mirrored tests (2 files under `tests/adapters/`).

---

## plugins

- **File count:** 24
- **Subdirectories:** `src/plugins/builtin/`, `src/plugins/remote-fetch/`, `src/plugins/__depcruise-fixtures__/`
- **Mirrored tests path:** `tests/plugins/`, `tests/plugins/builtin/web/`
- **Target phase:** 118
- **Rust counterpart:** `crates/rlm-core/src/plugins/`

Files (24 under `src/plugins/` including builtin shell/files/web, manifest, loader, remote-fetch).

Mirrored tests (3 files under `tests/plugins/`).

---

## index.ts

- **File count:** 1
- **Path:** `src/index.ts`
- **Mirrored tests path:** None (CLI entry tested via integration)
- **Target phase:** 115
- **Rust counterpart:** `crates/rlm-cli/src/main.rs`

---

## Node-dependent scripts and CI

| Path | What it does | Boots TS server? | Removal phase |
|------|--------------|------------------|---------------|
| `scripts/parity/compare-runtimes.mjs` | Boots TS + Rust servers for session route parity | **yes** | Phase 114 (retire or Rust-only rewrite) |
| `tests/integration/control-server-fixtures.test.ts` | Boots TS server for golden fixtures | **yes** | Phase 114 (delete; Rust fixture remains) |
| `package.json` `check:parity` | Runs TS fixture test + compare-runtimes + Rust golden | **yes** | Phase 114 (narrow to Rust-only) |
| `package.json` `dev` | `tsx src/index.ts` — Node CLI dev entry | no | Phase 115 |
| `package.json` `start` | `node dist/src/index.js` | no | Phase 115 |
| `package.json` `build` | `tsc -p tsconfig.json` — TS compile | no | Phase 119 |
| `package.json` `rlm:node` | Direct Node dist entry | no | Phase 115 |
| `package.json` `bin.rlm` | Points to `dist/src/index.js` (bypasses dispatcher) | no | Phase 115 (point at Rust wrapper) |
| `package.json` `rlm` | `node scripts/rlm-runtime.mjs` — dispatcher | no | keep (Phase 115 simplifies to Rust-only) |
| `scripts/rlm-runtime.mjs` | Node/Rust dispatcher | no | keep until Phase 115 simplifies to Rust-only |
| `src/cli/run-modes/ui.ts` | Boots TS control server for `rlm ui` | **yes** | Phase 114 |
| `tests/domain/recursion/recursive-language-model.test.ts` | Imports `startControlServer` for integration tests | **yes** | Phase 114 (remove server boot paths) |
| `tests/depcruise/concern-map-rules.unit.test.ts` | Validates TS boundary rules | no | Phase 119 |
| `tests/integration/integration-v15.test.ts` | Cross-cutting integration | varies | Phase 118 |
| `tests/ui/*.test.ts` | Static UI wiring (reads fixture JSON, no server boot) | no | keep |

### package.json scripts (Node runtime related)

| Script | Command | Phase |
|--------|---------|-------|
| `dev` | `tsx src/index.ts` | 115 |
| `start` | `node dist/src/index.js` | 115 |
| `build` | `tsc -p tsconfig.json` | 119 |
| `check:parity` | build + TS fixtures + compare-runtimes + Rust golden | 114 |
| `rlm:node` | `node dist/src/index.js` | 115 |
| `rlm` | `node scripts/rlm-runtime.mjs` | keep → 115 Rust-only |
| `typecheck` | `tsc --noEmit` | 119 |
| `depcruise:strict` | dependency-cruise src | 119 |
| `lint` | eslint src tests ui/src | 119 (src/tests pruned) |

---

## Explicitly kept (not deleted in 114–119)

- **`ui/`** — React source + Vite config; builds static assets served by Rust control server / Tauri
- **`scripts/`** — packaging (`scripts/packaging/`), RAM gates (`scripts/lib/ram-gate.mjs`, `scripts/cargo-with-ram-gate.mjs`), Rust boundary checks (`scripts/check-rust-boundaries.sh`), agent-safe verify (`scripts/agent-safe-verify.mjs`); Node-specific scripts pruned per phase
- **`crates/`** — sole runtime implementation (`rlm-core`, `rlm-cli`, `rlm-tauri`)
- **`src-tauri/`** — Tauri desktop shell; in-process Rust server (no Node child)
- **`tests/fixtures/control-server/`** — shared golden fixture JSON (data only; kept after Phase 114)
- **`tests/ui/`** — static UI wiring tests (no TS server boot)

---

## Deletion order (summary)

1. **Phase 114** — `src/application/control-server/`, `src/cli/run-modes/ui.ts`, `scripts/parity/compare-runtimes.mjs`, `tests/integration/control-server-fixtures.test.ts`, TS portions of `check:parity` — Gate: `cargo test -p rlm-core control_server_matches_golden_fixtures` passes; no TS server boot in CI
2. **Phase 115** — `src/index.ts`, `src/cli/`, `src/runtime/`, `package.json bin.rlm` → Rust wrapper — Gate: `npm run rlm -- --help` invokes Rust CLI; Tauri smoke
3. **Phase 116** — `src/application/` (execution, graph, memory, config, bootstrap, plugins facade), `tests/application/` — Gate: `cargo test -p rlm-core` green
4. **Phase 117** — `src/domain/`, `src/ports/`, `tests/domain/` — Gate: `cargo test -p rlm-core` green
5. **Phase 118** — `src/adapters/`, `src/plugins/`, `tests/adapters/`, `tests/plugins/`, `tests/runtime/`, TS integration tests — Gate: `cargo test -p rlm-core` green
6. **Phase 119** — npm toolchain (TS build deps, depcruise, Node-specific scripts, `typecheck`) — Gate: `npm run check:rust` + `npm run build:ui` + `test:agent:verify:light`
7. **Phase 120** — Constrained Ollama tool envelope in Rust only — Gate: envelope-specific tests per TOOL-CALLING research doc

Canonical teardown policy: `.planning/notes/rust-only-runtime-migration-decisions.md`
