# Technology Stack — v1.8 Rust Runtime Migration

**Project:** Recursive Language Model CLI  
**Domain:** Local-first recursive agent runtime — Node/TypeScript orchestration migrated to Rust (`rlm-core`) while React/Vite UI stays in Tauri webview  
**Researched:** 2026-05-22  
**Confidence:** HIGH for workspace layout, HTTP/async/serde choices, and CI split (repo-verified + official docs); MEDIUM for vector crate selection and `hf-hub` 1.x stability; LOW for managed in-process inference timing (defer until Ollama strangler path is stable)

**Scope:** Stack additions/changes **only** for v1.8 — Rust runtime, control-server parity, persistence, vector index, model-host adapters, CLI entry. **Do not re-research:** TypeScript UI (React 19 / Vite 7), Tauri 2 shell, plugin manager v1.7, graph authoring v1.5, session memory v1.4 semantics, Ollama model library v1.3 UX.

**Direction references:** `.planning/notes/rust-runtime-migration-direction.md`, `.planning/research/questions.md` (2026-05-22 Rust Vector + Inference section)

---

## Recommended Stack

### Rust Workspace Layout

Adopt a **Cargo workspace at repo root** with the existing `src-tauri/` crate as the desktop shell and two new library/binary crates for the runtime. This mirrors the current concern map (`ports/` → traits, `application/` → use cases, `adapters/` → I/O) without mixing Tauri lifecycle code into core logic.

```text
RLM/
├── Cargo.toml                 # workspace root
├── crates/
│   ├── rlm-core/              # lib: engine, control server, persistence, adapters
│   └── rlm-cli/               # bin: headless CLI (replaces dist/src/index.js)
├── src-tauri/                 # bin: Tauri shell; depends on rlm-core
├── ui/                        # unchanged — Vite static assets
├── src/                       # TS during strangler; shrinks as modules port
└── tests/
    ├── rust/                  # unit + integration for rlm-core
    └── parity/                # HTTP contract tests (TS golden → Rust)
```

| Crate | Type | Responsibility | Depends on |
|-------|------|----------------|------------|
| **`rlm-core`** | `lib` | Recursive engine, graph executor, control-server (axum), session/memory stores, vector index, Ollama/HF adapters, config load/validate | `tokio`, `axum`, `serde`, ports as Rust traits |
| **`rlm-cli`** | `bin` | Parse args, load config, start control server or run headless modes; thin facade like today's `src/index.ts` | `rlm-core`, `clap` |
| **`src-tauri`** (`recursive-language-model`) | `bin` | Webview window, Ollama readiness, **in-process** `rlm_core::start_server()` instead of Node child spawn | `rlm-core`, `tauri` 2.x |

**Root `Cargo.toml` (workspace):**

```toml
[workspace]
resolver = "2"
members = ["crates/rlm-core", "crates/rlm-cli", "src-tauri"]

[workspace.package]
edition = "2021"
license = "ISC"
rust-version = "1.80"   # axum 0.8 MSRV

[workspace.dependencies]
tokio = { version = "1.52", features = ["rt-multi-thread", "macros", "signal", "fs", "process"] }
axum = { version = "0.8.9", features = ["json", "query", "form"] }
serde = { version = "1.0.228", features = ["derive"] }
serde_json = "1.0"
tracing = "0.1.44"
thiserror = "2.0.18"
anyhow = "1.0.102"
```

**Rationale:** Single workspace gives unified `cargo test`, shared dependency versions, and lets Tauri + CLI share one `rlm-core` artifact. Keeping Tauri separate prevents webview/GUI concerns from leaking into headless CLI and keeps `rlm-core` usable in CI without pulling `wry`/windowing deps.

**Tauri integration pattern (end state):** Replace `spawn_rlm_ui()` Node child in `src-tauri/src/main.rs` with:

1. `tokio::runtime::Runtime` (or `tauri::async_runtime`) hosting `rlm_core::control_server::start(...)`.
2. Redirect webview to `http://127.0.0.1:{port}` (same stderr/stdout contract the UI already expects).
3. Serve `ui-dist/` from axum via `tower-http` static file service (parity with `handlers/static-ui.ts`).

---

### Core Runtime

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Rust (stable)** | `1.80+` (toolchain `1.94` verified locally) | Runtime language | Matches axum 0.8 MSRV; stable for desktop CI matrix (linux-x64, darwin-arm64, win32-x64) |
| **Tokio** | `1.52.3` | Async runtime | De facto standard; axum/hyper/reqwest integration; multi-thread scheduler for control server + background index rebuild |
| **Axum** | `0.8.9` | HTTP control server | Official Tokio-team router; first-class SSE via `axum::response::sse::Sse` + `KeepAlive`; Tower middleware composability; sufficient for localhost REST + `/api/events` stream |
| **Hyper** (transitive) | via axum | HTTP/1.1 | Axum builds on hyper — do not depend on hyper directly unless streaming low-level control is needed |
| **Tower / tower-http** | `0.6.11` | Middleware | `TraceLayer`, `CorsLayer` (dev only), `ServeDir` for UI static assets, request timeouts |
| **Serde** | `1.0.228` | JSON + struct mapping | Session snapshots, API bodies, persistence; derive-heavy like current TS types |
| **yaml_serde** | `0.10.4` | `rlm.config.yaml` load | **Use instead of deprecated `serde_yaml`** (unmaintained since 2024-03; RUSTSEC-2024-0406). Cargo alias: `serde_yaml = { package = "yaml_serde", version = "0.10" }` preserves import paths during port |
| **thiserror** | `2.0.18` | Domain/library errors | Typed errors in `rlm-core` (mirrors stable error codes in `execution-failure.ts`) |
| **anyhow** | `1.0.102` | CLI/top-level errors | Ergonomic error propagation in `rlm-cli` and Tauri setup |
| **tracing** + **tracing-subscriber** | `0.1.44` | Structured logging | Replace stderr patterns; filter by module; JSON optional for CI |
| **clap** | `4.6.1` | CLI parsing | Derive-based; maps `rlm ui`, `rlm run`, plugin subcommands from v1.7 |

**HTTP server choice — Axum over Actix-web or raw Hyper:**

| Criterion | Axum | Actix-web 4.x | Raw Hyper |
|-----------|------|---------------|-----------|
| SSE (`/api/events`) | Built-in `Sse` + keep-alive | Supported | Manual framing |
| Tokio ecosystem | Native | Separate runtime history | Direct |
| Handler ergonomics | Extractors, `State` | Similar | Minimal |
| Localhost perf need | Far exceeds UI load | Marginal win | More boilerplate |

**Recommendation:** **Axum** — control server is localhost-bound, &lt;500 RPS, SSE-heavy; Actix's actor model and benchmark edge are irrelevant here. Hyper alone is too low-level for ~30 REST routes across session/graph/workflows/model-library/plugins.

**Required axum SSE stack:**

```toml
axum = { version = "0.8.9", features = ["json"] }
tokio-stream = "0.1"
futures-util = "0.3.32"
async-stream = "0.3.6"   # bridge broadcast channels → SSE stream
```

Mirror current route precedence from `route-request.ts` as axum `Router` merge order or explicit fallback chain.

---

### HTTP Client & Ollama (v1 default inference)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **reqwest** | `0.13.3` | Ollama HTTP, HF download fallback | Async + JSON + streaming; `rustls-tls` feature for static builds |
| **ollama-rs** | `0.3.4` (optional) | Typed Ollama API | Thin wrapper; **start with reqwest** mirroring existing `@langchain/ollama` call shapes, adopt `ollama-rs` when endpoints stabilize |

**Embeddings (v1):** Keep **Ollama HTTP** as default — matches `OllamaEmbeddingModel` today and avoids bundling ONNX/embed weights in the Tauri installer. Defer `fastembed` (`5.13.4`) until offline/low-latency embed is a measured requirement (pulls `ort` + model binaries).

---

### Vector Index (session memory ANN)

**Primary recommendation: `usearch` `2.25.2`**

| Criterion | usearch | hnsw_rs 0.3.4 | instant-distance 0.6.1 | sqlite-vec 0.1.10-alpha.4 |
|-----------|---------|---------------|------------------------|----------------------------|
| On-disk save/load | ✅ single-file index | ✅ bincode graph + separate vectors | ⚠️ in-memory; limited persistence story | ✅ via SQLite |
| mmap / view without full RAM load | ✅ | ❌ typical full load | ❌ | ✅ |
| Incremental upsert | ✅ add/remove | ✅ | ✅ | ✅ SQL upsert |
| Desktop single-user | ✅ embedded, no server | ✅ | ✅ | ✅ but alpha FFI |
| Scope-filtered top-k | ✅ external key map + post-filter | ✅ key → NodeId map | ✅ | ✅ SQL WHERE |
| Maturity / deps | C++ core, active releases | Pure Rust, smaller community | Minimal, fast | Alpha extension |

**Recommendation:** **`usearch = "2.25.2"`** with cosine metric (matches current brute-force cosine in `SemanticMemoryIndex`). Rationale from `.planning/seeds/rust-vector-index.md` and questions.md #1–2:

- **Incremental upsert:** `add`/`remove` without full reindex on every session save.
- **Persistence:** Save index to `.rlm/memory/vector.usearch` (or similar); keep sidecar JSON for v1.4 session-merge metadata during strangler period.
- **Scope ACL:** Store `scope` + record metadata in parallel `HashMap<u64, RecordMeta>` keyed by usearch label; apply `memoryScopes` filter after ANN top-k (same semantics as TS).
- **Background rebuild:** `tokio::task::spawn_blocking` for index compaction/rebuild — must not block graph node completion.

**Fallback:** **`hnsw_rs = "0.3.4"`** if usearch C++ build proves painful on a target platform (MSRV/cross-compile). Pure Rust, explicit graph + vector store split — more code to wire persistence.

**Do not choose for v1.8:**

| Crate | Why defer |
|-------|-----------|
| **instant-distance** | In-memory-first; persistence and delete semantics weaker for session reopen at book scale |
| **sqlite-vec** | Alpha (`0.1.10-alpha.4`); adds rusqlite + extension loading complexity for marginal gain over usearch file index |
| **Qdrant embedded** | Separate server process — conflicts with "no bundled services" desktop goal |

**Optional later:** `fastembed` for local embeddings when Ollama embed latency is proven bottleneck.

---

### Hugging Face (inference path only — no Python)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **hf-hub** | `1.0.0-rc.1` | Model search, artifact download, HF cache layout | Official Hugging Face crate; cache-compatible with Python `huggingface_hub`; `tokio` + `rustls-tls` features |
| **serde_json** | `1.0` | Parse HF API responses / GGUF sidecar metadata | Already required for control server |

**Usage pattern:**

```rust
// Async API (preferred in rlm-core)
use hf_hub::api::tokio::Api;

let api = Api::new()?;
let repo = api.model("TheBloke/Llama-2-7B-GGUF".into());
let path = repo.get("llama-2-7b-chat.Q4_K_M.gguf").await?;
```

**GGUF detection:** List repo files via HF API → filter `*.gguf` suffix → download selected quant. No Python `huggingface-cli` required. Optional thin Rust parser for GGUF header metadata (tensor names, quant) — can defer; v1.3 UI already surfaces install state.

**Ollama import mapping:** `hf-hub` download + **`ollama create` HTTP API** (or CLI spawn) for handoff — matches `.planning/seeds/managed-llama-cpp-runtime.md` strangler: external runtime first, managed in-process later.

**Stability note:** `hf-hub` 1.x is **release-candidate** (docs.rs still shows 0.5.x for older releases). Pin exact version in workspace; add parity test against known public GGUF repo. **MEDIUM confidence** until 1.0 stable — fallback is direct reqwest to `huggingface.co/api/models/...` endpoints.

**Do not add:** Python `huggingface_hub`, `@huggingface/gguf` npm in Rust path (keep TS only where UI already uses it during transition).

---

### Inference (future managed runtime — not day-one default)

| Phase | Technology | Version | When |
|-------|------------|---------|------|
| **v1.8 default** | Ollama HTTP | existing | All agent inference + embeddings |
| **Phase B** | **llama-cpp-2** | `0.1.146` | Managed GGUF per seed; spawn `llama-server` equivalent in-process |
| **Deferred** | **candle-core** | `0.10.2` | Pure-Rust inference experimentation — GGUF architecture coverage lags llama.cpp; RoPE bugs on NEOX models historically ([candle#3410](https://github.com/huggingface/candle/issues/3410)) |
| **Deferred** | **ort** | `2.0.0-rc.12` | ONNX path only; not needed for GGUF/Ollama focus |

**llama-cpp-2 vs candle (for future reference):**

| Criterion | llama-cpp-2 | candle-core |
|-----------|-------------|-------------|
| GGUF support | Native via llama.cpp | Supported but architecture gaps |
| GPU backends | Feature flags: `cuda`, `metal`, `vulkan`, `rocm` | CUDA/Metal via candle backends |
| Streaming for tool rounds | Mature token stream API | Possible but less battle-tested for all GGUF quants |
| Tauri binary size | Large (platform-specific builds) | Large (different tensor stack) |
| Alignment with Ollama | Same engine family | Different stack |

**Recommendation:** **Ollama only in v1.8.** Gate **`llama-cpp-2`** behind optional Cargo features (`managed-llama`, per-platform `metal`/`cuda`) for Phase B — do not block runtime migration on native inference. **Do not bundle candle/ort** in default desktop artifact.

---

### Persistence & Config

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **serde + serde_json** | see above | Session bundles, run state, preferences | File-based stores mirror current adapters |
| **yaml_serde** | `0.10.4` | Project YAML | Validated config load for agents/workflows |
| **tokio::fs** | via tokio | Async file I/O | Session save, index persist |
| **uuid** | `1.16` | Run/session IDs | If not already using ULID/string IDs from TS port |

**Defer:** Embedded SQLite/Postgres for run state — `.planning/research/questions.md` ARTF-01 is a separate milestone; v1.8 keeps file-based persistence per direction doc.

---

### CI / Testing (split from `npm run check`)

Mirror the TS gate with a Rust workspace gate; run both in CI until TS strangler completes.

| Layer | Command | Purpose |
|-------|---------|---------|
| **Format** | `cargo fmt --all -- --check` | Rust style |
| **Lint** | `cargo clippy --workspace --all-targets -- -D warnings` | Idiomatic + bug patterns |
| **Unit/integration** | `cargo test --workspace` | Standard test runner |
| **Faster CI (recommended)** | `cargo nextest run --workspace` | `cargo-nextest` `0.9.136` — parallel, clearer failures |
| **UI/tooling (unchanged)** | `npm run check` | typecheck, eslint, prettier, depcruise, node tests |

**Suggested root scripts:**

```json
{
  "scripts": {
    "check:rust": "cargo fmt --all -- --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace",
    "check:rust:nextest": "cargo nextest run --workspace",
    "check:all": "npm run check && npm run check:rust"
  }
}
```

**Parity testing strategy:**

1. **HTTP contract tests** — Golden fixtures from current control-server handlers (`/api/session`, `/api/graph`, `/api/events`, model-library, plugins v1.7). Run same requests against TS server (baseline) and Rust server; diff JSON/SSE event shapes.
2. **Session memory round-trip** — Save bundle in TS, reopen in Rust (then reverse) during strangler.
3. **Vector recall@k** — Same embedding set: brute-force TS baseline vs usearch top-k; assert scope filtering identical.

Install nextest once per CI image: `cargo install cargo-nextest --locked` or use [nextest action](https://nexte.st/book/installation.html).

---

## Workspace `Cargo.toml` Sketch

```toml
# crates/rlm-core/Cargo.toml
[package]
name = "rlm-core"
version = "0.1.0"
edition.workspace = true

[dependencies]
tokio.workspace = true
axum.workspace = true
tower-http = { version = "0.6.11", features = ["fs", "trace", "cors"] }
serde.workspace = true
serde_json.workspace = true
serde_yaml = { package = "yaml_serde", version = "0.10.4" }
thiserror.workspace = true
tracing.workspace = true
reqwest = { version = "0.13.3", default-features = false, features = ["json", "rustls-tls", "stream"] }
hf-hub = { version = "1.0.0-rc.1", default-features = false, features = ["tokio", "rustls-tls"] }
usearch = "2.25.2"
tokio-stream = "0.1"
futures-util = "0.3.32"
async-stream = "0.3.6"

[features]
default = []
managed-llama = ["dep:llama-cpp-2"]
# llama-cpp-2 = { version = "0.1.146", optional = true, default-features = false }
```

```toml
# crates/rlm-cli/Cargo.toml
[package]
name = "rlm-cli"
version = "0.1.0"
edition.workspace = true

[[bin]]
name = "rlm"
path = "src/main.rs"

[dependencies]
rlm-core = { path = "../rlm-core" }
clap = { version = "4.6.1", features = ["derive"] }
anyhow.workspace = true
tokio.workspace = true
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
```

```toml
# src-tauri/Cargo.toml — add
[dependencies]
rlm-core = { path = "../crates/rlm-core" }
tokio = { workspace = true, features = ["rt-multi-thread", "macros"] }
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| HTTP server | **Axum 0.8** | Actix-web 4.x | Actor model overhead; no meaningful perf win on localhost SSE workload |
| HTTP server | **Axum** | Salvo, Rocket, Warp | Smaller ecosystem or less SSE/Tower integration maturity for this use case |
| YAML | **yaml_serde 0.10** | serde_yaml 0.9 | Unmaintained, deprecated, RUSTSEC advisory |
| YAML | **yaml_serde** | serde_yml 0.0.12 | Turborepo migrated here but 0.0.x semver signals less stability than official YAML org fork |
| Vector index | **usearch 2.25** | hnsw_rs | hnsw_rs viable fallback but more persistence wiring; usearch single-file + mmap wins for desktop reopen |
| Vector index | **usearch** | sqlite-vec | Alpha quality; extension distribution on Windows/macOS adds release risk |
| HF client | **hf-hub** | huggingface_hub_rust (git) | Internal HF crate; less crates.io stability for external consumers |
| Ollama client | **reqwest** (initial) | ollama-rs | Extra abstraction before API surface is ported; adopt when types stabilize |
| Inference future | **llama-cpp-2** | candle | llama.cpp GGUF parity and GPU feature flags align with Ollama/engine ecosystem |
| Inference future | **llama-cpp-2** | ort 2.0 RC | ONNX not on critical path; RC dependency unsuitable for default bundle |
| Async runtime | **Tokio** | async-std | Axum/hyper/reqwest/hf-hub tokio features assume Tokio |
| Test runner | **cargo test + nextest** | cargo-llvm-cov only | Coverage tool complements but does not replace test execution split |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Python runtime / PyO3** | Explicitly out of scope per direction doc | hf-hub + Ollama/llama.cpp |
| **Fine-tuning stack** (LoRA, QLoRA, training loops) | Deferred milestone; compute + scope | Ollama inference only |
| **LangChain / deepagents in Rust** | TS orchestration deps; not portable | Port domain recursion logic directly |
| **Node bundled in desktop release** | Success criterion: no bundled Node | rlm-cli + Tauri in-process server |
| **Embedded Qdrant / Milvus / Weaviate** | Separate service footprint | usearch embedded index |
| **Postgres / SQLite for v1.8 run state** | ARTF-01 is future; file stores work today | tokio::fs + JSON/YAML |
| **npm-side HTTP server in production path** | Strangler replaces TS control server | axum in rlm-core |
| **Plugin dynamic `import()` in Rust v1.8** | v1.7 TS plugins are ESM; porting plugin VM is separate | Built-in Rust tools first; TS plugin bridge or WASM later |
| **candle / ort in default features** | Binary size + maturity; Ollama covers v1 | Optional feature flags after llama-cpp path |
| **fastembed in default bundle** | Pulls ONNX + model weights | Ollama embed HTTP |
| **PyTorch / tch-rs** | Python ML stack | llama-cpp-2 when needed |
| **grpc / tonic for control plane** | UI uses HTTP/SSE today | Preserve localhost REST contract |
| **WebSocket for events** | UI consumes SSE (`text/event-stream`) | axum SSE |
| **Redis / message broker** | Single-user desktop | tokio channels + broadcast for SSE |
| **Diesel / SeaORM** | No relational store in v1.8 | File persistence |
| **napi-rs TS bridge for core** | Defeats migration goal | Native Rust API consumed by Tauri/CLI |
| **Unpinned hf-hub git deps** | Reproducible releases | Pin `1.0.0-rc.1` until stable |

---

## Version Compatibility

| Package | Version | MSRV / Notes |
|---------|---------|--------------|
| axum | 0.8.9 | Rust 1.80+ |
| tokio | 1.52.3 | Rust 1.70+ |
| usearch | 2.25.2 | C++17 build; verify cross-compile in Tauri CI matrix |
| hf-hub | 1.0.0-rc.1 | Pin; watch for 1.0.0 stable |
| llama-cpp-2 | 0.1.146 | Optional; platform features (`metal`, `cuda`, `vulkan`) mutually exclusive per build target |
| yaml_serde | 0.10.4 | Drop-in for serde_yaml API |
| tauri | 2.x (existing) | Shell only; no change to UI stack |
| cargo-nextest | 0.9.136 | CI install, not a workspace dep |

**Desktop packaging change:** `scripts/packaging/build-release.mjs` eventually ships `rlm` Rust binary + static `ui-dist/` — remove `bin/node` and TS `dist/` from release artifact per success criteria.

---

## Migration Stack Ordering (ties to roadmap)

1. **Workspace scaffold + axum control server** — HTTP/SSE parity, static UI (no engine yet)
2. **Persistence + config** — yaml_serde + JSON stores
3. **Session/graph APIs** — wire handlers to ported domain logic
4. **usearch vector layer** — first perf win
5. **Ollama + hf-hub adapters** — model library parity
6. **rlm-cli + Tauri in-process** — remove Node child
7. **Optional `managed-llama` feature** — llama-cpp-2 behind flag

---

## Sources

- `.planning/notes/rust-runtime-migration-direction.md` — architecture, deferred scope, success criteria — **HIGH**
- `.planning/research/questions.md` — vector/inference/HF open questions — **HIGH**
- `.planning/seeds/rust-vector-index.md`, `.planning/seeds/managed-llama-cpp-runtime.md` — **HIGH**
- Repo: `src-tauri/src/main.rs`, `src/application/control-server/`, `package.json` — **HIGH**
- [axum SSE docs](https://docs.rs/axum/latest/axum/response/sse/index.html) — **HIGH**
- [hf-hub crate](https://docs.rs/hf-hub/latest/hf_hub/) / [GitHub huggingface/hf-hub](https://github.com/huggingface/hf-hub) — **MEDIUM** (1.x RC)
- [yaml_serde migration](https://github.com/yaml/yaml-serde) — **HIGH**
- [usearch docs](https://docs.rs/crate/usearch/) — **HIGH**
- [llama-cpp-2 features](https://docs.rs/llama-cpp-2/) — **HIGH**
- crates.io `cargo search` / `cargo info` (2026-05-22, toolchain 1.94.0) — **HIGH**
- [candle GGUF RoPE issue #3410](https://github.com/huggingface/candle/issues/3410) — **MEDIUM**

---
*Stack research for: v1.8 Rust Runtime Migration — rlm-core workspace, axum control server, usearch vector index, Ollama + hf-hub inference path*  
*Researched: 2026-05-22*
