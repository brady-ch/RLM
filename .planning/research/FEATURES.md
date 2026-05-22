# Feature Landscape: v1.8 Rust Runtime Migration

**Domain:** Local recursive LM CLI + control-server UI — full Rust port of orchestration, persistence, adapters; UI unchanged; desktop without bundled Node  
**Milestone:** v1.8 — Rust Runtime Migration  
**Researched:** 2026-05-22  
**Confidence:** HIGH for RLM baseline (live control-server routes, persistence layout, domain orchestrator, v1.7 plugin taxonomy, Tauri child-process model); MEDIUM for ecosystem migration patterns (strangler fig, Tauri-in-process HTTP verified via official docs; Rust AI tool rewrites are anecdotal); LOW for external-plugin dynamic loading in Rust (no RLM decision yet)

---

## How Rust Runtime Migration Typically Works (Local AI Dev Tools)

Mature rewrites of Node/Python backends for local AI tools follow a **strangler fig** over an **unchanged HTTP/SSE contract**, not a big-bang cutover. The React/Tauri webview keeps calling `localhost` APIs; the implementation behind those routes moves module-by-module from TypeScript to Rust until the Node child can be removed.

### Common migration rhythm

| Phase | What happens | RLM mapping |
|-------|--------------|-------------|
| **1. Freeze the contract** | Document every route, SSE event shape, CLI flag, and on-disk file format the UI/CLI depend on | Control-server handlers in `src/application/control-server/handlers/*`; `.rlm/` persistence envelopes |
| **2. Extract ports** | Inner logic expressed as traits/interfaces; outer layers are thin transport | Existing `src/ports/*` → Rust traits in `rlm-core` |
| **3. Build → shadow → switch** | New Rust handler runs in parallel; compare outputs; flip routing per endpoint | Integration tests replay TS golden fixtures against Rust server; optional env flag `RLM_RUNTIME=rust` during dev |
| **4. Strangler ordering** | Transport + session state first; heavy orchestration second; perf-sensitive adapters third | Matches direction note: control server → recursive engine → persistence → vector → model hosts → CLI binary |
| **5. Desktop cutover** | Replace sidecar/spawn with in-process Rust server + static UI assets | Tauri `setup` starts Axum (or equivalent) instead of `spawn_rlm_ui` + bundled Node |
| **6. Decommission Node** | Remove `bin/node`, `rlm` shim, `dist/src/index.js` from release bundle | `scripts/packaging/build-release.mjs` ships Rust binary + `ui-dist/` only |

### Why local AI tools migrate to Rust

Evidence from production rewrites (RAGtronic Python→Rust, Node→Rust API case studies) converges on three drivers that match RLM's direction note:

1. **Streaming fidelity** — SSE token streams and long-lived `/api/events` connections suffer from GC pauses and memory growth in Node/Python; Rust removes mid-stream stutter (MEDIUM confidence — multiple independent post-mortems, not RLM-measured yet).
2. **Resource predictability** — Desktop bundles pay for idle runtime memory; removing bundled Node (~50–100MB+ before first request) matters for installer size and tray apps (HIGH for current RLM packaging — `build-release.mjs` copies full Node binary).
3. **Performance hotspots** — Vector search, file I/O, and concurrent tool rounds benefit from native code; orchestration correctness matters more than raw speed but ANN index is the first measurable win (HIGH — `FileVectorIndex` + linear cosine scan verified in repo).

### What stays unchanged

| Layer | v1.8 stance |
|-------|-------------|
| **UI** | TypeScript/React; Vite static assets; same fetch/SSE client |
| **Inference default** | Ollama HTTP remains primary host (strangler — do not replace on day one) |
| **Config** | `rlm.config.yaml` schema; project + global paths |
| **On-disk formats** | Session envelopes, run state, preferences — backward compatible or explicit migration command |

---

## Feature Categories

### 1. Control server API parity

The UI is a pure HTTP/SSE client. **Every route below is table stakes** — missing one breaks a panel or workflow. Route precedence in `route-request.ts` must be preserved (legacy ordering affects which handler wins ambiguous paths).

#### Session, chat, execution, approvals

| Method | Path | Behavior to preserve |
|--------|------|----------------------|
| GET | `/api/session` | Current session snapshot (graph, run state, chat) |
| GET | `/api/run-mode` | CLI vs UI bootstrap mode |
| GET | `/api/saved-sessions` | List saved session manifests |
| GET | `/api/memory` | Memory inspector payload |
| POST | `/api/memory/preferences` | Set preference key/value |
| DELETE | `/api/memory/preferences/:key` | Delete preference |
| POST | `/api/saved-sessions/save` | Persist session (memory + vector sections) |
| GET | `/api/saved-sessions/:id` | Load saved session metadata |
| POST | `/api/saved-sessions/:id/open` | Reopen session (merge vector index) |
| GET | `/api/events` | **SSE** execution event stream |
| POST | `/api/chat/message` | User message → planning/execution pipeline |
| POST | `/api/chat/apply` | Apply graph edits from chat |
| POST | `/api/chat/cancel` | Cancel in-flight chat turn |
| POST | `/api/chat/confirm-run` | Confirm run after plan preview |
| POST | `/api/clarifications/ask` | Agent clarification request |
| POST | `/api/clarifications/answer` | User answers clarification |
| POST | `/api/clarifications/abort` | Abort clarification flow |
| POST | `/api/stop` | Stop execution |
| POST | `/api/pause-future-auto-approvals` | Approval gate control |
| POST | `/api/approval-mode` | Switch approval mode |

**Error semantics:** 409 for mutation conflicts (`toMutationError`), 404 for unknown nodes, 400 default — must match UI handling.

#### Graph

| Method | Path | Behavior to preserve |
|--------|------|----------------------|
| GET | `/api/graph` | Full execution graph snapshot |
| POST | `/api/graph/layout` | Persist layout positions |
| POST | `/api/graph/viewport` | Persist viewport |
| POST | `/api/nodes/:id/edit` | Edit node prompt/config |
| POST | `/api/nodes/:id/model` | Node model override |
| POST | `/api/nodes/:id/sampling` | Node sampling override |
| POST | `/api/nodes/:id/expert` | Expert runtime mode |
| POST | `/api/nodes/:id/plan` | Plan/replan node |
| POST | `/api/nodes/:id/breakdown` | Decompose node |
| POST | `/api/nodes/:id/extend-budget` | Extend model-call budget |
| POST | `/api/nodes/:id/approve` | Approve gated node |
| POST | `/api/nodes/:id/skip` | Skip node |
| POST | `/api/nodes/:id/quality-loop/accept` | Accept quality-loop iteration |
| POST | `/api/nodes/:id/quality-loop/stop` | Stop quality loop |
| POST | `/api/nodes/add` | Add node |
| POST | `/api/nodes/:id/connect` | Connect edge |
| POST | `/api/nodes/:id/delete` | Delete node |

#### Workflows

| Method | Path | Behavior to preserve |
|--------|------|----------------------|
| GET | `/api/graph-workflows` | List saved workflows |
| POST | `/api/graph-workflows/export` | Export graph as workflow YAML |
| POST | `/api/graph-workflows/import` | Import workflow into session |

#### Model library

| Method | Path | Behavior to preserve |
|--------|------|----------------------|
| GET | `/api/model-library` | Curated + installed + jobs + tiers snapshot |
| GET | `/api/model-library/search?q=` | Hugging Face search |
| POST | `/api/model-library/install` | Start Ollama pull job |
| POST | `/api/model-library/select-tier` | Update tier → model mapping in config |

#### Plugins (v1.7 contract — Rust must implement same surface)

| Method | Path | Behavior to preserve |
|--------|------|----------------------|
| GET | `/api/plugins` | List installed/enabled plugins |
| GET | `/api/plugins/doctor` | Diagnostic report |
| POST | `/api/plugins/doctor/fix` | Explicit fix (never silent) |
| GET | `/api/plugins/:id/inspect` | Manifest + contributed capabilities |
| POST | `/api/plugins/install` | Local path or remote fetch → catalog |
| POST | `/api/plugins/enable` | Enable plugin in config |
| POST | `/api/plugins/disable` | Disable without delete |
| POST | `/api/plugins/uninstall` | Remove + config cleanup |
| POST | `/api/plugins/validate` | Author manifest check (no code load) |

#### Static UI

| Behavior | Notes |
|----------|-------|
| Serve `ui-dist/` assets | Fallback after API probes; `index.html` for `/` |

---

### 2. Recursive engine + graph executor behavior preservation

These are the **largest logic blocks** and the highest regression risk. Parity means observable behavior matches TS golden tests, not line-by-line port.

#### RecursiveLanguageModel (domain)

| Behavior | Why it matters | Parity signal |
|----------|----------------|---------------|
| DIRECT vs RECURSIVE classification | Branching policy | Same depth/budget outcomes on fixture prompts |
| Decompose → solve → summarize → synthesize pipeline | Core recursion | Trace event sequence matches |
| `maxModelCalls` / `maxToolRounds` budget guards | Prevents runaway cost | Hard stop with same error metadata |
| Tool rounds loop | Agent tool use | Tool call order + results in trace |
| Quality loop (accept/stop) | UI quality-loop buttons | Phase transitions in SSE |
| Execution graph sync | Live graph in UI | Node/edge states update during run |
| Run state persistence checkpoints | Resume after crash | `.rlm/run-state` reload continues correctly |
| Memory packet injection | Session memory in prompts | `contextPolicy` + scope ACL honored |
| Approval boundaries | Gated execution | 409 on stale approval token |
| Cancellation | Stop button | Clean abort mid-recursion |

#### GraphExecutor (application)

| Behavior | Why it matters | Parity signal |
|----------|----------------|---------------|
| Topological execution order | DAG runs | Cycle → `cycle_detected` error |
| Agent registry resolution | Node → agent profile | `invalid_agent` on bad id |
| Purpose routing (small/medium/large tiers) | Model selection | Same model host per tier config |
| Memory manager per node | Scoped memory writes | Episodic + structured scopes |
| Interactive execution session | UI-driven graph runs | Pause/approve integrates with control server |
| Failure propagation | `blocked_by_failure` | Downstream nodes skip correctly |

**Differentiator opportunity (not required for MVP parity):** Rust port enables tighter cancellation (shared `CancellationToken` across async tree) and lower latency SSE — but **ship parity first**, optimize second.

---

### 3. Persistence parity

All stores are file-based today — Rust should read/write **compatible formats** or ship a one-shot migration.

| Store | Path / format | Table stakes |
|-------|---------------|--------------|
| **Run state** | `FileRunStateStore` — run checkpoints | Resume in-progress execution |
| **Session save/reopen** | `FileSessionStore` — manifest + section envelopes (memory, vectorIndex, graph, …) | Save from UI; reopen merges vector records by `sessionId` |
| **Memory** | `FileMemoryStore` — structured scopes + episodic log | `MemoryResolver` ACL + scope versioning |
| **Preferences** | Memory store preferences namespace | CLI `--preference-set` / DELETE API |
| **Vector index (legacy)** | `.rlm/memory/vector-index.json` | Read during migration; merge on session open |
| **Plugin catalog** | `.rlm/plugins/catalog.json` | Installed plugin discovery |
| **Allowlist** | `.rlm-allowlist.json` SHA-256 path keys | Trust gate before external plugin load |
| **Project config** | `rlm.config.yaml` | Load, validate, tier overrides, plugin entries |

**Session snapshot vector section** (`SavedVectorIndexSection`) must round-trip: save → reopen → search returns same hits for equivalent query (within float tolerance).

---

### 4. CLI parity

Replace `dist/src/index.js` with Rust binary; **all commands and flags** remain.

| Command / surface | Subcommands / flags | Priority |
|-------------------|---------------------|----------|
| `rlm ask` (default) | `--json`, `--trace`, `--compact`, `--plan-only`, approval flags, `--agent`, `--workflow`, `--model`, config overrides | Table stakes |
| `rlm ui` | `--host`, `--port`, `--open-session`, serves control server + static UI | Table stakes |
| `rlm plan-node` | `--node-id`, replan modes | Table stakes |
| `rlm workflow-export` / `workflow-import` | File I/O | Table stakes |
| `rlm plugin` | `list`, `install`, `enable`, `disable`, `uninstall`, `doctor`, `inspect`, `validate`; `--json`, `--fix`, `--yes` | Table stakes (depends v1.7) |
| Session/memory flags | `--session-list`, `--session-inspect`, `--memory-inspect`, `--preference-set`, `--preference-delete` | Table stakes |
| `rlm help` | Usage text | Table stakes |

**Desktop-managed env:** `RLM_NON_INTERACTIVE`, `RLM_LAUNCH_MODE`, `RLM_DESKTOP_MANAGED` — Rust server must honor same bootstrap paths when launched from Tauri (today set on Node child in `main.rs`).

---

### 5. Tauri integration (embed Rust, kill Node child)

| Feature | Today | v1.8 target | Stakes |
|---------|-------|-------------|--------|
| Runtime process | Tauri spawns `rlm ui` Node child; parses stderr for listen URL | Axum (or `tauri-plugin-axum`) in `setup`; no child process | **Table stakes** for desktop milestone |
| Bundled Node | `dist/release/<tag>/bin/node` + TS dist | **Removed** from installer | **Table stakes** |
| Ollama readiness | `ensure-ollama.mjs` via bundled Node | Rust equivalent (HTTP probe + optional spawn) | Table stakes |
| UI load | Redirect webview to control-server URL | Same URL shape (`127.0.0.1:<port>`) or Tauri custom protocol if SSE constraints allow | Table stakes |
| Window lifecycle | Kill child on close | Drop Rust server handle / graceful shutdown | Table stakes |
| Release layout | `dist/release/<platform>/` with node shim | Rust `rlm` binary + `ui-dist/` + optional Ollama bundle | Table stakes |

**Architecture options (verified):**

- **In-process HTTP (recommended):** Axum on `127.0.0.1`; UI uses existing fetch/SSE — minimal UI change (HIGH confidence — standard Tauri pattern, matches current design).
- **Tauri plugin Axum / custom protocol:** Avoids TCP port but may complicate SSE streaming (custom protocols historically limited streaming — flag if chosen).
- **Sidecar Rust binary:** Still better than Node sidecar but adds process management; prefer in-process unless crash isolation required.

---

### 6. Plugin system in Rust (v1.7 TS taxonomy as reference)

v1.7 establishes the contract Rust must honor:

| TS concept | Rust equivalent | Notes |
|------------|-----------------|-------|
| `rlm.plugin.json` | Same JSON schema; validate with `serde` + shared schema tests | Manifest before code load |
| Categories `shell`, `files`, `web`, `interop` | Same enum | Filter/list UX |
| `register(host)` | **`register(&mut dyn ExtensionHost)`** for builtins (static) | Builtins compiled into binary |
| `PluginLoader` discovery order | 1) builtins 2) config entries 3) `.rlm/plugins/catalog.json` | Same order |
| `ExtensionHost` registries | Tools, skill loaders, model hosts | Duplicate registration → error |
| Trust / allowlist | SHA-256 path keys in `.rlm-allowlist.json` | Before external load |
| Remote fetch install | tar/git → local folder → manifest validate | Reuse v1.7 security rules |

#### External plugin loading — decision required

| Approach | Table stakes? | Tradeoff |
|----------|---------------|----------|
| **Builtins only in v1.8** | Partial | Simplest; breaks external plugin promise unless TS plugins remain via sidecar |
| **WASM plugins** | Differentiator | Sandbox + portability; new toolchain |
| **`dlopen` + C ABI/register fn** | Differentiator | Matches Node dynamic `import()`; security + ABI stability hard |
| **Subprocess tool plugins** | Differentiator | IPC overhead; familiar from MCP interop |

**Recommendation:** Table stakes = **manifest + catalog + doctor + enable/disable + builtins (shell/files/web) in Rust**. External third-party `register()` dynamic loading is a **phase-2 differentiator** unless v1.7 ships a stable IPC plugin ABI — port interop/MCP tools via existing Rust interop module first.

---

### 7. Hugging Face inference path (search, download, GGUF registry)

**Scope per direction note:** Inference only — no fine-tuning, no Python.

| Feature | Today (TS) | v1.8 target | Stakes |
|---------|------------|-------------|--------|
| HF Hub search | `GET huggingface.co/api/models?search=`; GGUF tag detection | Same API via `hf-hub` or `reqwest`; identical JSON shape to UI | Table stakes for model library panel |
| Curated Ollama install | `POST /api/pull` to Ollama | Same — Rust job queue with progress in snapshot | Table stakes |
| GGUF download | Search shows GGUF hits as **unsupported** | Download artifact to local registry path; metadata record | **Differentiator** (currently deferred in TS) |
| GGUF registry | Not implemented | `~/.rlm/models/` or project-local manifest: path, quant, RAM hint, source repo | Differentiator |
| Handoff to Ollama | Primary v1 path | `ollama create` / import mapping | Differentiator (complex — mapping layer) |
| Handoff to llama.cpp | Seed: managed runtime | Optional in-process or child `llama-server` | Defer post-MVP (seed trigger) |
| Tier selection | `select-tier` mutates config | Same config write semantics | Table stakes |

**Anti-feature:** Bundling full HF training/export stack or Python `transformers` — explicitly out of scope.

---

### 8. Vector index upgrade (ANN vs linear scan)

| Feature | Today | v1.8 target | Stakes |
|---------|-------|-------------|--------|
| Storage | `vector-index.json` full read/write | On-disk ANN index (HNSW/usearch — see STACK research) | Differentiator for perf; **compat read** of JSON is table stakes |
| Search | O(n) cosine over filtered records | Sub-linear ANN + scope filter | Differentiator |
| Scope ACL | Filter `scopeIds` before ranking | Same — **must not leak cross-scope hits** | Table stakes |
| Embeddings | Ollama HTTP (`EmbeddingPort`) | Keep Ollama HTTP v1; optional `fastembed-rs` later | Ollama = table stakes |
| Session merge | `mergeSessionRecords(sessionId, records)` | Incremental upsert by session | Table stakes |
| Degraded states | `ready` / `empty` / `degraded` in `RetrievalResult` | Same enum in API/trace | Table stakes |
| Async rebuild | `enqueueRebuild()` non-blocking | Same — must not block node completion | Table stakes |
| Reopen parity | Session save includes vector section | Import JSON records into ANN index on open | Table stakes |

**Migration path:** On first Rust startup, if `vector-index.json` exists and ANN index missing → one-time import; keep JSON export for downgrade/debug (differentiator: `rlm memory reindex` command).

---

## Table Stakes

Features users expect. Missing any of these makes v1.8 feel like a broken upgrade, not a performance win.

| Feature | Why expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Full control-server route parity** | UI is unchanged; every panel maps to an API | HIGH | ~45 routes + SSE; golden JSON tests per handler |
| **SSE `/api/events` reliability** | Graph live updates, chat streaming | HIGH | Rust async + backpressure; no GC pauses |
| **Recursive engine behavioral parity** | Core product value | VERY HIGH | Largest port; port `ports/` traits first |
| **Graph executor parity** | Workflow runs depend on DAG order + agents | HIGH | Topological sort, failure codes unchanged |
| **Session save/reopen** | Desktop users expect resume | MED | Envelope format compatible |
| **Memory + preferences** | CLI + UI inspector | MED | `MemoryResolver` ACL logic |
| **Run state checkpoint/resume** | Long runs | MED | `FileRunStateStore` format |
| **CLI command parity** | CI, scripts, power users | MED | Single Rust binary entry |
| **`rlm ui` serves static UI** | Local dev + desktop | MED | Same `ui-dist/` |
| **Ollama adapter** | Default inference | MED | HTTP client in Rust |
| **Curated model install + tier select** | Desktop model library v1 | MED | Job map + pull API |
| **HF search API** | Model library search box | LOW | Already HTTP-only |
| **Plugin list/doctor/enable/install (local)** | v1.7 promise | MED | Shared registry service port |
| **Built-in tools (shell, files, web)** | Agents depend on tools | HIGH | Reimplement or FFI wrap v1.7 impl |
| **Tauri without Node child** | Stated success criterion | MED | In-process server |
| **Config + YAML validation** | Projects must load | MED | `rlm.config.yaml` schema |
| **Trust allowlist** | Security model | LOW | Same file format |
| **Vector retrieval semantics** | Memory-aware nodes | MED | Even if still linear scan initially |
| **Graceful degraded embedding/index** | Product value: no silent fail | LOW | `degraded` status visible |

---

## Differentiators

Not required for "migration complete," but justify Rust and delight power users.

| Feature | Value proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **ANN vector index (HNSW/usearch)** | Sub-linear memory search at book-scale sessions | HIGH | First measurable perf win; see `rust-vector-index.md` seed |
| **HF GGUF download + local registry** | Complete model library without Python | HIGH | `hf-hub` + disk layout + UI status |
| **Managed llama.cpp runtime** | One-click GGUF inference without Ollama | VERY HIGH | Seed deferred until HF install stable |
| **In-process llama.cpp inference** | Lower latency than HTTP hop | VERY HIGH | Binary size + GPU matrix |
| **Faster SSE / lower idle RAM** | Snappier desktop | MED | Outcome of Rust, not separate feature |
| **Parallel tool execution** | Graph throughput | MED | Rust async; careful with shell plugin |
| **JSON → ANN one-time migration** | Seamless upgrade | MED | Background import on first run |
| **Rust CLI startup time** | No Node boot | LOW | Especially Windows |
| **External plugin WASM ABI** | Safer third-party tools | VERY HIGH | Post v1.8 |
| **Offline embeddings (`fastembed-rs`)** | No Ollama required for memory search | MED | Optional adapter |
| **Shadow-mode parity CI** | Confidence during strangler | MED | TS vs Rust diff job |
| **Native `ensure-ollama` in Rust** | Remove last `.mjs` from bundle | LOW | HTTP health + spawn |

---

## Anti-Features

Explicitly out of scope or harmful for v1.8.

| Anti-feature | Why avoid | What to do instead |
|--------------|-----------|-------------------|
| **React UI rewrite** | Doubles scope | Keep TS UI; HTTP contract only |
| **Big-bang cutover** | Unrecoverable regressions | Strangler per route/module |
| **Breaking HTTP API without version bump** | UI ships separately | Freeze `/api/*` shapes; add `/api/v2` only if unavoidable |
| **Fine-tuning / LoRA / QLoRA** | Compute + ecosystem cost | Separate milestone |
| **Python runtime in bundle** | Direction explicitly excludes | Rust + Ollama/llama.cpp |
| **Replacing Ollama on day one** | Strangler path | Ollama default; llama.cpp optional later |
| **Silent vector index rebuild failure** | Hides memory bugs | Surface `degraded` in trace + UI |
| **Skipping plugin trust gate** | Security regression | Same allowlist semantics |
| **Bundling Node "just for plugins"** | Defeats migration goal | Static builtins + phased external plugin story |
| **Cloud-only vector DB** | Violates local-first | Embedded ANN only |
| **Auto-migrate disk formats without backup** | Data loss risk | Write new sidecar; keep JSON export |
| **Feature parity via TS sidecar forever** | Permanent dual runtime | Sidecar only during strangler, with exit criteria |
| **GGUF marketplace curation** | Scope creep | HF search + local registry |
| **Changing SSE event schema** | Breaks UI event handlers | Match existing event types field-for-field |

---

## Feature Dependencies

```
v1.7 plugin taxonomy stable (manifest, loader, CLI, control-server /api/plugins)
    └── Rust plugin registry + builtins
            └── Rust tools resolver in runtime bootstrap

Control server + session APIs (Rust)
    └── UI/desktop works on Rust (strangler milestone 1)
            └── Recursive engine port
                    └── Graph executor port
                            └── Full execution parity

Persistence ports (Rust)
    └── Session save/reopen
            └── Vector index (JSON compat → ANN upgrade)

Ollama HTTP adapter (Rust)
    └── Curated install + embeddings + agent completions
            └── HF search (read-only) — parallel
                    └── GGUF download + registry (differentiator)
                            └── Managed llama.cpp (deferred)

ANN index engine
    └── Depends on embedding adapter + memory scope filter
            └── Optional: JSON import from legacy FileVectorIndex

Tauri in-process server
    └── Depends on control server Rust port
            └── Remove Node from build-release.mjs

CLI Rust binary
    └── Depends on runtime bootstrap
            └── Replaces shim last (after ui/ask paths verified)
```

### Critical path (recommended phase order)

1. Rust HTTP server + static UI + session/graph **read** APIs  
2. Chat + SSE + execution **write** APIs  
3. Recursive engine + graph executor  
4. Persistence + session save/reopen  
5. Ollama + builtins + plugin registry  
6. CLI binary + Tauri embed  
7. ANN vector + HF GGUF download  

---

## Dependencies on Existing TS Behavior

These TS modules are the **authoritative spec** for Rust ports — do not re-derive from UI.

| TS module / artifact | Rust must match |
|----------------------|-----------------|
| `src/application/control-server/handlers/*` | Route paths, methods, status codes, JSON bodies |
| `src/application/control-server/route-request.ts` | Handler precedence order |
| `src/domain/recursive-language-model.ts` + `src/domain/recursion/*` | Orchestration phases, budget, quality loop |
| `src/application/graph/graph-executor.ts` | DAG execution, error codes |
| `src/application/execution/execution-controller.ts` | Interactive session, approvals, events |
| `src/application/memory/*` | Resolver ACL, semantic index semantics |
| `src/adapters/persistence/*` | File layouts and envelope versions |
| `src/plugins/manifest-schema.ts` | Plugin manifest validation rules |
| `src/plugins/plugin-loader.ts` | Discovery order and descriptor shape |
| `src/application/execution/model-library.ts` | Snapshot shape, job lifecycle |
| `src/cli/args.ts` | CLI surface |
| `tests/integration/*` + handler tests | Golden fixtures for parity CI |
| `.planning/notes/rust-runtime-migration-direction.md` | Scope boundaries |

**v1.7 completion gate:** Rust port should not begin until plugin taxonomy reaches stable seam (manifest schema frozen, builtins migrated, doctor/list/install working in TS) — otherwise Rust re-implements a moving target.

---

## MVP Recommendation (v1.8)

### Ship criteria (migration complete)

1. All control-server routes + SSE pass parity tests against TS fixtures.  
2. `rlm ask`, `rlm ui`, session/memory/plugin CLI work from Rust binary.  
3. Desktop installer: no `bin/node`; Tauri starts in-process server.  
4. Session save/reopen + memory + run state compatible with existing `.rlm/` data.  
5. Ollama completions, embeddings, curated install, HF search.  
6. Built-in shell/files/web tools + plugin doctor/list/install lifecycle.  

### Ship soon after (still v1.8 if capacity)

- ANN vector index with JSON import.  
- HF GGUF download + local registry (handoff to Ollama).  

### Defer (post–v1.8)

- Managed in-process llama.cpp.  
- WASM / dynamic external plugins.  
- Fine-tuning.  
- Multi-runner vLLM/cloud adapters beyond existing HTTP host.  

---

## Complexity Summary

| Area | Effort | Risk |
|------|--------|------|
| Control server parity | High | SSE + 409 semantics |
| Recursive engine | Very high | Subtle budget/approval bugs |
| Graph executor | High | Agent/memory integration |
| Persistence compat | Medium | Envelope version drift |
| Tauri embed | Medium | Shutdown + port lifecycle |
| Plugin system | High | External load strategy |
| Vector ANN | Medium–High | Scope filter + migration |
| HF GGUF path | High | Ollama import mapping |
| CLI packaging | Low | Last mile |

---

## Sources

| Source | Confidence | Used for |
|--------|------------|----------|
| `.planning/notes/rust-runtime-migration-direction.md` | HIGH | Scope, priority, success criteria |
| `src/application/control-server/handlers/*` | HIGH | Complete API inventory |
| `src/domain/recursive-language-model.ts`, `graph-executor.ts` | HIGH | Engine behavior checklist |
| `src/adapters/persistence/*`, `semantic-memory-index.ts` | HIGH | Persistence + vector baseline |
| `src/plugins/*`, v1.7 FEATURES.md | HIGH | Plugin taxonomy contract |
| `src-tauri/src/main.rs`, `build-release.mjs` | HIGH | Node child + bundle layout |
| `.planning/seeds/rust-vector-index.md`, `managed-llama-cpp-runtime.md` | HIGH | Vector + HF deferrals |
| [Microsoft Strangler Fig pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig) | MEDIUM | Migration rhythm |
| [Tauri sidecar docs](https://v2.tauri.app/develop/sidecar/) | HIGH | Sidecar vs in-process |
| [Tauri Node sidecar guide](https://v2.tauri.app/learn/sidecar-nodejs/) | HIGH | What v1.8 removes |
| RAGtronic / Node→Rust case studies (web) | MEDIUM | Streaming + memory motivations |

---
*Feature research for: v1.8 Rust Runtime Migration — table stakes vs differentiators for full runtime port*  
*Researched: 2026-05-22*
