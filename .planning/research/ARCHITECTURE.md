# Architecture Patterns — v1.8 Rust Runtime Migration

**Domain:** Strangler migration from TypeScript `src/` layers to embedded Rust `rlm-core`, preserving React/Tauri UI via HTTP/SSE  
**Milestone:** v1.8 — Rust Runtime Migration  
**Researched:** 2026-05-22  
**Confidence:** HIGH for TS→Rust seam map (live `ports/`, control-server handlers, persistence layouts verified); MEDIUM for plugin ABI choice and ANN crate selection (phase-specific spikes in `.planning/research/questions.md`)

## Executive Summary

v1.8 replaces the **Node orchestration runtime** with an embedded Rust workspace while keeping the **TypeScript/React UI** unchanged. The migration map is already drawn: `src/ports/` become Rust traits, `src/domain/` becomes pure policy crates, `src/adapters/` become infrastructure impls, and `src/application/control-server/` becomes an Axum (or equivalent) HTTP surface. Tauri today spawns a bundled Node child (`spawn_rlm_ui` in `src-tauri/src/main.rs`); the end state embeds the Rust server in-process, serves `ui/dist` as static assets, and drops `dist/release/*/bin/node` from the installer.

The strangler path follows the priority order in `.planning/notes/rust-runtime-migration-direction.md`: **control server first** (UI contract freeze), then **recursive engine + graph executor**, then **persistence**, **vector index**, **model hosts**, and finally **CLI + Tauri shell cutover**. TS and Rust coexist behind an explicit runtime switch during development; parity is enforced by **HTTP/SSE golden fixtures**, not by maintaining two orchestration implementations in production.

---

## Target System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ui/ — React 19 + Vite (unchanged)                                          │
│  fetch("/api/…") · EventSource("/api/events") · static assets from dist     │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ http://127.0.0.1:{port}  (preserve today)
┌───────────────────────────────▼─────────────────────────────────────────────┐
│  src-tauri/ — Tauri 2 shell                                                 │
│  · setup: start embedded rlm-core server (no Node child)                    │
│  · redirect webview to listening URL (same stderr/redirect pattern optional)│
│  · ensure Ollama readiness (Rust or retained small helper script)           │
│  · on close: stop server + cleanup MCP children                             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ in-process library call
┌───────────────────────────────▼─────────────────────────────────────────────┐
│  rlm-core workspace (Rust)                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────────┐ │
│  │ control-server  │  │ application svc  │  │ runtime/composition         │ │
│  │ HTTP + SSE      │→ │ session · graph  │→ │ plugin loader · interop MCP │ │
│  └─────────────────┘  │ memory · plugins │  └─────────────┬─────────────┘ │
│                        └────────┬─────────┘                │               │
│                                 ▼                          ▼               │
│                        ┌────────────────┐         ┌───────────────────────┐ │
│                        │ domain         │         │ adapters              │ │
│                        │ recursion RLM  │         │ persistence · models    │ │
│                        │ graph policy   │         │ vector · embeddings   │ │
│                        └────────┬───────┘         └───────────┬───────────┘ │
│                                 └────────── ports (traits) ───┘             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ HTTP (default) / optional in-proc later
┌───────────────────────────────▼─────────────────────────────────────────────┐
│  Ollama · Hugging Face hub (download/registry) · optional llama.cpp          │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Integration principle:** The UI never imports Rust. Tauri never duplicates business logic. All execution authority lives in `rlm-core`; the webview is a transport client exactly as it is today against the TypeScript control server.

---

## Crate / Module Map (`rlm-core`)

Use a **Cargo workspace** at repo root (alongside `src-tauri/`) with crate boundaries mirroring v1.7 concern map and dependency-cruiser direction. Inner crates depend inward: `ports` ← `domain` ← `adapters` / `plugins`; `runtime` and `control-server` compose at the top; `cli` and `tauri` are thin entrypoints.

| Rust crate | TS mirror | Responsibility | Key traits / types |
|------------|-----------|----------------|-------------------|
| **`rlm-ports`** | `src/ports/` | Contract-only traits + shared DTOs | `LanguageModelPort`, `ToolPort`, `EmbeddingPort`, `MemoryStorePort`, `SessionStorePort`, `RunStateStorePort`, `TracePort`, `RuntimeLoggerPort`, `ExtensionHostPort`, `SkillLoaderPort` |
| **`rlm-domain`** | `src/domain/` | Recursion policy, agent profiles, shared result types | `RecursiveLanguageModel`, `budget-guard`, `tool-round-loop`, `quality-loop`, `execution-graph-sync`, `RunStatePersistence`, `types` |
| **`rlm-adapters`** | `src/adapters/` | Infrastructure I/O only | `FileSessionStore`, `FileMemoryStore`, `FileRunStateStore`, `FileVectorIndex` → `AnnVectorIndex`, `OllamaLanguageModel`, `OllamaEmbeddingModel`, HF registry client, `InMemoryTrace` |
| **`rlm-plugins`** | `src/plugins/builtin/` | Built-in tool registrations (Rust impls) | `register(host)` per category: shell, files, web |
| **`rlm-runtime`** | `src/runtime/` | Composition root + interop | `build_runtime_context`, `ExtensionHost`, `PluginLoader`, MCP/skill interop (`interop-runtime`, `mcp-skill-runtime`) |
| **`rlm-application`** | `src/application/` (orchestration only) | Use-case services consumed by HTTP handlers | `ExecutionController`, `GraphExecutor`, `GraphPlanner`, `MemoryManager`, `MemoryResolver`, `SemanticMemoryIndex`, `PluginRegistryService`, agent/workflow runners |
| **`rlm-control-server`** | `src/application/control-server/` | HTTP routing, SSE, static UI | Route chain matching `route-request.ts` precedence; handler modules: session, graph, workflows, model-library, plugins, static-ui |
| **`rlm-config`** | `src/application/config/` | YAML load, validate, resolve | Zod-equivalent: `serde` + custom validator or `validator` crate; same paths (`rlm.config.yaml`, `.rlm/`) |
| **`rlm-cli`** | `src/index.ts` + `src/cli/` | `rlm ui`, agent/workflow run modes, plugin admin | Clap subcommands; calls `build_runtime_context` + `start_control_server` |
| **`rlm-tauri-bridge`** (optional) | `src-tauri/src/main.rs` lifecycle | Start/stop server, Ollama gate, webview URL | Linked by `recursive-language-model` Tauri crate |

### Submodule layout inside crates

```text
rlm-domain/
  recursion/          # prompt-utilities, budget-guard, tool-round-loop, quality-loop, execution-graph-sync
  recursive_language_model.rs
  agents.rs, types.rs, run_state_persistence.rs

rlm-adapters/
  persistence/        # file-* stores, ann-vector-index
  models/             # ollama, http, hf-hub registry
  tracing/

rlm-runtime/
  composition/        # build_runtime_context, extension_host, plugin_loader, runtime_composition, init_order
  interop/            # mcp-skill-runtime, interop-runtime

rlm-control-server/
  handlers/           # session, graph, workflows, model_library, plugins, static_ui
  route_request.rs    # preserve legacy probe order
  http_utils.rs
```

**Dependency rule (Rust analogue of depcruise):** `rlm-ports` imports nothing project-local; `rlm-domain` → `rlm-ports` only; `rlm-adapters` → `rlm-ports` + `rlm-domain` (types); `rlm-application` → `domain` + `ports`; `rlm-runtime` → `application` + `adapters` + `plugins`; `rlm-control-server` → `application` + `runtime`; `rlm-cli` → all. Enforce with `cargo-deny` or a small custom lint in CI.

---

## Integration Points

### Tauri ↔ Rust server ↔ static UI

| Concern | Today (v1.7) | Target (v1.8) |
|---------|--------------|---------------|
| Process model | Tauri spawns `rlm ui` Node child (`main.rs` `spawn_rlm_ui`) | Tauri calls `rlm_core::start_desktop()` in `setup` — no child process |
| UI assets | Node control server serves `uiDistDir` via `serveUiAsset` | Rust `static-ui` handler serves `frontendDist` (`../ui/dist` in `tauri.conf.json`) |
| API base URL | Child prints `RLM UI listening at http://127.0.0.1:{port}`; Tauri `eval` redirect | Same URL pattern: bind `127.0.0.1:0`, log/emit URL, redirect webview |
| Dev mode | `devUrl: http://127.0.0.1:5173` (Vite) proxies or hits TS server | Vite dev proxy → Rust server on fixed dev port **or** env `RLM_CONTROL_PORT` |
| Ollama check | Node runs `ensure-ollama.mjs` | Port to Rust (HTTP probe + model list) or keep script until Wave 6 |
| Shutdown | Kill Node child on window close | Drop server handle + `ResourceCleanup` for MCP children |
| Release bundle | `dist/release/{platform}/` includes `bin/node`, `dist/`, `ui-dist/`, shims | `bin/rlm` Rust binary + `ui-dist/` only; drop Node + TS `dist/src` |

**Recommendation:** Keep **real TCP localhost** (`127.0.0.1`) for the control server, not Tauri custom URL schemes. The UI relies on **`EventSource("/api/events")`** for SSE; `tauri-plugin-axum` custom protocols historically limit streaming (see [tauri-plugin-axum docs](https://docs.rs/tauri-plugin-axum)). Binding Axum to loopback preserves zero UI changes and matches the existing redirect contract.

### HTTP surface (must remain stable)

Route inventory derived from `src/application/control-server/handlers/` — **40+ endpoints** including:

| Surface | Methods / paths | Notes |
|---------|-----------------|-------|
| Session | `GET /api/session`, `/api/run-mode`, `/api/events` (SSE) | SSE is contract-critical |
| Chat / control | `POST /api/chat/*`, `/api/clarifications/*`, `/api/stop`, approval modes | Mutation errors → 409 JSON |
| Graph | `GET/POST /api/graph`, `/api/graph/layout`, `/api/graph/viewport` | |
| Nodes | `POST /api/nodes/{id}/{plan,edit,approve,…}` | Largest handler surface |
| Memory | `GET/POST/DELETE /api/memory*` | |
| Saved sessions | `GET/POST /api/saved-sessions*` | Multi-section bundle restore |
| Workflows | `/api/graph-workflows/*` | |
| Model library | `/api/model-library*` | HF search/install |
| Plugins | `/api/plugins*` | v1.7 registry service |
| Static | fallback → `ui/dist` | Same as `serveUiAsset` |

Dispatch **must preserve probe order** from `route-request.ts` (session snapshot before graph before static fallback) to avoid subtle UI regressions.

### External services (unchanged semantics)

| Service | Rust adapter location | v1.8 scope |
|---------|----------------------|------------|
| Ollama | `rlm-adapters/models/ollama` | Default inference host; keep HTTP client (`reqwest`) |
| Hugging Face | `rlm-adapters/models/hf` | Search, download, GGUF registry — no Python |
| MCP servers | `rlm-runtime/interop` | Subprocess stdio — port `createMcpTools` behavior |
| llama.cpp managed | Deferred | Handoff only per `managed-llama-cpp-runtime.md` seed |

---

## HTTP / SSE Contract Stability Strategy

**Primary gate: golden HTTP fixtures**, not a big-bang OpenAPI rewrite.

### Layer 1 — Fixture catalog (required from Wave 1)

1. Record representative request/response pairs from the TS control server into `tests/fixtures/control-server/` (JSON + raw SSE streams).
2. Rust integration tests spin up `rlm-control-server` on ephemeral port and `assert` status, headers, and JSON body (normalize timestamps/run-ids).
3. Cover at minimum: `GET /api/session`, `GET /api/graph`, `GET /api/events` (first N SSE frames), `POST /api/chat/message`, `POST /api/nodes/{id}/plan`, saved-session save/open round-trip, plugin list, model-library GET.

### Layer 2 — OpenAPI as derived documentation (recommended Wave 2)

- Generate OpenAPI 3.1 from the route table + handler request/response types (`utoipa` + Axum or manual spec).
- Treat spec as **downstream of fixtures**, not the source of truth — fixtures catch SSE and error-shape edge cases OpenAPI omits.

### Layer 3 — UI smoke (existing)

- Keep Vite build; optional Playwright against Rust server in CI desktop job.

### SSE-specific rules

- Event names and JSON payload keys must match TS `streamEvents` output character-for-character during migration.
- Add a dedicated SSE snapshot test that reads until `graph.updated` or timeout — do not rely on JSON-only tests.

**Confidence:** HIGH for fixture approach (pattern used implicitly in `tests/domain/recursion/recursive-language-model.test.ts` with `startControlServer`); MEDIUM for OpenAPI tooling choice until crate picked in STACK research.

---

## Migration Waves (match direction note priority)

Waves align with `.planning/notes/rust-runtime-migration-direction.md` and v1.7 seam completion.

```
Wave 0 ─ v1.7 stable (ports, runtime/, plugin loader) ─────────────────────┐
                                                                            │
Wave 1 ─ Workspace + control-server + static UI + SSE + fixtures ──────────┤
Wave 2 ─ Persistence ports (session, memory, run-state, preferences) ──────┤
Wave 3 ─ Recursive engine + ExecutionController + graph snapshot routes ───┤
Wave 4 ─ Graph executor + planner + node mutation routes + workflows ──────┤
Wave 5 ─ Vector + embedding (ANN index, scope-filtered retrieval) ─────────┤
Wave 6 ─ Model hosts + model-library + HF download path ───────────────────┤
Wave 7 ─ Built-in plugins (Rust) + MCP interop port ───────────────────────┤
Wave 8 ─ CLI binary + Tauri embed + packaging (no Node) + delete TS runtime ┘
```

### Wave detail

| Wave | Delivers | TS coexistence | Delete candidate |
|------|----------|----------------|------------------|
| **0** | v1.7 complete | TS only | — |
| **1** | `rlm-ports` skeleton, Axum router, static UI, `/api/session` stub or proxy | `RLM_RUNTIME=rust` serves UI; engine still TS optional | — |
| **2** | File stores read/write parity | Rust serves read APIs; writes dual-verify against TS | — |
| **3** | `RecursiveLanguageModel` in Rust; `GET /api/graph`, chat preview | Dual-run parity tests on orchestration | `src/domain/` (after parity) |
| **4** | `GraphExecutor`, full `/api/nodes/*`, workflows | TS engine behind flag for diff | `src/application/graph/`, execution runners |
| **5** | HNSW/USEARCH index; migrate `vector-index.json` | Read legacy JSON, write new sidecar | `FileVectorIndex`, `SemanticMemoryIndex` TS |
| **6** | Ollama + HF adapters, model-library routes | TS adapters deleted after parity | `src/adapters/models/` |
| **7** | Rust builtins + MCP interop | External ESM plugins: see plugin section | `src/plugins/builtin/` TS impls, `src/runtime/interop/` TS |
| **8** | `rlm` binary, Tauri in-process, release without Node | Remove TS runtime from CI/deb | `src/index.ts`, control-server, most `src/application/`, `src/adapters/`, bundled Node |

### Build-order dependency graph

```text
rlm-ports
    └── rlm-domain
            ├── rlm-adapters (persistence → models → vector)
            ├── rlm-plugins (builtin tools)
            └── rlm-application (execution, graph, memory, plugins svc)
                    └── rlm-runtime (composition + interop)
                            └── rlm-control-server
                                    ├── rlm-cli
                                    └── rlm-tauri-bridge → src-tauri

rlm-config → consumed by rlm-runtime (parallel to domain after ports)
```

**CI gates:** `cargo test --workspace` + `cargo clippy -D warnings` + fixture HTTP tests + existing `npm run check` for UI/tsconfig until TS runtime deleted; then split into `npm run check:ui` + `cargo test`.

---

## TS / Rust Coexistence During Strangler

### Runtime switch (recommended)

| Mechanism | Use |
|-----------|-----|
| **`RLM_RUNTIME=node\|rust`** env var | Dev and CI select backend; default `node` until Wave 8 |
| **`--features rust-runtime`** in Tauri | Ship Rust-only in release; keep Node fallback in dev during Waves 1–7 |
| **No dual orchestration in production desktop** | Installer ships one runtime; flag is dev/CI only |

### Dual-run parity (CI only)

- **Not** two servers on one port.
- Pattern: same fixture inputs → run TS test harness → run Rust test harness → diff normalized JSON.
- For long orchestration: golden trace files from `TracePort` / execution events.

### Avoid napi-rs for core orchestration

- napi-rs bridge tempting for incremental port but creates **third boundary** (TS↔Rust FFI) with threading and error-mapping cost.
- Prefer **module-by-module port** with HTTP-level parity at the control-server seam first, then delete TS module.

### Vite dev proxy

- Point `ui` dev server proxy `/api` → Rust port when `RLM_RUNTIME=rust`.
- Production Tauri loads same-origin static + API from embedded server.

---

## Plugin Strategy: WASM vs Native vs Rust Reimplement

| Approach | Fit for RLM | v1.8 recommendation |
|----------|-------------|---------------------|
| **Reimplement builtins in Rust** | shell, file-write, web-search, web-fetch | **Yes — Wave 7.** Matches shipped binary without dynamic JS; tools today are thin wrappers in `src/plugins/builtin/`. |
| **MCP interop (subprocess)** | External tool servers | **Port to Rust** — same as TS `runtime/interop`; not plugins in the WASM sense. |
| **Native `.so` / dylib** (`libloading`) | Third-party plugins | **Defer.** Same trust model as ESM `import()` but harder to audit; needs stable C ABI + manifest. Post-v1.8. |
| **WASM** (`wasmtime` / `wasmer`) | Sandboxed third-party tools | **Defer.** No filesystem/shell/network without WASI host calls; MCP and shell plugins don't map cleanly. Research spike only if marketplace returns. |
| **Retain Node for external ESM plugins** | v1.7 `PluginLoader` dynamic import | **Anti-pattern for v1.8 ship goal** (bundled Node). Accept: **external plugins disabled in Rust-only mode** until ABI lands; document in doctor output. |

### v1.8 plugin contract

```text
Built-in:     rlm-plugins → compile-time linked register() calls
MCP/skills:   rlm-runtime/interop → subprocess + allowlist (unchanged semantics)
External:     catalog.json entries show status=unsupported_rust_runtime until dylib ABI
```

Manifest schema (`rlm.plugin.json`) **stays** — Rust `PluginLoader` validates the same JSON for forward compatibility.

---

## Data Migration — On-Disk Formats

All paths remain project-local under `.rlm/` and `~/.rlm/plugins/` unless noted.

| Artifact | Location | Format today | Rust migration strategy |
|----------|----------|--------------|-------------------------|
| **Session bundle** | `.rlm/sessions/{id}/` | `manifest.json` + section envelopes (`session.json`, `run-state.json`, `memory.json`, `preferences.json`, `vector-index.json`, …) version **1** | **Read/write identical JSON.** Rust `FileSessionStore` ports `file-session-store.ts` envelope shape verbatim. |
| **Live vector index** | `.rlm/memory/vector-index.json` | JSON array of `VectorIndexRecord` | **Wave 5:** On first Rust open, ingest JSON → build ANN sidecar (e.g. `.rlm/memory/vector.index.bin`); keep JSON export for downgrade/debug; session bundle still embeds JSON snapshot for v1.4 restore semantics. |
| **Memory scopes / episodic** | `.rlm/memory/` (per run/session files) | JSON documents + audit log | Port TS layout; no schema bump unless corruption fixes require version **2** (bump `SECTION_VERSION` with migration). |
| **Run state** | `.rlm/runs/{run-id}/` | Versioned snapshot + mutation log | Port `FileRunStateStore`; optimistic concurrency unchanged. |
| **Workflows** | `.rlm/workflows/*.yaml` | YAML sidecars | Rust reads via `serde_yaml`; same as TS `graph-workflow-store.ts`. |
| **Plugin catalog** | `~/.rlm/plugins/catalog.json`, `.rlm/plugins/catalog.json` | JSON catalog from v1.7 | Same schema; Rust registry service reads/writes. |
| **Project config** | `rlm.config.yaml` | YAML + Zod validation | Rust `rlm-config` validates equivalent rules; share golden config fixtures. |
| **Allowlist** | `.rlm-allowlist.json` | SHA-256 hashes | Port hash logic from `ExtensionHost` allowlist. |

### Migration principles

1. **No big-bang converter** — lazy migration on read (vector index) or transparent dual-write during transition.
2. **Restore verification** — preserve `SavedSessionVerification` degraded/complete/failed semantics from `SessionStorePort`.
3. **Scope ACL before ANN** — filter by `memoryScopes` after top-k retrieval; never trust index alone (from `rust-vector-index.md` seed).

---

## What Gets Deleted vs Kept in `src/` After Migration

### Delete (post Wave 8)

| Path | Reason |
|------|--------|
| `src/index.ts` | Replaced by `rlm-cli` binary |
| `src/cli/run-modes/*` (execution paths) | Rust CLI |
| `src/application/control-server/` | `rlm-control-server` |
| `src/application/execution/` | Rust application crate |
| `src/application/graph/` | Rust graph services |
| `src/application/memory/` | Rust memory services |
| `src/application/plugins/` facade | Rust registry (keep thin TS only if UI build needs types — prefer OpenAPI gen) |
| `src/domain/` | `rlm-domain` |
| `src/adapters/` | `rlm-adapters` |
| `src/runtime/` | `rlm-runtime` |
| `src/plugins/builtin/` TS tool impls | Rust `rlm-plugins` |
| `dist/release/*/bin/node` | No bundled Node |
| `dist/src/` packaged TS output | Rust binary only |
| `spawn_rlm_ui` / Node lifecycle in `main.rs` | In-process server |

### Keep

| Path | Reason |
|------|--------|
| `ui/` | React UI — explicit non-goal to rewrite |
| `src-tauri/` | Desktop shell (rewired to Rust server) |
| `src/application/config/` (optional transitional) | Delete when `rlm-config` at parity; may remain briefly for shared YAML test fixtures |
| `tests/fixtures/` | HTTP golden files — language-agnostic |
| `tests/integration/` (rewritten) | Drive against Rust server |
| `scripts/packaging/build-release.mjs` | **Rewrite** for Rust artifact staging |
| `scripts/desktop/ensure-ollama.mjs` | Until Wave 6 Rust Ollama gate ships |
| `AGENTS.md` | Update concern map to Rust workspace |
| `.dependency-cruiser.js` | Scope shrinks to `ui/` + any remaining TS; or replace with UI-only ESLint |

### Transitional keep (Waves 1–7 only)

- Entire TS runtime behind `RLM_RUNTIME=node` for parity diffing.
- `npm run build` TS output for comparison tests — removed from release packaging Wave 8.

---

## Patterns to Follow

### Pattern 1: Ports-first porting

Port `src/ports/*.ts` to `rlm-ports` **before** adapters or domain logic. Each trait gets a mock impl for unit tests — mirrors `tests/helpers/` pattern.

### Pattern 2: Control-server strangler

Implement Rust handlers that delegate to the **same service boundaries** as TS (`ControlServerDeps` → Rust `AppState` struct with `Arc<dyn SessionService>` etc.). Do not merge handler logic into Axum closures.

### Pattern 3: Composition init order preserved

Port `COMPOSITION_INIT_ORDER` from `src/runtime/composition/init-order.ts` verbatim; add a Rust unit test equivalent to `tests/runtime/composition/runtime-composition-init-order.test.ts`.

### Pattern 4: Error vocabulary frozen

Mutation errors return `{ error: string }` with 409 for stale approval — match `route-request.ts` catch block. CLI exit codes stay aligned with `render.ts` semantics.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Tauri custom-protocol API without SSE validation

**What:** Switch to `axum://localhost` for all API traffic to avoid TCP.  
**Why bad:** `/api/events` SSE may break or buffer differently.  
**Instead:** Loopback HTTP until SSE parity proven on target platform.

### Anti-Pattern 2: Port recursive engine before session/graph read APIs

**What:** Rust orchestration while UI still hits TS for `/api/graph`.  
**Why bad:** Split-brain session state.  
**Instead:** Wave 1–2 freeze transport; single runtime owns session.

### Anti-Pattern 3: Big-bang vector format breaking session restore

**What:** Replace `vector-index.json` with binary-only without envelope migration.  
**Why bad:** v1.4 saved sessions fail verification.  
**Instead:** Lazy ingest + keep section envelope in bundles.

### Anti-Pattern 4: Keeping Node for “just external plugins”

**What:** Ship Rust core + Node sidecar for ESM plugins.  
**Why bad:** Defeats v1.8 success criterion (no bundled Node).  
**Instead:** Disable external plugins in Rust mode with explicit doctor message.

### Anti-Pattern 5: OpenAPI-only contract testing

**What:** Generate spec first, skip SSE fixtures.  
**Why bad:** Event stream shapes drift silently.  
**Instead:** Golden fixtures primary; OpenAPI derived.

---

## Scalability Considerations

| Concern | TS today | Rust v1.8 |
|---------|----------|-------------|
| Vector search | O(n) JSON scan | Sub-linear ANN (HNSW/USEARCH) |
| Session bundle size | Full read/write | Same; optional section streaming later |
| MCP processes | 1 per configured server | Same; Rust tokio subprocess management |
| Control server concurrency | Node single-thread + async | Tokio thread pool; watch `ExecutionController` mutex semantics |
| Desktop memory | Node + Rust during strangler | Single process after Wave 8 |

---

## Research Flags for Roadmap Phases

| Phase topic | Deeper research? | Reason |
|-------------|------------------|--------|
| ANN crate selection | **Yes** | `.planning/research/questions.md` Q1–Q2 |
| HF Rust download path | **Yes** | Q6 — `hf-hub` vs custom |
| SSE on Tauri Windows | **Maybe** | Loopback vs plugin-axum if port binding issues |
| External plugin ABI | **Defer** | Post-v1.8; document unsupported state |
| llama.cpp in-process | **Defer** | `managed-llama-cpp-runtime.md` seed |
| Config schema parity | **Unlikely** | Share fixtures between Zod and serde |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| TS→Rust module map | HIGH | Verified against live `ports/`, `domain/`, `runtime/`, control-server handlers |
| Tauri integration | HIGH | Current `main.rs` spawn model documented; loopback HTTP recommended |
| HTTP contract strategy | HIGH | Fixture approach matches existing test patterns |
| Plugin ABI | MEDIUM | Clear v1.8 scope: Rust builtins + MCP; external deferred |
| Vector migration | MEDIUM | ANN crate choice open; lazy migration path sound |
| Delete vs keep inventory | HIGH | Aligned with direction note and PROJECT.md |

---

## Sources

- `.planning/notes/rust-runtime-migration-direction.md` — priority order, target diagram, success criteria — **HIGH**
- `.planning/PROJECT.md` — v1.8 milestone scope — **HIGH**
- `.planning/seeds/rust-vector-index.md` — vector migration constraints — **HIGH**
- `.planning/seeds/managed-llama-cpp-runtime.md` — deferred inference — **HIGH**
- `src-tauri/src/main.rs`, `src-tauri/tauri.conf.json` — current Tauri/Node lifecycle — **HIGH**
- `src/application/control-server/route-request.ts`, `handlers/*.ts` — HTTP surface — **HIGH**
- `src/ports/*.ts` — trait map — **HIGH**
- `src/adapters/persistence/file-session-store.ts`, `file-vector-index.ts` — on-disk formats — **HIGH**
- `src/runtime/composition/build-runtime-context.ts`, `init-order.ts` — composition — **HIGH**
- `scripts/packaging/build-release.mjs` — release layout with bundled Node — **HIGH**
- [tauri-plugin-axum](https://docs.rs/tauri-plugin-axum) — streaming limitation on custom protocols — **MEDIUM**
- `.planning/research/questions.md` — open Rust crate questions — **HIGH**

---
*Architecture research for: v1.8 Rust Runtime Migration*  
*Researched: 2026-05-22*
