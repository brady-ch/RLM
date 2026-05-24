# Agents and architecture

This repository is a **recursive language model CLI**: Rust `rlm-cli` is the sole CLI (Phase 115); no TypeScript runtime layers remain in `src/` after Phase 118. All orchestration, domain, ports, adapters, and plugins are Rust-only in `crates/rlm-core/`. Rust counterparts: `crates/rlm-cli/` (CLI), `crates/rlm-core/` (domain, ports, plugins, interop, control server).

## Concern map

The TypeScript `src/` tree is fully retired (Phases 115–118). **Dependency direction flows inward** in the Rust workspace: outer layers (CLI, application, control server) orchestrate; inner layers (domain, ports) define policy and contracts; runtime and plugins wire capabilities at the composition root; adapters implement port contracts for I/O.

```
~~application~~ ──► ~~domain~~
 (Removed Phase 116)  (Removed Phase 117)
     │                   ▲
     ▼                   │ (types only)
  ~~plugins/builtin~~ ├── ~~ports~~ ◄── ~~adapters~~ (persistence, models)
 (Removed Phase 118)    (Removed Phase 117)  (Removed Phase 118)
```

| Concern | Path | Role | May import |
|---------|------|------|------------|
| **cli** | `crates/rlm-cli/` | **Removed Phase 115** — Rust CLI only; was `src/cli/` | `rlm_core` public re-exports |
| ~~**application**~~ | ~~`src/application/`~~ | **Removed Phase 116** — use cases in `crates/rlm-core/src/application/` | — |
| ~~**domain**~~ | ~~`src/domain/`~~ | **Removed Phase 117** — recursion policy in `crates/rlm-core/src/domain/` | — |
| ~~**ports**~~ | ~~`src/ports/`~~ | **Removed Phase 117** — port contracts in `crates/rlm-core/src/ports/` | — |
| **runtime** | `crates/rlm-core/` (plugins, interop) | **Removed Phase 115** from TS — was `src/runtime/` | Rust composition in `rlm-core` |
| ~~**plugins**~~ | ~~`src/plugins/`~~ | **Removed Phase 118** — manifest, registry, builtins in `crates/rlm-core/src/plugins/` | — |
| ~~**adapters**~~ | ~~`src/adapters/`~~ | **Removed Phase 118** — persistence, model hosts in `crates/rlm-core/src/adapters/` and `crates/rlm-core/src/persistence/` | — |

**Supporting directories (not `src/` layers):**

| Path | Relates to | Notes |
|------|------------|-------|
| `tests/` | Rust runtime concerns | `tests/ui/` static UI wiring; `tests/depcruise/` boundary probes until Phase 119 |
| `ui/` | Rust control server (Phase 114+) | React UI; talks to Rust HTTP API, not domain directly |
| `scripts/` | cli packaging, desktop, dev tooling | Build/release helpers; no production import from deleted `src/` |

### Tests mirror

| `src/` concern | `tests/` path |
|----------------|---------------|
| ~~`application/*`~~ | **Removed Phase 116** — Rust tests in `crates/rlm-core/tests/application/` |
| ~~`domain/`~~ | **Removed Phase 117** — Rust tests in `crates/rlm-core/tests/domain/` |
| ~~`runtime/composition/`~~ | **Removed Phase 115** |
| ~~`runtime/interop/`~~ | **Removed Phase 115** |
| ~~`plugins/`~~ | **Removed Phase 118** — Rust tests in `crates/rlm-core/tests/plugins/` |
| ~~`adapters/persistence/`~~ | **Removed Phase 118** — Rust tests in `crates/rlm-core/tests/adapters/` and `crates/rlm-core/tests/persistence/` |
| ~~cross-cutting~~ | ~~`tests/integration/`~~ — **Removed Phase 116** |
| ~~shared~~ | ~~`tests/helpers/`~~ — **Removed Phase 118** |

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

**Optional follow-on (not enforced):** `no-application-to-adapters` — Rust application modules should reach concrete stores and model hosts through bootstrap composition rather than importing adapters directly.

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
| **persistence** | `crates/rlm-core/src/persistence/` | File stores, vector index, config loader | ports, domain types |
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

Transitional baseline empty as of Phase 107 — strict mode (`npm run check:rust:boundaries:strict`) passes.

Run `npm run check:rust:boundaries` or `bash scripts/check-rust-boundaries.sh` to verify. `npm run check:rust` includes the boundary check after fmt/clippy.

## Layout

| Area | Role |
|------|------|
| ~~`src/index.ts`~~ | **Removed Phase 115** — CLI is `crates/rlm-cli/` |
| ~~`src/cli/`~~ | **Removed Phase 115** — args/render in Rust CLI |
| ~~`src/application/`~~ | **Removed Phase 116** — use cases in [`crates/rlm-core/src/application/`](crates/rlm-core/src/application/) |
| ~~`src/runtime/`~~ | **Removed Phase 115** — composition/interop in `crates/rlm-core/` |
| ~~`src/plugins/`~~ | **Removed Phase 118** — plugin taxonomy in [`crates/rlm-core/src/plugins/`](crates/rlm-core/src/plugins/) |
| ~~`src/domain/`~~ | **Removed Phase 117** — recursion policy in [`crates/rlm-core/src/domain/`](crates/rlm-core/src/domain/) |
| ~~`src/ports/`~~ | **Removed Phase 117** — port contracts in [`crates/rlm-core/src/ports/`](crates/rlm-core/src/ports/) |
| ~~`src/adapters/`~~ | **Removed Phase 118** — persistence and model hosts in [`crates/rlm-core/src/adapters/`](crates/rlm-core/src/adapters/) and [`crates/rlm-core/src/persistence/`](crates/rlm-core/src/persistence/) |
| ~~`tests/helpers/`~~ | **Removed Phase 118** — orphaned fixtures importing deleted domain/ports |
| ~~`tests/domain/`~~ | **Removed Phase 117** — Rust domain tests in `crates/rlm-core/tests/domain/` |
| ~~`tests/application/`~~ | **Removed Phase 116** — Rust tests in `crates/rlm-core/tests/application/` |
| ~~`tests/runtime/`~~ | **Removed Phase 115** |
| ~~`tests/plugins/`~~ | **Removed Phase 118** — Rust plugin tests in `crates/rlm-core/tests/plugins/` |
| ~~`tests/adapters/`~~ | **Removed Phase 118** — Rust adapter tests in `crates/rlm-core/tests/adapters/` |
| ~~`tests/integration/`~~ | **Removed Phase 116** |

## Plugin taxonomy

Built-in and external plugins share one contract (Rust canonical):

1. **`rlm.plugin.json`** at the plugin root — validated in `crates/rlm-core/src/plugins/manifest.rs` before registration.
2. **`register(host: ExtensionHostPort)`** — registers tools/skill loaders/model hosts on the shared extension host.
3. **Categories** — `shell`, `files`, `web`, `interop` (extensible enum in `crates/rlm-core/src/plugins/categories.rs`).

Discovery order in the Rust plugin loader (`crates/rlm-core/src/plugins/`):

1. Built-ins under `crates/rlm-core/src/plugins/builtin/`
2. Configured entries (legacy `extensions.load` YAML normalized via compat shim)
3. Installed catalog at `.rlm/plugins/catalog.json`

MCP/skill interop tools are registered separately under `crates/rlm-core/src/interop/` and use the `interop` category in manifests when packaged as plugins.

## Extending

- **New built-in tools**: add under `crates/rlm-core/src/plugins/builtin/<category>/` with `rlm.plugin.json`, tool implementation, and `register.rs`; register the package in `crates/rlm-core/src/plugins/builtin/mod.rs`.
- **New external plugins**: ship `rlm.plugin.json` + `register` export; enable via legacy `extensions.load` (compat shim) or installed catalog; allowlist approval still applies before load.
- **New recursion policy or domain helpers**: add under `crates/rlm-core/src/domain/` (orchestrator in `recursive_language_model.rs`, pure helpers in `domain/recursion/`).
- **New port traits**: add under `crates/rlm-core/src/ports/`; keep domain free of concrete I/O.
- **New persistence or model hosts**: add under `crates/rlm-core/src/adapters/` or `crates/rlm-core/src/persistence/`; wire through bootstrap composition.
- **New config fields**: extend schema/types in `crates/rlm-core/src/persistence/config/` and `crates/rlm-core/src/application/config/`; preserve validation messages with path context.
- **New control-server endpoints**: add a handler module under `crates/rlm-core/src/control_server/handlers/`; keep session/graph authority in execution services.
- **New agents**: add a block under `agents` in `rlm.config.yaml` (models + tools); extend Rust agent registry in `crates/rlm-core/src/application/execution/` if you need a dedicated profile constructor.
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
