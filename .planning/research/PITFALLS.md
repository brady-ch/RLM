# Domain Pitfalls

**Domain:** Full Rust runtime migration for an existing TypeScript AI orchestration system (recursive engine, control server, persistence, desktop shell)  
**Milestone:** v1.8 — Rust Runtime Migration  
**Researched:** 2026-05-22  
**Confidence:** HIGH for repo-specific pitfalls (471 TS tests, `FileSessionStore`/`FileVectorIndex` formats, Tauri Node-child lifecycle in `src-tauri/src/main.rs`, v1.7 plugin zip-slip defenses); MEDIUM for Rust ecosystem choices (ANN crates, `hf-hub`, Tauri in-process server patterns — verified against direction doc and official Tauri sidecar docs)

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or silent UI breakage during the TS → Rust runtime swap.

### Pitfall 1: Big-Bang Rewrite Instead of Strangler Seams

**What goes wrong:**
The team freezes feature work and rewrites orchestration, control server, persistence, and desktop shell in one branch. Months pass with no shippable desktop build. The React UI is pointed at a half-implemented Rust server; regressions are discovered late because there is no side-by-side comparison. Alternatively, a **fake strangler** ships: Rust wraps TS via FFI or spawns Node anyway, so the milestone completes without removing bundled Node — the stated success criterion in `rust-runtime-migration-direction.md`.

**Why it happens:**
Rust migration feels like a “clean slate” opportunity. The existing `ports/` map cleanly to Rust traits, which tempts a full port before any HTTP boundary is frozen. v1.7’s extraction work is treated as “already done” rather than as **migration seams** that must stay behavior-preserving.

**Consequences:**
- Desktop installer still bundles Node (goal miss)
- Long-lived feature branch; v1.7 plugin manager and UI work diverge
- No incremental rollback — failure is all-or-nothing
- “Strangler” that keeps Node as hidden sidecar doubles process complexity without removing dependency

**Prevention:**
Follow the direction doc’s explicit priority order — **control server + session/graph APIs first**, then recursive engine, then persistence, then vector, then model hosts, then CLI, then Tauri. Each slice must:
1. Preserve the existing HTTP/SSE contract the UI already calls (`/api/session`, `/api/events`, `/api/graph/*`, etc.)
2. Run behind a feature flag or dual-runtime gate until parity tests pass
3. Ship a working desktop build after every major slice

Keep Ollama as default inference host during migration; do not block Rust core on in-process llama.cpp.

**Detection:**
- PR touches recursive engine before control-server routes are ported and contract-tested
- `src-tauri` still spawns Node child at milestone “complete”
- No golden-file or snapshot tests comparing TS vs Rust API responses
- Rust workspace has no incremental merge path to main

**Phase to address:** Phase 1 — Control server strangler + API contract freeze; Phase 6 — CLI dual-runtime gate; Phase 7 — Tauri cutover (Node removal only after Phases 1–5 green)

---

### Pitfall 2: HTTP API Drift Breaking React UI Silently

**What goes wrong:**
Rust control server returns subtly different JSON: missing nullable fields become absent vs `null`, numeric enums become strings, SSE event shapes change (`ExecutionEvent` field renames), error status codes shift (400 vs 409 for stale approval). The UI uses permissive `fetch` + loose typing — no OpenAPI or JSON Schema gate — so mismatches surface as blank panels, stuck spinners, or “works in curl, broken in UI” with no server error.

**Why it happens:**
Route handlers are ported one file at a time from `src/application/control-server/handlers/` without a **contract artifact**. The UI (`ui/src/main.tsx`) calls ~25 distinct `/api/*` paths; route precedence in `route-request.ts` is order-sensitive legacy behavior easy to reorder in Axum/actix.

**Consequences:**
- Silent UX failures (graph layout not persisting, approval tokens ignored, plugin panel empty)
- Debugging requires manual diff of network tabs across TS vs Rust builds
- v1.7 plugin manager UI (Phase 51) breaks without obvious server error

**Prevention:**
Before porting handlers, extract a **frozen contract suite**:
- Golden JSON fixtures from current TS server for each route (GET snapshots + POST mutation responses)
- SSE event sequence fixtures for `/api/events` (run mode, graph updates, approvals)
- Preserve route probe order documented in `route-request.ts`
- Add Rust integration tests that assert byte-identical JSON (or schema-valid equivalent with explicit null rules)
- Consider generating TypeScript types from shared JSON Schema or OpenAPI — UI already hand-rolls types in `main.tsx`

**Detection:**
- Rust handler returns `{ error: "..." }` where TS returned `{ message: "..." }`
- UI `response.json()` succeeds but downstream render shows empty state
- No test covers `/api/plugins`, `/api/model-library`, or `/api/saved-sessions/*` against Rust server
- 404 vs 405 vs fall-through to static UI asset (TS `serveUiAsset` fallback)

**Phase to address:** Phase 1 — Control server strangler (contract freeze is first deliverable, not last)

---

### Pitfall 3: Async/Concurrency Bugs in Recursive Engine

**What goes wrong:**
The Rust port of `RecursiveLanguageModel` introduces race conditions: concurrent child task decomposition mutates shared `modelCalls` budget; cancellation (`/api/stop`) leaves in-flight tool rounds running; graph executor fires parallel nodes without parent-failure propagation; SSE subscribers receive events out of order; `Arc<Mutex<>>` deadlocks under nested recursion depth.

**Why it happens:**
TypeScript’s single-threaded event loop hides many concurrency bugs — `async/await` serializes most engine work implicitly. Rust + Tokio requires explicit ownership: which tasks share state, how `maxModelCalls` is enforced across spawned sub-tasks, how stop signals propagate through recursive decomposition and quality loops.

**Consequences:**
- Budget overrun (more model calls than configured — cost + non-determinism)
- Zombie tool executions after user clicks Stop
- Graph nodes marked running forever
- Heisenbugs under parallel graph branches only reproducible on multi-core

**Prevention:**
- Port budget guard (`budget-guard.ts`) and tool-round loop as **single-owner modules** first; test in isolation before wiring recursion tree
- Model execution graph sync (`execution-graph-sync.ts`) should emit events through a **single serializing channel** to SSE — same ordering guarantees as TS today
- Use structured cancellation: `tokio::select!` with biased priority for stop signals (mirrors v1.7 MCP cleanup via `ResourceCleanup`)
- Avoid `Arc<Mutex<RecursiveLanguageModel>>` — prefer message-passing or scoped tasks with explicit parent handles
- Property tests for: stop mid-recursion, parent fail blocks children, budget exhausted returns deterministic error code (`EXECUTION_FAILURE_CODES`)

**Detection:**
- Intermittent test failures under `RUST_TEST_THREADS=8`
- `modelCalls` in result metadata exceeds `maxModelCalls`
- Stop endpoint returns 200 while tool subprocess still running
- SSE clients receive completion before child node events

**Phase to address:** Phase 2 — Recursive engine + graph executor

---

### Pitfall 4: Session Memory and Vector Index Data Loss During Format Migration

**What goes wrong:**
Rust persistence writes a new on-disk layout without reading v1.4+ session snapshots. Users open saved sessions and lose episodic memory, artifact refs, or vector records. Global `.rlm/memory/vector-index.json` is replaced by a binary ANN index that cannot ingest existing JSON records. Migration runs destructively on first Rust boot.

**Why it happens:**
`FileSessionStore` uses a multi-section manifest (`session.json`, `memory.json`, `vector-index.json`, etc.) with `MANIFEST_VERSION = 1`. Rust vector work targets HNSW/USEARCH (`rust-vector-index.md`) — teams treat the new index as greenfield instead of **read-old / write-new / dual-read fallback**.

**Consequences:**
- Irreversible user data loss (saved sessions are primary desktop value)
- UI shows empty memory panel with no “degraded” banner
- Session reopen verification (`SavedSessionVerification`) passes section counts but semantic search returns nothing

**Prevention:**
- **Dual-read migration:** Rust opens existing JSON sections; on first save, optionally writes new format alongside or migrates atomically with backup
- Vector path: import all `VectorIndexRecord` entries from JSON into ANN index on first open; keep JSON export for rollback until milestone stable
- Preserve `mergeSessionRecords(sessionId, records)` semantics — session-scoped merge, not full reindex
- Surface explicit degraded state when index corrupt or embed host unavailable (seed constraint: no silent empty results)
- Integration test: save session in TS → reopen in Rust → memory search returns same top-k

**Detection:**
- Migration code deletes `.rlm/sessions/` or `vector-index.json` without backup
- No test loads fixture from `tests/adapters/persistence/` into Rust runtime
- ANN index created empty when JSON had records
- `SavedSessionRestoreStatus` reports `ok` but vector section empty

**Phase to address:** Phase 3 — Persistence parity; Phase 4 — Vector index (migration is Phase 4 entry criterion, not optional follow-up)

---

### Pitfall 5: Plugin System Re-Port Complexity (v1.7 Just Shipped TS Plugins)

**What goes wrong:**
v1.8 attempts to rewrite the entire plugin system in Rust immediately after v1.7 delivered manifest schema, `PluginLoader`, remote fetch with zip-slip defenses, CLI + UI manager, and allowlist trust gates. External plugins remain Node `register(host)` modules; Rust has no dynamic import story. Team either: (a) rewrites all builtins in Rust and breaks external plugin compatibility, or (b) keeps a Node plugin host forever, defeating “remove Node from bundle.”

**Why it happens:**
Plugin taxonomy was the v1.7 milestone centerpiece — architecture docs treat plugins as the extensibility surface. Rust migration plans assume plugins port like persistence adapters, but **distribution and dynamic loading are language-specific**.

**Consequences:**
- External plugins installed via `rlm plugin install` stop working
- Duplicate plugin systems (TS loader + Rust loader) with divergent doctor/enablement state — v1.7 Pitfall 4/5 recurrence
- Months spent on WASM sandbox or subprocess IPC before core runtime ships
- v1.7 zip-slip and allowlist investment wasted if Rust fetch reimplements unsafely

**Prevention:**
Explicit **bridge strategy** in roadmap (do not conflate with core runtime phases):
- **Phase 9 (deferred or parallel track):** Rust builtins for shell/files/web as native tools; external plugins via documented bridge (subprocess Node micro-host, WASM, or “TS plugins require legacy mode”)
- Reuse manifest schema (`rlm.plugin.json`) — validate in Rust without executing entry
- Port zip-slip, size limits, and staging semantics from `src/plugins/remote-fetch/` verbatim — same test fixtures
- Do **not** block Phases 1–7 on full plugin re-port; Rust core ships with built-in tools only + interop MCP unchanged

**Detection:**
- Rust milestone includes “rewrite PluginLoader” in critical path before Tauri cutover
- External plugin install works in TS CLI but not Rust CLI with no documented limitation
- Two catalog.json writers

**Phase to address:** Phase 9 — Plugin bridge strategy (explicitly after Phase 7 Tauri cutover); Phases 1–7 use Rust-native builtins only

---

### Pitfall 6: Tauri + Rust Server Lifecycle (Port, Shutdown, Ollama Readiness)

**What goes wrong:**
Desktop app fails to start on second launch (port 0 not reused correctly; hardcoded port conflict). Window close leaves orphan `rlm-core` or Ollama child processes. Tauri webview loads before server is listening — blank screen instead of today’s stderr redirect pattern (`RLM UI listening at` → `window.location.replace`). Ollama readiness still depends on bundled Node running `ensure-ollama.mjs` while Rust migration removes Node.

**Why it happens:**
Current `src-tauri/src/main.rs` spawns Node child (`rlm ui`), parses stderr for URL, kills child on window close. End state embeds Rust HTTP server **in-process** or as Tauri sidecar — different lifecycle semantics. `ensure-ollama.mjs` uses `fetch` + optional `ollama serve` spawn — must be reimplemented in Rust without regressing `RLM_MANAGE_OLLAMA` behavior.

**Consequences:**
- Orphan processes on Linux/macOS/Windows
- Desktop “works in dev, fails installed” when resource paths differ (`resolve_release_root` platform tags)
- Race: UI fetches `/api/session` before server binds
- Ollama unavailable with opaque error (today exits with actionable stderr)

**Prevention:**
- Bind Rust server to `127.0.0.1:0`; pass actual URL to webview via Tauri event or initial navigation URL — do not scrape stderr in production path
- Register shutdown hook: window close → graceful HTTP drain → cancel in-flight executions → stop managed Ollama if `RLM_MANAGE_OLLAMA=1`
- Port `ensure-ollama.mjs` logic to Rust (HTTP probe `/api/version`, retry loop, detached serve) before removing Node from bundle
- Health endpoint `/api/health` or reuse `/api/session` for readiness gate before webview load
- Test installed `.deb`/bundle on clean VM without dev `dist/release` fallback paths

**Detection:**
- `lsof -i` shows stale listeners after app quit
- Tauri setup panics when `release/<platform-tag>/` missing (packaging not run)
- Ollama check requires `node_runtime()` path still present at Phase 7 “done”

**Phase to address:** Phase 7 — Tauri embedded runtime; Ollama readiness sub-task within Phase 7 (blocks Node removal)

---

### Pitfall 7: Test Parity Gaps (471 TS Tests vs New Rust Tests)

**What goes wrong:**
Rust workspace ships with ~40 smoke tests while TS suite has **471 passing tests** covering domain recursion, graph executor, session store, plugin remote-fetch, runtime composition init order, and integration paths. Team declares migration complete because `cargo test` passes, but behavior regressions lurk in unported edge cases (quality loop, approval tokens, saved session verification, plugin doctor).

**Why it happens:**
Rewriting tests from scratch is expensive; Rust tests tend to cover happy paths only. TS tests encode years of bug fixes (zip-slip, stale approval, graph parent-fail blocking). No mechanical translation exists for `node:test` → `cargo test`.

**Consequences:**
- Regressions discovered by users on desktop, not CI
- Fear of deleting TS tests leaves dual maintenance forever
- Critical security tests (remote-fetch) not replicated in Rust HF download path

**Prevention:**
- **Parity matrix:** spreadsheet or manifest mapping each TS test file → Rust equivalent or “TS-only until Phase N”
- Prioritize porting: `tests/domain/recursion/`, `tests/application/graph/`, `tests/adapters/persistence/`, `tests/plugins/remote-fetch.test.ts` (patterns for HF archives)
- Golden HTTP tests runnable against either runtime (same fixture, two backends)
- CI gate: `npm run check` for UI + TS; `cargo test` + `cargo clippy` for Rust; **parity subset** must pass both until TS runtime removed
- Do not delete TS tests until Rust test count covers same behaviors (target: ≥80% behavioral coverage before Node removal)

**Detection:**
- Rust test count < 100 while claiming engine + persistence done
- No Rust test for stop/cancel, session save/reopen, or graph parallel fail
- CI only runs Rust OR TS, not contract parity job

**Phase to address:** Phase 1 — HTTP contract tests; Phase 2–4 — port domain/persistence tests; Phase 6 — parity gate in CI

---

## Moderate Pitfalls

### Pitfall 8: Binary Size and Cross-Platform Build Matrix Explosion

**What goes wrong:**
Shipping `llama.cpp`, ANN index, and HF download in one binary produces 200MB+ artifacts; CI builds `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `win32-x64` with inconsistent feature flags. Tauri bundle exceeds update CDN limits. Optional GPU backends (CUDA/Metal) multiply matrix further.

**Why it happens:**
Rust migration conflates “remove Node” with “embed all inference locally.” Direction doc keeps Ollama as default and defers fine-tuning; embedding llama.cpp is optional per seeds.

**Prevention:**
- Default desktop bundle: Rust core + static UI + Ollama HTTP client only (no embedded llama.cpp in v1.8)
- ANN crate choice: prefer lightweight embedded (`usearch`/`instant-distance`) over bundled Qdrant
- Reuse existing `dist/release/<platform-tag>/` packaging concept but replace `bin/node` with `bin/rlm-core`
- CI: build matrix matches current three platforms; arm64 Linux if already supported
- Track binary size budget in release script; fail CI on >N% regression

**Phase to address:** Phase 6 — CLI packaging; Phase 7 — Tauri bundle

---

### Pitfall 9: Hugging Face Download Security (Zip-Slip Recurrence)

**What goes wrong:**
Rust HF artifact download extracts `.tar.gz` or `.gguf` archives without path traversal guards, size limits, or staging — repeating vulnerabilities v1.7 fixed for plugins (`fetchAndExtractArchive`, `isUnsafeArchiveEntryPath`, max download bytes). Malicious or compromised HF mirror writes outside model cache dir.

**Why it happens:**
New Rust code uses `hf-hub` + generic tar crate without copying v1.7’s filter semantics. HF URLs treated as trusted because “official catalog.”

**Prevention:**
Port security checklist from `tests/plugins/remote-fetch.test.ts`:
- Reject `..`, absolute paths, symlinks pointing outside root
- Enforce `maxDownloadBytes` and archive entry count limits
- Download → hash verify (if manifest provides) → staging dir → validate → atomic rename to cache
- No execute/import of downloaded artifacts during “search” or “validate” flows (v1.7 Pitfall 6 pattern)
- Reuse evil.tgz fixture logic for Rust extract tests

**Phase to address:** Phase 8 — Hugging Face download pipeline

---

### Pitfall 10: Strangler “Dual Runtime” Operational Debt

**What goes wrong:**
TS and Rust servers both exist indefinitely — env var selects backend, docs unclear, bug reports ambiguous (“which runtime?”). Feature additions land in TS only; Rust falls behind.

**Prevention:**
Time-box dual runtime to migration milestone only. Public env flag `RLM_RUNTIME=rust|node` with deprecation date. New features land in Rust first once Phase 1 ships.

**Phase to address:** Phase 6 — CLI entrypoint (document and enforce sunset)

---

### Pitfall 11: SSE Backpressure and Event Loss

**What goes wrong:**
Rust server emits execution events faster than webview consumes; slow clients drop events with no replay; UI graph desyncs from runtime truth.

**Prevention:**
Bounded channel with drop policy or snapshot + incremental events (graph already has `/api/graph/snapshot`). Match TS behavior for late-connecting SSE clients (send current run mode snapshot on connect).

**Phase to address:** Phase 1 — Control server (`/api/events`)

---

### Pitfall 12: Embedding Host Coupling During Vector Migration

**What goes wrong:**
Rust ANN index assumes new embedding dimensions/model; old JSON records have incompatible vectors; search returns garbage without dimension check.

**Prevention:**
Store embedding model id + dimension in index metadata; reject mismatched upserts; rebuild path documented in `rust-vector-index.md`.

**Phase to address:** Phase 4 — Vector index

---

## Minor Pitfalls

### Pitfall 13: Windows Path and WLM Edge Cases in Rust Persistence

**What goes wrong:**
Session paths, plugin dirs, and HF cache break on Windows when Rust uses `/` assumptions or lacks `pathToFileURL` equivalent — v1.7 Pitfall 15 recurrence.

**Prevention:**
Use `std::path` consistently; port Windows path tests from extension host.

**Phase to address:** Phase 3 — Persistence

---

### Pitfall 14: Logging and Error Vocabulary Drift

**What goes wrong:**
Rust stderr format differs; Tauri no longer parses “RLM UI listening at”; structured error codes (`EXECUTION_FAILURE_CODES`) become plain strings.

**Prevention:**
Preserve error code enum mapping in HTTP JSON; document stderr prefixes for desktop shell.

**Phase to address:** Phase 1, Phase 7

---

### Pitfall 15: `npm run check` vs Rust CI Split

**What goes wrong:**
UI TypeScript breaks because API types drift; Rust CI green in isolation.

**Prevention:**
Keep `npm run check` in required CI for UI; add contract test job crossing both.

**Phase to address:** Phase 1 — ongoing

---

## Phase-Specific Warnings

| Phase topic | Likely pitfall | Mitigation |
|-------------|----------------|------------|
| **Phase 1** — Control server strangler | API field drift, route order change | Golden JSON fixtures; preserve `route-request.ts` probe order |
| **Phase 1** — SSE `/api/events` | Event loss on reconnect | Snapshot on connect; parity with TS event sequence tests |
| **Phase 2** — Recursive engine | Budget race, stop doesn't cancel tools | Single-owner budget; biased `select!` for stop |
| **Phase 2** — Graph executor | Parallel child without parent-fail block | Port `executeGraph` test suite (tests 35–38+ in graph tests) |
| **Phase 3** — Persistence | Destructive format migration | Dual-read JSON sections; backup before write |
| **Phase 4** — Vector index | Empty ANN after JSON existed | Import JSON on first open; scope-filter before ANN search |
| **Phase 5** — Model hosts | Breaking Ollama streaming | Keep HTTP adapter first; port streaming tests |
| **Phase 6** — CLI + packaging | Dual runtime confusion | Document `RLM_RUNTIME`; sunset plan |
| **Phase 6** — Binary size | Embedding llama.cpp by default | Ollama-only default bundle |
| **Phase 7** — Tauri cutover | Orphan processes, port race | In-process server + shutdown hook; Rust Ollama probe |
| **Phase 7** — Node removal | ensure-ollama still JS | Port readiness to Rust before deleting `bin/node` |
| **Phase 8** — HF download | Zip-slip, unbounded download | Port v1.7 archive defenses; evil.tgz-style tests |
| **Phase 9** — Plugin bridge | External TS plugins break | Native builtins + documented bridge; defer full re-port |

---

## Integration Gotchas

| Integration | Common mistake | Correct approach |
|-------------|----------------|------------------|
| **React UI ↔ Rust server** | Loose JSON typing hides drift | Contract tests + shared schema; fail CI on diff |
| **SSE ↔ graph UI** | Missing snapshot on reconnect | Emit full graph/run mode on subscribe |
| **Session store ↔ vector index** | Reindex all on save | Session-scoped merge (`mergeSessionRecords`) |
| **Ollama ↔ Rust engine** | Blocking HTTP in async context | `reqwest` + timeouts; cancel on stop |
| **Tauri ↔ localhost server** | Hardcoded port | Bind `:0`; inject URL into webview |
| **HF hub ↔ Ollama import** | Wrong GGUF layout | Validate artifact; map to Ollama modelfile separately |
| **v1.7 plugins ↔ Rust runtime** | Rewrite loader in critical path | Builtins native; external via bridge Phase 9 |
| **TS tests ↔ Rust tests** | No mapping | Parity matrix; golden HTTP fixtures |
| **Packaging ↔ dev paths** | `CARGO_MANIFEST_DIR/../dist` fallback in prod | Installed bundle uses resource_dir only |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| **HF archive path traversal** | Arbitrary file write | Same guards as `isUnsafeArchiveEntryPath` |
| **Unbounded HF download** | DoS / disk fill | `maxDownloadBytes`; entry count cap |
| **Import/run GGUF on search** | Code execution via malicious artifact | Download to staging; validate magic/header only until explicit install |
| **Plugin bridge executes unapproved code** | Supply chain | Allowlist + manifest-only validate until enable |
| **Rust server binds 0.0.0.0** | LAN exposure | Keep `127.0.0.1` only (match TS `startControlServer`) |
| **Session dir symlink escape** | Read/write outside `.rlm` | Canonicalize paths; reject `..` |

---

## UX Pitfalls

| Pitfall | User impact | Better approach |
|---------|-------------|-----------------|
| **Silent API mismatch** | Blank UI panels | Schema-valid errors; UI fallback banners |
| **Session reopen data loss** | Trust destroyed | Migration backup + explicit restore status |
| **Stop doesn't stop** | Runaway tool/shell | Cancel propagation; show stopping state |
| **Desktop blank on launch** | App looks broken | Wait for health check before webview navigate |
| **Plugin install worked in TS, fails in Rust** | Confusion | Clear “external plugins require legacy mode” until Phase 9 |

---

## Recovery Strategies

| Pitfall | Recovery cost | Recovery steps |
|---------|---------------|----------------|
| Big-bang rewrite stall | HIGH | Revert to strangler; ship TS runtime; slice by Phase 1 order |
| API drift | MEDIUM | Golden fixtures; fix Rust to match TS contract |
| Data loss on migration | HIGH | Restore from `.rlm` backup; dual-read code path |
| Dual runtime debt | MEDIUM | Freeze TS features; set sunset; delete Node in Phase 7 only |
| Test parity gap | MEDIUM | Port highest-value TS tests first; block Node removal |
| HF zip-slip | MED–HIGH | Quarantine cache dir; port v1.7 extract filters |

---

## Pitfall-to-Phase Mapping

Suggested v1.8 phase order (from `rust-runtime-migration-direction.md` migration priority). Phase numbers are planning placeholders until ROADMAP is generated.

| Pitfall | Prevention phase | Verification |
|---------|------------------|--------------|
| Big-bang rewrite | Phase 1 → 7 strangler order | Desktop build after each phase; Node gone only Phase 7 |
| Fake strangler (Node remains) | Phase 7 — Tauri cutover | Installed bundle has no `bin/node` |
| HTTP API drift | Phase 1 — Control server | Golden JSON + SSE fixtures; UI e2e smoke |
| Route precedence break | Phase 1 | Port order documented; routing integration test |
| Async/concurrency bugs | Phase 2 — Recursive engine + graph | Budget/stop/parallel-fail tests under multi-thread |
| Session memory data loss | Phase 3 — Persistence | TS-save → Rust-open integration test |
| Vector index data loss | Phase 4 — Vector index | JSON import; mergeSessionRecords parity |
| Embedding dimension mismatch | Phase 4 | Metadata check; rebuild path |
| Plugin re-port too early | Phase 9 — Plugin bridge | Phases 1–7 ship Rust builtins only |
| Plugin security regression | Phase 9 (or Phase 8 if HF shared extract) | evil.tgz-equivalent Rust tests |
| Tauri port/shutdown bugs | Phase 7 — Tauri embedded | No orphan processes; clean second launch |
| Ollama readiness JS dependency | Phase 7 | Rust probe replaces `ensure-ollama.mjs` |
| Test parity gap | Phases 1–6 cumulative | Parity matrix ≥80% before Node removal |
| Binary size blowup | Phase 6–7 packaging | Size budget CI; no default llama.cpp embed |
| HF zip-slip / unbounded download | Phase 8 — HF pipeline | Port remote-fetch security tests |
| Dual runtime confusion | Phase 6 — CLI | Documented flag + sunset |
| SSE event loss | Phase 1 | Reconnect snapshot test |
| Windows path regression | Phase 3 | Port v1.7 Windows path tests |

---

## v1.7 Pattern Carryover

These v1.7 pitfalls recur in v1.8 if migration ignores their lessons:

| v1.7 pitfall | v1.8 recurrence risk | Mitigation |
|--------------|---------------------|------------|
| Manager/runtime desync (P5) | Rust handlers bypass shared service | One `PluginRegistry` trait impl in Rust; same for session/graph services |
| Execute on fetch/validate (P6) | HF download runs modelfile on search | Staging + validate-only until explicit install |
| Parallel loading paths (P4) | TS + Rust plugin loaders | Single loader per runtime; bridge document for externals |
| Flag-day cutover | Big-bang Node removal | Phase 7 only after parity green |
| Path traversal in archives (security) | HF extract | Reuse zip-slip test patterns |

---

## Sources

- RLM `.planning/notes/rust-runtime-migration-direction.md` — strangler priority, success criteria, deferred scope
- RLM `.planning/seeds/rust-vector-index.md` — ANN migration, dual-read, degraded states
- RLM `.planning/research/questions.md` — strangler order, HF flow, ANN crate selection
- RLM `.planning/research/PITFALLS.md` (v1.7) — pitfall structure, zip-slip, manager/runtime desync patterns
- RLM `src-tauri/src/main.rs` — Node child spawn, stderr URL redirect, Ollama via ensure-ollama.mjs
- RLM `scripts/desktop/ensure-ollama.mjs` — readiness probe, managed serve
- RLM `scripts/packaging/build-release.mjs` — platform-tag matrix, bundled Node layout
- RLM `src/application/control-server/route-request.ts` — route probe order
- RLM `src/adapters/persistence/file-session-store.ts` — manifest sections, version constants
- RLM `src/adapters/persistence/file-vector-index.ts` — JSON records, mergeSessionRecords
- RLM `src/domain/recursive-language-model.ts` — budget, recursion, tool rounds
- RLM `tests/plugins/remote-fetch.test.ts` — zip-slip, size limits (471 total tests in suite)
- RLM `ui/src/main.tsx` — `/api/*` surface consumed by UI
- [Tauri v2 sidecar documentation](https://v2.tauri.app/develop/sidecar/) — spawn, permissions, lifecycle (MEDIUM — in-process server may differ but shutdown lessons apply)

---
*Pitfalls research for: v1.8 Rust Runtime Migration — TS orchestration to Rust core with React UI preserved*  
*Researched: 2026-05-22*
