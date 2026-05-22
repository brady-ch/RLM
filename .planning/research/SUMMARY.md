# Project Research Summary — v1.8 Rust Runtime Migration

**Project:** Recursive Language Model CLI  
**Domain:** Local-first recursive agent runtime — strangler migration from Node/TypeScript orchestration to embedded Rust (`rlm-core`), React/Vite UI unchanged in Tauri webview  
**Researched:** 2026-05-22  
**Confidence:** HIGH overall for migration strategy and TS→Rust seam map; MEDIUM for ANN crate selection and `hf-hub` 1.x stability; LOW for external-plugin dynamic loading and managed in-process inference timing

## Executive Summary

RLM v1.8 replaces the **Node orchestration runtime** with an embedded Rust workspace while keeping the **TypeScript/React UI** unchanged. Experts migrate local AI dev tools via a **strangler fig** over a frozen **HTTP/SSE contract** — not a big-bang rewrite. The React webview continues calling `localhost` APIs; implementation moves module-by-module from TypeScript to Rust until the bundled Node child and `dist/src/index.js` are removed from the desktop installer.

The recommended approach mirrors the existing concern map: `src/ports/` → Rust traits (`rlm-ports`), `src/domain/` → pure policy (`rlm-domain`), `src/adapters/` → I/O (`rlm-adapters`), `src/application/` → use-case services, control-server → Axum router. Tauri today spawns a Node child (`spawn_rlm_ui`); the end state embeds `rlm_core::start_server()` in-process on `127.0.0.1`, serves `ui-dist/` statically, and ships a Rust `rlm` binary only. **Ollama HTTP remains the default inference host** on day one; HF path is search/download/registry without Python; managed llama.cpp and fine-tuning are explicitly deferred.

Key risks are **HTTP contract drift** (silent UI breakage), **async concurrency bugs** in the recursive engine port, **session/vector data loss** during ANN migration, and **premature plugin re-port** after v1.7 just shipped the TS taxonomy. Mitigation: golden JSON/SSE fixtures from Wave 1, ports-first porting, dual-read on-disk formats, Rust-native builtins only in the critical path with external plugins deferred to a post-cutover bridge phase, and a parity matrix mapping 471 TS tests to Rust equivalents before Node removal.

---

## Key Findings

### Recommended Stack

Adopt a **Cargo workspace at repo root** with `crates/rlm-core` (lib: engine, control server, persistence, adapters), `crates/rlm-cli` (bin: headless CLI), and existing `src-tauri/` (desktop shell depending on `rlm-core`). Inner crates can split further (`rlm-ports`, `rlm-domain`, `rlm-adapters`, `rlm-application`, `rlm-runtime`, `rlm-control-server`, `rlm-config`) mirroring v1.7 boundaries.

**Core technologies:**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Rust (stable)** | `1.80+` | Runtime language | Axum 0.8 MSRV; desktop CI matrix |
| **Tokio** | `1.52` | Async runtime | De facto standard; axum/reqwest/hf-hub integration |
| **Axum** | `0.8.9` | Control server | Built-in SSE, Tower middleware, localhost REST |
| **Tower / tower-http** | `0.6.11` | Middleware | Trace, static UI (`ServeDir`), timeouts |
| **Serde + yaml_serde** | `1.0` / `0.10.4` | JSON + config | Replace deprecated `serde_yaml` (RUSTSEC-2024-0406) |
| **reqwest** | `0.13.3` | Ollama + HF HTTP | Async JSON + streaming; `rustls-tls` for static builds |
| **usearch** | `2.25.2` | ANN vector index | Single-file persistence, mmap, incremental upsert; fallback `hnsw_rs` if C++ build fails |
| **hf-hub** | `1.0.0-rc.1` | HF download/cache | Pin exact version; fallback reqwest to HF API |
| **clap** | `4.6.1` | CLI parsing | Derive-based; maps v1.7 plugin subcommands |
| **tracing** | `0.1.44` | Structured logging | Replace stderr patterns |
| **cargo-nextest** | `0.9.136` | CI test runner | Parallel failures; complements `cargo test` |

**CI gate:** `check:rust` = `cargo fmt --check && cargo clippy -D warnings && cargo test --workspace`; keep `npm run check` for UI until TS runtime deleted, then `check:all`.

**Explicitly do not add:** bundled Node, Python/PyO3, candle/ort in default features, embedded Qdrant, napi-rs bridge for core orchestration, grpc for control plane, WebSocket (UI uses SSE).

### Expected Features

**Must have (table stakes):**

- Full control-server route parity (~45 REST routes + `/api/events` SSE) — every UI panel maps to an API
- Recursive engine + graph executor behavioral parity — budget guards, quality loop, approval boundaries, cancellation
- Session save/reopen + memory/preferences + run-state checkpoint/resume — compatible `.rlm/` formats
- CLI command parity (`rlm ask`, `rlm ui`, session/memory, plugin admin) — single Rust binary
- Ollama adapter (completions + embeddings) + curated model install + HF search + tier select
- Plugin list/doctor/enable/install (local) + built-in shell/files/web tools
- Tauri without Node child — in-process Axum on `127.0.0.1`; no `bin/node` in release bundle
- Vector retrieval semantics — scope ACL, degraded states, session merge (`mergeSessionRecords`)
- Config + YAML validation + trust allowlist — same security model as v1.7

**Should have (differentiators, ship in v1.8 if capacity):**

- ANN vector index (usearch) with JSON → ANN one-time import
- HF GGUF download + local registry + Ollama handoff
- Native `ensure-ollama` in Rust (remove last `.mjs` from bundle)
- Shadow-mode parity CI (TS vs Rust golden fixture diff)

**Defer (post–v1.8):**

- Managed in-process llama.cpp (`llama-cpp-2` behind optional Cargo feature)
- WASM / `dlopen` external plugin dynamic loading
- Fine-tuning / LoRA / QLoRA
- React UI rewrite; replacing Ollama on day one
- Embedded SQLite/Postgres for run state (ARTF-01)

### Architecture Approach

Migration follows **8 architecture waves** (plus v1.7 Wave 0 gate) aligned with `.planning/notes/rust-runtime-migration-direction.md`. TS and Rust coexist behind `RLM_RUNTIME=node|rust` during development; production desktop ships one runtime after cutover. Parity is enforced by **HTTP/SSE golden fixtures**, not OpenAPI-first. Loopback TCP (`127.0.0.1:0`) is preferred over Tauri custom protocols because `/api/events` SSE is contract-critical.

**Major components:**

1. **`rlm-ports`** — trait contracts (`LanguageModelPort`, stores, `ExtensionHostPort`, etc.)
2. **`rlm-domain`** — recursion policy, budget guard, quality loop, graph sync
3. **`rlm-adapters`** — file persistence, Ollama/HF clients, ANN vector index
4. **`rlm-application`** — ExecutionController, GraphExecutor, MemoryManager, PluginRegistryService
5. **`rlm-runtime`** — composition root, ExtensionHost, PluginLoader, MCP interop
6. **`rlm-control-server`** — Axum router preserving `route-request.ts` probe order
7. **`rlm-cli` + `src-tauri`** — thin entrypoints calling `build_runtime_context`

**Build-order dependency:** `rlm-ports` → `rlm-domain` → adapters/plugins → application → runtime → control-server → cli/tauri.

### Critical Pitfalls

1. **Big-bang rewrite / fake strangler** — Ship control-server first; each slice must pass parity tests and produce a working desktop build; Node removal only after Phases 51–58 green.
2. **HTTP API drift** — Golden JSON + SSE fixtures before handler ports; preserve route probe order; match 409 mutation errors and nullable field rules.
3. **Async/concurrency bugs in recursive engine** — Single-owner budget guard; serializing SSE channel; `tokio::select!` biased for stop; avoid `Arc<Mutex<RLM>>`.
4. **Session/vector data loss** — Dual-read JSON sections; lazy ANN import from `vector-index.json`; keep session bundle envelope; never destructive first-boot migration.
5. **Plugin re-port too early** — Rust builtins + MCP in critical path; external ESM plugins via documented bridge (Phase 60); do not block Tauri cutover on WASM/dylib ABI.
6. **Tauri lifecycle** — Bind `:0`, inject URL to webview (not stderr scrape); shutdown hook; port `ensure-ollama.mjs` before deleting Node.
7. **Test parity gap** — Map 471 TS tests to Rust; ≥80% behavioral coverage before Node removal; golden HTTP tests runnable against both runtimes.

---

## Implications for Roadmap

Suggested **9 core phases (51–59)** plus **1 optional stretch (60)** — 10 total, continuing from Phase 50 (v1.7 complete). Phase numbers are planning placeholders for the roadmapper.

### Phase 51: Rust Workspace + Control Server Strangler
**Rationale:** Freeze UI contract first; all other work depends on HTTP/SSE seam.  
**Delivers:** Cargo workspace scaffold, `rlm-ports` skeleton, Axum router, static UI, `/api/session` + SSE stub/parity, golden fixture catalog in `tests/fixtures/control-server/`.  
**Addresses:** Control-server route parity (read paths), SSE reliability.  
**Avoids:** HTTP API drift (Pitfall 2), SSE event loss (Pitfall 11), OpenAPI-only testing.

### Phase 52: Persistence Ports
**Rationale:** Session/graph read APIs need file stores before engine writes state.  
**Delivers:** `FileSessionStore`, `FileMemoryStore`, `FileRunStateStore`, preferences; dual-verify writes against TS during strangler.  
**Addresses:** Session save/reopen, memory, run-state, config YAML load (`yaml_serde`).  
**Avoids:** Session data loss (Pitfall 4), Windows path regressions (Pitfall 13).

### Phase 53: Recursive Engine + ExecutionController
**Rationale:** Largest logic block; depends on ports + persistence for checkpoints.  
**Delivers:** `RecursiveLanguageModel` in Rust, chat preview routes, `/api/graph` snapshot, execution events to SSE.  
**Addresses:** Engine behavioral parity, cancellation, budget guards, approval boundaries.  
**Avoids:** Async/concurrency bugs (Pitfall 3); port budget-guard and graph-sync modules in isolation first.

### Phase 54: Graph Executor + Node Routes + Workflows
**Rationale:** Full execution requires DAG walker + all `/api/nodes/*` mutations.  
**Delivers:** `GraphExecutor`, planner integration, workflow export/import routes, interactive execution session.  
**Addresses:** Graph executor parity, workflow sidecars, node mutation surface.  
**Avoids:** Parallel child without parent-fail propagation; port graph test suite (tests 35–38+).

### Phase 55: Vector Index + Embedding Adapter
**Rationale:** First measurable perf win; depends on embedding port + memory scope filter.  
**Delivers:** usearch ANN index, Ollama embed HTTP, JSON import on first open, scope-filtered top-k, async rebuild.  
**Addresses:** Vector retrieval semantics, session merge, degraded states.  
**Avoids:** Empty ANN after JSON existed; embedding dimension mismatch; scope ACL after ANN only.

### Phase 56: Model Hosts + Model Library
**Rationale:** Agents need Ollama completions; UI model library panel depends on these routes.  
**Delivers:** Ollama HTTP adapter (reqwest), model-library GET/search/install/tier-select, HF search via reqwest or hf-hub.  
**Addresses:** Ollama adapter, curated install, HF search, tier selection.  
**Avoids:** Breaking Ollama streaming; blocking migration on in-process llama.cpp.

### Phase 57: Built-in Plugins + MCP Interop
**Rationale:** Tool rounds require shell/files/web; MCP unchanged semantics.  
**Delivers:** Rust `register(host)` for builtins, PluginLoader discovery order, registry service + `/api/plugins/*`, MCP subprocess interop port.  
**Addresses:** Plugin list/doctor/enable/install, built-in tools, trust allowlist validation.  
**Avoids:** Rewriting external ESM plugin loader in critical path; document `unsupported_rust_runtime` for external catalog entries.

### Phase 58: Rust CLI + Parity CI Gate
**Rationale:** CLI is thin facade; needs full runtime bootstrap before replacing Node entry.  
**Delivers:** `rlm-cli` binary (clap), all run modes + plugin subcommands, `RLM_RUNTIME` switch, parity CI job (TS vs Rust fixture diff).  
**Addresses:** CLI command parity, dual-runtime sunset documentation.  
**Avoids:** Dual runtime operational debt (Pitfall 10); test parity gap (Pitfall 7).

### Phase 59: Tauri In-Process + Packaging (No Node)
**Rationale:** Success criterion — desktop ships without bundled Node; depends on all prior phases green.  
**Delivers:** Tauri `setup` starts in-process server, Rust Ollama readiness, graceful shutdown, `build-release.mjs` ships `bin/rlm` + `ui-dist/` only, delete TS runtime from release artifact.  
**Addresses:** Tauri without Node child, release layout, native ensure-ollama.  
**Avoids:** Orphan processes, port race, blank webview on launch (Pitfall 6); fake strangler with hidden Node sidecar.

### Phase 60 (Optional Stretch): HF GGUF Download + External Plugin Bridge
**Rationale:** Differentiators and post-cutover extensibility — not blocking Node removal.  
**Delivers:** hf-hub download pipeline with zip-slip defenses (port v1.7 remote-fetch tests), local GGUF registry, Ollama import mapping; external plugin bridge strategy (subprocess/WASM/deferred).  
**Addresses:** HF GGUF download/registry differentiator; external plugin promise.  
**Avoids:** HF zip-slip recurrence (Pitfall 9); plugin security regression.

### Phase Ordering Rationale

- **Transport before orchestration:** UI is unchanged — control server + fixtures must land before recursive engine (direction doc + Pitfall 1).
- **Persistence before engine writes:** Run-state checkpoints and session envelopes are authoritative spec for Rust ports.
- **Engine before full graph surface:** Chat/SSE can ship with partial node routes; full executor needs engine stable.
- **Vector after memory stores:** ANN imports JSON records produced by memory/session save paths.
- **Model hosts parallel-ready but after core execution:** Ollama needed for agent runs but not for HTTP/static UI scaffold.
- **Plugins after runtime bootstrap:** Tools resolver wires through composition init order (v1.7 seam).
- **CLI before Tauri cutover:** Headless parity validates runtime without desktop lifecycle complexity.
- **Tauri last:** Node removal is irreversible gate — only after ≥80% test parity and contract tests green.

### Research Flags

Phases likely needing `/gsd-research-phase` during planning:

- **Phase 55:** ANN crate selection — usearch vs hnsw_rs cross-compile on Tauri CI matrix (`.planning/research/questions.md` Q1–Q2)
- **Phase 56–60:** HF Rust download path — `hf-hub` 1.x RC stability vs direct reqwest (Q6)
- **Phase 59:** SSE on Tauri Windows — loopback binding edge cases if port issues arise
- **Phase 60:** External plugin ABI — WASM vs subprocess vs dylib (defer decision)

Phases with standard patterns (skip deep research):

- **Phase 51:** Axum + SSE — official docs, repo-verified control-server handlers
- **Phase 52:** File persistence — TS adapters are authoritative spec
- **Phase 53–54:** Domain port — `ports/` trait map is documented
- **Phase 58:** Clap CLI — mirrors existing `src/cli/args.ts`

---

## Open Questions

| # | Question | Impact | Suggested resolution |
|---|----------|--------|----------------------|
| 1 | **usearch vs hnsw_rs** on Windows/macOS Tauri CI — C++ build pain? | Phase 55 | Spike in Phase 55 plan; hnsw_rs fallback documented |
| 2 | **hf-hub 1.0.0-rc.1** stability for production pin | Phase 56/60 | Pin + parity test against known GGUF repo; reqwest fallback |
| 3 | **External plugin ABI** for v1.8 ship — builtins-only vs bridge | Phase 57/60 | Ship builtins + MCP; external `unsupported_rust_runtime` in doctor until Phase 60 |
| 4 | **Monolithic `rlm-core` vs split crates** at workspace scaffold | Phase 51 | Start with logical modules inside one crate; split when dep graph stabilizes |
| 5 | **Managed llama.cpp** entry criteria | Post-v1.8 | Gate behind `managed-llama` Cargo feature after HF install stable |
| 6 | **v1.7 completion gate** — is plugin taxonomy frozen enough to start Phase 51? | Phase 51 | Confirm manifest schema + registry service stable before Rust port begins |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Workspace layout, axum/tokio/serde/yaml_serde verified; usearch/hf-hub MEDIUM within stack |
| Features | **HIGH** | Complete route inventory from live handlers; 471 TS tests as behavioral spec |
| Architecture | **HIGH** | TS→Rust module map verified against `ports/`, control-server, persistence layouts |
| Pitfalls | **HIGH** | Repo-specific pitfalls with detection/prevention; Rust ecosystem choices MEDIUM |
| Plugin external loading | **LOW** | No RLM decision yet; explicit defer to Phase 60 |
| Managed inference | **LOW** | Defer until Ollama strangler path stable |

**Overall confidence:** **HIGH** for migration strategy, phase ordering, and table-stakes scope; **MEDIUM** for ANN/HF crate choices and external plugin bridge.

### Gaps to Address

- **ANN cross-compile validation:** Run usearch build on all three desktop CI targets during Phase 55 planning; confirm fallback path.
- **hf-hub 1.x GA watch:** Pin RC with explicit upgrade task when stable releases.
- **External plugin user communication:** Doctor output and docs must state Rust-mode limitations before cutover to avoid v1.7 trust regression.
- **Parity matrix ownership:** Assign TS test → Rust test mapping early in Phase 51; block Phase 59 without ≥80% coverage.
- **Composition init order:** Port `COMPOSITION_INIT_ORDER` with unit test equivalent to v1.7 init-order test in Phase 57.

---

## Sources

### Primary (HIGH confidence)
- `.planning/notes/rust-runtime-migration-direction.md` — priority order, success criteria, deferred scope
- `.planning/PROJECT.md` — v1.8 milestone scope, v1.7 baseline (471 tests)
- `src/application/control-server/handlers/*`, `route-request.ts` — HTTP contract inventory
- `src/ports/*`, `src/domain/*`, `src/adapters/persistence/*` — migration map and on-disk formats
- `src-tauri/src/main.rs`, `scripts/packaging/build-release.mjs` — Node child lifecycle and release layout
- `.planning/seeds/rust-vector-index.md`, `.planning/seeds/managed-llama-cpp-runtime.md` — vector and inference deferrals

### Secondary (MEDIUM confidence)
- [axum SSE docs](https://docs.rs/axum/latest/axum/response/sse/index.html) — SSE stack
- [hf-hub crate](https://docs.rs/hf-hub/latest/hf_hub/) — 1.x RC stability
- [usearch docs](https://docs.rs/crate/usearch/) — ANN persistence
- [Microsoft Strangler Fig pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig) — migration rhythm
- [Tauri v2 sidecar docs](https://v2.tauri.app/develop/sidecar/) — lifecycle lessons
- RAGtronic / Node→Rust case studies — streaming + memory motivations

### Tertiary (LOW confidence)
- WASM / dylib external plugin approaches — deferred; needs Phase 60 spike
- `llama-cpp-2` in-process timing — defer until HF path stable
- [candle GGUF RoPE issue #3410](https://github.com/huggingface/candle/issues/3410) — confirms candle deferral

---
*Research completed: 2026-05-22*  
*Ready for roadmap: yes — proceed to REQUIREMENTS.md and ROADMAP phases 51–59 (60 optional)*
