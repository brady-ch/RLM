# Agents and architecture

This repository is a **recursive language model CLI**: CLI entry in `src/index.ts` composes a `RuntimeContext` via `src/runtime/composition/` (facaded through `src/application/bootstrap/`), orchestration in `src/application/`, recursion policy in `src/domain/` (orchestrator + `domain/recursion/` helpers), I/O in `src/cli/`, boundaries in `src/ports/`, infrastructure adapters under `src/adapters/` (`persistence/`, `models/`), plugin packages under `src/plugins/`, and runtime wiring under `src/runtime/` (`composition/`, `interop/`). The local control plane lives under `src/application/control-server/` (HTTP handlers in `handlers/`).

## Concern map

Canonical layer boundaries for `src/` and how supporting directories relate. **Dependency direction flows inward:** outer layers (CLI, application) orchestrate; inner layers (domain, ports) define policy and contracts; runtime and plugins wire capabilities at the composition root; adapters implement port contracts for I/O.

```
cli ──► application ──► domain
  │         │              ▲
  │         ▼              │ (types only)
  └──► runtime/composition ├── ports ◄── adapters (persistence, models)
              │              ▲
              ├── interop    │
              └── plugins/builtin ──► register(host) on ExtensionHostPort
```

| Concern | Path | Role | May import |
|---------|------|------|------------|
| **cli** | `src/cli/` | Args, run-mode dispatch, stderr logging, shutdown | application facades, ports (types), bootstrap entry |
| **application** | `src/application/` | Use cases: execution, graph, memory, config, control-server, plugin manager facade | domain, ports, runtime facades via bootstrap |
| **domain** | `src/domain/` | Recursion policy, agent profiles, shared result types | ports (interfaces), domain/recursion helpers only |
| **ports** | `src/ports/` | Interface contracts (models, tools, stores, extension host) | nothing in `src/` except other ports |
| **runtime** | `src/runtime/` | Composition root + interop (MCP/skills); builds `RuntimeContext` | application modules needed for wiring, ports, plugins (load/register), adapters via bootstrap |
| **plugins** | `src/plugins/` | Manifest schema, loader, builtin/external packages | ports, adapters (tool impl), other plugins/builtin only |
| **adapters** | `src/adapters/` | Infrastructure: persistence stores, model hosts, tracing | ports, domain (types), plugins/builtin re-exports for transitional imports |

**Supporting directories (not `src/` layers):**

| Path | Relates to | Notes |
|------|------------|-------|
| `tests/` | Mirrors `src/` concerns | `tests/helpers/` shared fixtures; `tests/integration/` cross-cutting; layout matches table below |
| `ui/` | cli + application/control-server | React UI; talks to control-server HTTP API, not domain directly |
| `scripts/` | cli packaging, desktop, dev tooling | Build/release helpers; no production import from `src/` |

### Tests mirror

| `src/` concern | `tests/` path |
|----------------|---------------|
| `application/config/` | `tests/application/config/` |
| `application/bootstrap/` | `tests/application/bootstrap/` |
| `application/graph/` | `tests/application/graph/` |
| `application/memory/` | `tests/application/memory/` |
| `application/execution/` | `tests/application/execution/` |
| `domain/` | `tests/domain/` |
| `runtime/composition/` | `tests/runtime/composition/` |
| `runtime/interop/` | `tests/runtime/interop/` |
| `plugins/` | `tests/plugins/` |
| `adapters/persistence/` | `tests/adapters/persistence/` |
| cross-cutting | `tests/integration/` |
| shared | `tests/helpers/` |

### Dependency-cruiser rules

Boundary rules live in `.dependency-cruiser.js` at **error** severity. Rule names reference this concern map:

| Rule | Forbidden arc | Concern map rationale |
|------|---------------|----------------------|
| `no-domain-to-application` | domain → application | Domain holds policy, not orchestration |
| `no-domain-to-adapters` | domain → adapters | Domain stays free of concrete I/O |
| `no-domain-to-cli` | domain → cli | Domain stays free of CLI surface |
| `no-ports-to-application` | ports → application | Ports are interfaces only |
| `no-ports-to-adapters` | ports → adapters | Ports must not reference implementations |
| `no-ports-to-cli` | ports → cli | Ports stay transport-agnostic |
| `no-adapters-to-application` | adapters → application | Adapters implement ports, not use cases |
| `no-adapters-to-cli` | adapters → cli | Adapters stay below CLI |
| `no-plugins-to-application` | plugins → application | Plugins register via `ExtensionHostPort`, not orchestration |
| `no-plugins-to-cli` | plugins → cli | Plugins never import CLI |
| `no-plugins-to-domain` | plugins → domain | Plugins register tools; domain policy stays separate |
| `no-runtime-to-cli` | runtime → cli | Runtime composition stays below CLI; CLI logger/shutdown injected at bootstrap |
| `no-builtin-plugin-to-external-loader` | plugins/builtin → plugins/external | Built-ins must not depend on external install machinery |

**Optional follow-on (not enforced):** `no-application-to-adapters` — application modules should reach concrete stores and model hosts through `application/bootstrap/adapters.ts` (composition root) rather than importing `src/adapters/` directly. Documented exceptions until a later phase centralizes remaining call sites: `application/execution/agent-runner.ts` (`InMemoryTrace`), `application/memory/*` (vector index types), and `application/control-server/types.ts` (store type references for handler wiring).

Run `npm run depcruise:strict` (or `dependency-cruise src --config .dependency-cruiser.js`) to verify. `npm run check` uses strict depcruise without `--ignore-known`; `dependency-cruiser-baseline.json` remains empty.

## Rust workspace (`crates/`)

The Rust workspace mirrors the TypeScript concern map: **dependency direction flows inward** — outer layers (CLI, application, control server) orchestrate; inner layers (domain, ports) define policy and contracts; adapters and persistence implement port contracts; plugins and interop wire capabilities at the composition edge. `rlm-core` holds all layers under `crates/rlm-core/src/`; `rlm-cli` is the CLI transport crate and must use `rlm_core` public re-exports only.

```
rlm-cli ──► application / control_server ──► domain
  │                    │                        ▲
  │                    ▼                        │ (types only)
  └──► rlm_core facades ├── ports ◄── adapters
                          ▲
              plugins / interop (composition edge)
              persistence ◄── ports
```

| Concern | Path | Role | May import |
|---------|------|------|------------|
| **cli** | `crates/rlm-cli/src/` | Command dispatch, stderr logging, shutdown | `rlm_core` public re-exports (bootstrap, persistence facades, domain types), not internal `crate::` modules |
| **application** | `crates/rlm-core/src/application/` | Execution, graph, memory, config, bootstrap | domain, ports; persistence/adapters via documented bootstrap exceptions |
| **domain** | `crates/rlm-core/src/domain/` | Recursion policy, agent profiles, shared result types | ports (interfaces), `domain/recursion` helpers only |
| **ports** | `crates/rlm-core/src/ports/` | Trait contracts (models, tools, stores, extension host) | domain types, other ports |
| **adapters** | `crates/rlm-core/src/adapters/` | Model hosts (Ollama, etc.) | ports, domain types |
| **persistence** | `crates/rlm-core/src/persistence/` | File stores, vector index, config loader | ports, domain types; may re-export application config loaders (transitional) |
| **plugins** | `crates/rlm-core/src/plugins/` | Manifest, registry, builtins, runtime context | ports, interop, adapters (tool impl) |
| **interop** | `crates/rlm-core/src/interop/` | MCP/skill runtime and tool factories | ports, plugin paths |
| **control_server** | `crates/rlm-core/src/control_server/` | HTTP transport and handlers | application, ports, persistence (handler wiring) |
| **server** | `crates/rlm-core/src/server/` | Server bootstrap | control_server, application |
| **model_library** | `crates/rlm-core/src/model_library/` | HF/catalog service | ports, persistence paths |

### Rust boundary rules

Boundary rules live in `scripts/rust-boundary-rules.toml` and are enforced by `scripts/check-rust-boundaries.sh` at **error** severity. Rule names reference the concern map above.

| Rule | Forbidden arc | Concern map rationale |
|------|---------------|----------------------|
| `no-domain-to-persistence` | domain → persistence | Domain stays free of concrete stores |
| `no-domain-to-adapters` | domain → adapters | Domain stays free of model hosts |
| `no-domain-to-application` | domain → application | Domain holds policy, not orchestration |
| `no-domain-to-control_server` | domain → control_server | Domain stays transport-agnostic |
| `no-domain-to-plugins` | domain → plugins | Domain stays free of plugin machinery |
| `no-domain-to-interop` | domain → interop | Domain stays free of MCP/skill wiring |
| `no-ports-to-adapters` | ports → adapters | Ports are interfaces only |
| `no-ports-to-persistence` | ports → persistence | Ports must not reference implementations |
| `no-ports-to-control_server` | ports → control_server | Ports stay transport-agnostic |
| `no-ports-to-application` | ports → application | Ports are contracts, not use cases |
| `no-adapters-to-control_server` | adapters → control_server | Adapters implement ports, not HTTP |
| `no-adapters-to-application` | adapters → application | Adapters stay below orchestration |
| `no-persistence-to-control_server` | persistence → control_server | Stores stay below transport |
| `no-persistence-to-application` | persistence → application | Stores implement ports, not use cases |
| `no-plugins-to-application` | plugins → application | Plugins register via extension host, not orchestration |
| `no-plugins-to-domain` | plugins → domain | Plugins register tools; domain policy stays separate |
| `no-plugins-to-persistence` | plugins → persistence | Plugins reach stores through ports/bootstrap |

**Optional follow-on (not enforced):** `application` → `persistence` / `adapters` direct imports (bootstrap, memory index, handler wiring); `ports` → `domain` types for shared message/result shapes.

### Transitional boundary baseline (ratchet plan)

Default CI runs `scripts/check-rust-boundaries.sh` in **baseline mode** (known transitional arcs in `scripts/rust-boundary-baseline.json` are suppressed). Strict mode (`--strict` or `npm run check:rust:boundaries:strict`) fails on any arc; use only when baseline count reaches zero. **`no-domain-to-persistence` must never appear in the baseline.**

| Rule | From module | Rationale for defer | Removal condition |
|------|-------------|---------------------|-------------------|
| `no-persistence-to-application` | `persistence/config.rs` | Transitional config loader re-export from application until persistence owns config resolution | Move `load_project_config` / `merge_yaml_layers` behind a persistence facade or port; drop pub use |
| `no-plugins-to-application` | `plugins/runtime.rs` | Plugin runtime filters agent tools via `agent_registry` during composition | Expose filter API through ports/bootstrap; plugins register tools only via extension host |
| `no-plugins-to-persistence` | `plugins/registry/service.rs` | Registry service reads `LoadedProjectConfig` for install/doctor | Inject config through port at composition root; registry depends on ports only |
| `no-plugins-to-domain` | `plugins/builtin/shell.rs` | Builtin tools return `domain::types::ToolExecutionResult` | Consolidate tool result type under `ports/`; update all four builtin tools |
| `no-plugins-to-domain` | `plugins/builtin/web_fetch.rs` | Same transitional tool result type | Same as shell — ports consolidation |
| `no-plugins-to-domain` | `plugins/builtin/web_search.rs` | Same transitional tool result type | Same as shell — ports consolidation |
| `no-plugins-to-domain` | `plugins/builtin/write_file.rs` | Same transitional tool result type | Same as shell — ports consolidation |

Run `npm run check:rust:boundaries` or `bash scripts/check-rust-boundaries.sh` to verify. `npm run check:rust` includes the boundary check after fmt/clippy.

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
| [`tests/domain/`](tests/domain/) | Domain and recursion tests mirroring `src/domain/`. |
| [`tests/application/`](tests/application/) | Application concern tests (config, bootstrap, graph, memory, execution). |
| [`tests/runtime/`](tests/runtime/) | Runtime composition and interop tests mirroring `src/runtime/`. |
| [`tests/plugins/`](tests/plugins/) | Plugin manifest validation, loader discovery, and builtin tool tests. |
| [`tests/adapters/`](tests/adapters/) | Adapter infrastructure tests (persistence stores, etc.). |
| [`tests/integration/`](tests/integration/) | Cross-cutting integration suites. |

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

## Autonomous agent verification (OOM prevention)

Chained `npm run build` + `cargo test` + parallel GSD agents can OOM the desktop even on 32 GB machines (Cursor + compile + Vite stack concurrently).

**All test entry points check MemAvailable before running** via [`scripts/lib/ram-gate.mjs`](scripts/lib/ram-gate.mjs):

| Layer | Behavior |
|-------|----------|
| `npm test` | RAM gate before build, test suite, and packaging (`run-test-suite.mjs`) |
| `node --test` | `test-ram-preload.mjs` checks RAM **before every test case** (`beforeEach`) |
| `cargo test` | Use `node scripts/cargo-with-ram-gate.mjs -- cargo test ...` |
| Agent verify | `agent-safe-verify.mjs` gates **every** step (minimal / compile / build tiers) |

| Command | When |
|---------|------|
| `npm run test:agent:verify:light` | Default for phase execution |
| `npm run test:agent:verify` | REG-01 UAT preflight |
| `npm run test:reg03:preflight` | REG-03 operator UAT preflight |

**Do not run** `npm run check` or hand-rolled build chains in autonomous mode.

Gates auto-scale from host RAM. Default **strict** (block when low). Escape: `RAM_GATE_DISABLED=1` or `RAM_GATE_STRICT=0`. Overrides: `RAM_GATE_MINIMAL_MB`, `AGENT_VERIFY_BUILD_GATE_MB`, `AGENT_VERIFY_COMPILE_GATE_MB`, `RAM_GATE_WAIT_SEC`. Project GSD config: `parallelization.max_concurrent_agents: 1`.

## GSD Project Context (2026-05-08)

- Project initialized for recursive workflow planning/execution UX hardening.
- Active roadmap: `.planning/ROADMAP.md` (milestone v1.7 adapter & plugin taxonomy).
- Current focus: Phase 49 — local plugin manager (CLI + shared registry service).
