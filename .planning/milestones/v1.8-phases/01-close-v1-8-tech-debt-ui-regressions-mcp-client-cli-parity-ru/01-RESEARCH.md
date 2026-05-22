# Phase 1: Close v1.8 tech debt — UI regressions, MCP client, CLI parity, run-state resume - Research

**Researched:** 2026-05-22
**Domain:** Rust MCP stdio client, Rust CLI execution, run-state persistence, React UI regressions
**Confidence:** HIGH (codebase-verified); MEDIUM (MCP port approach, PERS-03 scope)

## Summary

Phase 1 closes six partial v1.8 requirements spanning four largely independent workstreams. The codebase already contains working Rust backends for every UI regression (pause-auto-approvals route, HF download route, run-state store) — the UI wiring dropped in Phase 61 is the primary gap for Wave 1. The MCP interop stage in `build_runtime_context` is an explicit no-op stub; the TS reference implementation in `src/runtime/interop/interop-runtime.ts` is complete and test-backed. Rust CLI `ask` is a hard stub (`exit 2`); the execution engine (`RecursiveLanguageModel`, `GraphExecutor`, `RouterState` model resolution) already exists and can be reused for CLI parity without new domain logic.

**Critical PERS-03 finding:** Both TS and Rust orchestrators currently persist **only `nodeStatuses`** via `RunStatePersistence`. The store schema includes `checkpoints` and `resumeCursor`, but neither runtime writes them today `[VERIFIED: grep src/domain + crates/rlm-core]`. Wave 4 should extend Rust with meaningful cursor/checkpoint writes and document the shared gap rather than chase nonexistent TS behavior.

**Primary recommendation:** Execute in four waves matching CONTEXT priority — UI+UAT first (unblocks REG-01), then MCP stdio port mirroring TS framing, then Rust `ask` (workflow staged), then run-state cursor extension with explicit gap documentation.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pause future auto-approvals UI | Browser / Client | API / Backend | TopBar calls existing `POST /api/pause-future-auto-approvals`; session authority lives in Rust `InteractiveExecutionSession` |
| HF model install UI | Browser / Client | API / Backend | `ModelLibraryRow` must call `POST /api/model-library/download`; download logic already in `ModelLibraryService` |
| Graph mutation modals | Browser / Client | — | Replace `window.prompt`/`confirm` in `NodeContextMenu`; no backend change |
| `.secondary` / Run button styles | Browser / Client | CDN / Static | Pure CSS + className fix in `TopBar.tsx` |
| MCP stdio JSON-RPC client | API / Backend (rlm-core) | — | Subprocess spawn + framing in Rust runtime composition; registers tools on `ExtensionHost` |
| MCP doctor/status surfacing | API / Backend | Browser / Client | Doctor issues from registry; UI plugins panel displays warnings |
| Rust CLI `ask` / `workflow` | API / Backend (rlm-cli) | — | CLI loads config, builds runtime, invokes `RecursiveLanguageModel` / graph executor |
| Run-state checkpoint/resume | API / Backend (rlm-core) | Database / Storage | `FileRunStateStore` + `RunStatePersistence`; `.planning/runs/*.json` on disk |
| REG-01 human UAT | — (manual) | Browser + API | Operator checklist in `61-06-VERIFICATION.md`; no new automation required |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Priority ordering
1. **Wave 1 — UI regressions + UAT** (fast wins, unblocks REG-01): pause-auto-approvals, HF download wiring, UI-REVIEW top fixes, REG-01 checklist
2. **Wave 2 — MCP client** (Rust stdio JSON-RPC, port TS behavior; doctor warning when configured but disconnected)
3. **Wave 3 — CLI parity** (Rust `ask`/`workflow` at minimum; keep `RLM_RUNTIME=node` escape hatch until parity proven)
4. **Wave 4 — Run-state resume** (extend beyond minimal `persist_node_status`; align with TS `RunStatePersistence` cursor semantics)

#### MCP architecture
- RLM remains an **MCP client** (not server) — subprocess stdio to configured `interop.mcp.servers`
- MCP is complementary to native Rust plugins; do not conflate with plugin registry
- Replace no-op `record("interop")` stub with real tool registration on `ExtensionHost`

#### MCP vs plugins
- Native plugins: first-party + installable via registry
- MCP: bridge to external MCP ecosystem without Rust ports

### Claude's Discretion
- Exact plan split (number of PLAN.md files) and wave boundaries
- Whether CLI-01 ships full workflow parity or staged ask-first
- How much run-state resume to implement vs document as remaining debt

### Deferred Ideas (OUT OF SCOPE)
- External ESM plugin WASM/subprocess bridge (INFR-02 beyond MCP)
- Command palette
- Full quality-loop TS behavioral parity
- PACK-03 headless `.deb` smoke unless trivial CI fix
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REG-01 | UI workflows behave as before on Rust runtime | Wave 1 restores two wiring regressions + UI-REVIEW fixes; execute `61-06-VERIFICATION.md` checklist |
| ENGN-02 | Approval/clarification handling parity | Backend complete; restore TopBar pause control wired to existing route |
| MDLH-03 | HF search + download without Python | Backend `download_hf_model` exists; fix `ModelLibraryRow` to call `/api/model-library/download` for `source: "huggingface"` |
| PLUG-03 | MCP interop in Rust init pipeline | Port `StdioMcpClient` from TS; wire in `build_runtime_context` between plugins and tools-resolver |
| CLI-01 | Rust `rlm` replaces Node for ask/workflow | Reuse `RouterState` patterns: `load_project_config` → `build_runtime_context` → `RecursiveLanguageModel::run`; workflow via graph sidecar + executor |
| PERS-03 | Run-state checkpoint/resume compatibility | Store schema ready; extend `RunStatePersistence` beyond node status; document shared TS/Rust gaps for full resume |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tokio | workspace (via rlm-core) | Async runtime, subprocess I/O for MCP | Already used throughout rlm-core/control-server `[VERIFIED: crates/rlm-core/Cargo.toml]` |
| serde / serde_json | workspace | MCP JSON-RPC payloads, run-state mutations | Project standard for persistence |
| axum | workspace | Control server routes (unchanged) | UI/API contract frozen in v1.8 |
| React 19 + Vite | ^19.2.1 / ^5.1.2 | UI shell fixes | Existing ui/ stack `[VERIFIED: package.json]` |
| lucide-react | ^0.468.0 | TopBar/modal icons | Phase 61 pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rmcp | 1.7.0 (crates.io) | Official MCP Rust SDK with `TokioChildProcess` | **Alternative** if hand-port proves fragile `[VERIFIED: docs.rs/rmcp, cargo search]` |
| tempfile | 3 | MCP/integration test fixtures | Already in rlm-core dev-deps |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-port TS `StdioMcpClient` | rmcp 1.7.0 + `transport-child-process` | rmcp is maintained and handles protocol edge cases; CONTEXT locks Content-Length stdio mirroring TS — direct port keeps test parity with `tests/runtime/interop/mcp-skill-interoperability.test.ts` and avoids SDK version/protocol drift |
| rmcp | rust-mcp-sdk 0.9.0 | Community fork; rmcp is the official MCP Rust SDK from modelcontextprotocol org |

**Installation (MCP — only if choosing rmcp):**
```bash
# Add to crates/rlm-core/Cargo.toml:
# rmcp = { version = "1.7", features = ["client", "transport-child-process"] }
```

**Version verification:** rmcp 1.7.0 on crates.io `[VERIFIED: cargo search rmcp]`; npm MCP packages not applicable to Rust path.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Wave 1: UI (React)                                                       │
│  TopBar ──POST──► /api/pause-future-auto-approvals                      │
│  ModelLibraryRow ──POST──► /api/model-library/download (HF)             │
│  NodeContextMenu ──modals──► /api/nodes/* (unchanged)                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Rust Control Server (Axum) — existing                                    │
│  InteractiveExecutionSession │ ModelLibraryService │ FileRunStateStore │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Wave 2: MCP in build_runtime_context                                   │
│  load_builtins ──► spawn MCP servers (stdio) ──► listTools/callTool    │
│       ──► ExtensionHost.register_tool("{serverId}.{toolName}")           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Wave 3: rlm-cli ask/workflow                                             │
│  load_project_config ──► build_runtime_context (with MCP)              │
│       ──► OllamaLanguageModel ──► RecursiveLanguageModel::run            │
│  workflow: load .rlm/workflows/*.yaml ──► GraphExecutor                  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Wave 4: RunStatePersistence                                              │
│  GraphExecutor ──► persist_node_status (existing)                      │
│                 ──► persist_resume_cursor / checkpoints (new)            │
│       ──► FileRunStateStore.mutate ──► .planning/runs/{runId}.json       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
crates/rlm-core/src/
├── interop/                    # NEW — mirror src/runtime/interop/
│   ├── mod.rs
│   ├── mcp_stdio_client.rs     # StdioMcpClient port from TS
│   └── mcp_tools.rs            # create_mcp_tools(), Tool wrappers
├── plugins/runtime.rs          # Wire interop into build_runtime_context
├── domain/run_state_persistence.rs  # Extend with cursor/checkpoint methods
crates/rlm-cli/src/
├── commands/ask.rs             # Replace stub with engine invocation
├── commands/workflow.rs        # NEW (optional staged) — graph workflow runner
ui/src/
├── app/TopBar.tsx              # Pause button + Run button class fix
├── legacy/panels.tsx           # ModelLibraryRow HF download branch
├── nodes/NodeContextMenu.tsx   # Modal triggers (or GraphActionModal.tsx)
├── nodes/GraphActionModal.tsx  # NEW — reusable prompt/confirm modals
└── styles.css                  # .secondary, .btn-run-primary
```

### Pattern 1: Port TS StdioMcpClient (locked approach)

**What:** Direct Rust translation of `StdioMcpClient` using `tokio::process::Command`, Content-Length framed JSON-RPC 2.0, pending request map, newline fallback parser.

**When to use:** Wave 2 MCP implementation per CONTEXT.

**Example:**
```rust
// Source: src/runtime/interop/interop-runtime.ts (lines 134-261) — behavioral spec
// Mirror: initialize (protocolVersion "2024-11-05"), notifications/initialized,
//         tools/list, tools/call, Content-Length write framing

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::{Child, Command};

struct StdioMcpClient {
    child: Child,
    next_id: u32,
    // pending: HashMap<u32, oneshot::Sender<Value>>,
    // buffer: String,
}

impl StdioMcpClient {
    async fn write_message(&mut self, payload: &Value) -> io::Result<()> {
        let body = serde_json::to_string(payload)?;
        let frame = format!(
            "Content-Length: {}\r\n\r\n{}",
            body.len(),
            body
        );
        self.child.stdin.as_mut().unwrap().write_all(frame.as_bytes()).await
    }
}
```

Tool registration pattern (match TS):
```rust
// Tool name: format!("{}.{}", server.id, tool.name)
// execute: client.call_tool(tool.name, args) → ToolExecutionResult
extension_host.register_tool(Arc::new(McpTool { client, ... }))?;
```

### Pattern 2: Rust CLI ask execution (reuse control-server wiring)

**What:** Extract shared bootstrap from `RouterState::new` — config load, model resolution, runtime context — into a function callable from `rlm-cli`.

**When to use:** Wave 3 CLI-01 minimum viable `ask`.

**Example:**
```rust
// Source: crates/rlm-core/src/control_server/mod.rs resolve_language_models,
//         RouterState::runtime_config, graph/executor.rs RLM path

let loaded = load_project_config(&project_root, config_path)?;
let runtime = build_runtime_context(BuildRuntimeContextInput {
    project_root: &project_root,
    project_config: Some(&loaded.config),
    on_init_stage: None,
});
let exec_model = resolve_exec_model(&loaded.config); // extract from RouterState
let config: RecursiveModelConfig = parse_runtime_config(&loaded.config);
let engine = RecursiveLanguageModel::new(exec_model, trace, runtime.tools);
let result = engine.run(&prompt, config, None).await?;
// Render JSON (--json) or stderr narrative like TS renderResult
```

Keep `RLM_RUNTIME=node` in `scripts/rlm-runtime.mjs` until workflow parity proven `[VERIFIED: scripts/rlm-runtime.mjs]`.

### Pattern 3: UI modal for graph mutations

**What:** Reuse existing `.modal-overlay` / `.modal-card` from `ui/src/legacy/panels.tsx` (session save dialog, lines 230-294).

**When to use:** Replace `window.prompt`/`confirm` in `NodeContextMenu.tsx` lines 157-191.

**Example:**
```tsx
// Source: ui/src/legacy/panels.tsx modal pattern + 61-UI-REVIEW.md priority fix #2
{modal?.kind === "add-child" ? (
  <div className="modal-overlay" role="presentation" onClick={closeModal}>
    <div className="modal-card" role="dialog" aria-labelledby="add-child-title" onClick={(e) => e.stopPropagation()}>
      <h2 id="add-child-title">Add child node</h2>
      <label htmlFor="child-prompt">Prompt</label>
      <input id="child-prompt" value={draft} onChange={...} />
      <div className="actions">
        <button className="secondary" onClick={closeModal}>Cancel</button>
        <button onClick={submitAddChild}>Add</button>
      </div>
    </div>
  </div>
) : null}
```

### Pattern 4: TopBar pause-auto-approvals

**What:** Restore control removed in Phase 61; wire to existing API.

**Conditions (match TS session handler semantics):**
- Show when `snapshot.status === "running"` and approval mode supports auto-approval (`initial-plan-recursive`)
- Hide or disable when `snapshot.autoApprovalPaused === true`
- On click: `post("/api/pause-future-auto-approvals")` then `refresh()`
- Include `aria-label="Pause future auto-approvals"`

**Note:** Rust route currently always succeeds (no 409 for terminal sessions) unlike TS `[VERIFIED: routes.rs:559 vs session.ts:301-317]` — optional parity fix, not blocking.

### Pattern 5: HF download wiring

**What:** Branch `ModelLibraryRow` install handler by `entry.source`:

| source | endpoint | body |
|--------|----------|------|
| `curated` | `POST /api/model-library/install` | `{ model: entry.ollamaModel ?? entry.id }` |
| `huggingface` | `POST /api/model-library/download` | `{ model: entry.id }` (repo_id) |
| `installed` | disabled | — |

Enable button when `source === "huggingface" && entry.status !== "unsupported" && !installing`.

`download_hf_model` validates repo_id, selects GGUF file, writes to `.rlm/models/registry/` `[VERIFIED: hf_registry.rs, routes.rs:1219]`.

### Anti-Patterns to Avoid

- **Using rmcp without verifying tool naming:** TS prefixes tools as `{serverId}.{toolName}`; agent allowlists may reference these names.
- **Conflating MCP with plugin registry:** Doctor checks catalog integrity; MCP connection status is separate interop concern.
- **Implementing full workflow CLI before ask:** CONTEXT discretion favors ask-first; workflow requires sidecar load + `execute_graph`.
- **Claiming PERS-03 TS parity for resumeCursor:** TS orchestrator does not write cursor today — extend Rust forward, document gap.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP Content-Length framing | New protocol variant | Port TS `StdioMcpClient` verbatim | CONTEXT locks framing; TS tests are behavioral spec |
| Modal/dialog UX | Custom overlay from scratch | `.modal-overlay` / `.modal-card` in `styles.css` | Existing accessible pattern in panels.tsx |
| CLI config/model resolution | Duplicate logic in ask.rs | Extract/share `RouterState` helpers | `resolve_language_models`, `runtime_config` already in control_server/mod.rs |
| HF download security | Skip validation | Existing `HfRegistry` path guards | `validate_safe_filename`, `MAX_HF_DOWNLOAD_BYTES` in hf_registry.rs |
| Run-state file format | New persistence schema | `FileRunStateStore` mutation API | ACL + capability tokens + version CAS already implemented |

**Key insight:** Most phase work is **wiring and porting**, not new domain design. Avoid new abstractions unless CLI bootstrap extraction proves necessary.

## Common Pitfalls

### Pitfall 1: MCP subprocess lifecycle leaks
**What goes wrong:** Zombie MCP child processes after control server shutdown or failed init.
**Why it happens:** TS registers processes via `onProcess` callback; Rust stub never spawns.
**How to avoid:** Store `Child` handles in runtime context; kill on drop/shutdown; mirror TS `rejectAll` on exit.
**Warning signs:** Orphan `node`/`npx` processes after `rlm ui` exit.

### Pitfall 2: HF Install button still calls wrong endpoint
**What goes wrong:** Search results render but Install stays disabled or hits `/install` with HF repo id.
**Why it happens:** `ModelLibraryRow` disables when `entry.source !== "curated"` and always posts to `/api/model-library/install` `[VERIFIED: panels.tsx:716-724]`.
**How to avoid:** Split handler by source; enable for `huggingface` when status is `available`.
**Warning signs:** REG-01 UAT step on HF download fails; network tab shows wrong route.

### Pitfall 3: Pause button shown in wrong approval modes
**What goes wrong:** Button visible in `full` mode where it has no effect.
**Why it happens:** Only `initial-plan-recursive` auto-approves spawned nodes.
**How to avoid:** Gate on `approvalMode === "initial-plan-recursive" && status === "running"`.
**Warning signs:** API succeeds but UX confusion; no change in approval behavior.

### Pitfall 4: CLI ask without Ollama host configured
**What goes wrong:** Silent failure or queue model stub responses in CI/dev.
**Why it happens:** `default_queue_models()` returns canned JSON when no Ollama host `[VERIFIED: control_server/mod.rs:219]`.
**How to avoid:** Detect missing host; exit non-zero with actionable message (like current stub, but after real attempt).
**Warning signs:** `rlm ask` returns planner JSON instead of natural language answer.

### Pitfall 5: PERS-03 scope creep
**What goes wrong:** Attempting full session replay/resume across process restarts when neither TS nor Rust supports it.
**Why it happens:** Store schema suggests full checkpoint/resume; orchestrators only write node statuses.
**How to avoid:** Wave 4 delivers cursor at graph-executor granularity + written gap doc; defer cross-session resume.
**Warning signs:** Plan tasks referencing TS cursor behavior that doesn't exist in `src/domain/run-state-persistence.ts`.

## Code Examples

### TS MCP initialize sequence (port target)
```typescript
// Source: src/runtime/interop/interop-runtime.ts
await this.request("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "rlm", version: "1.0.0" },
});
this.notify("notifications/initialized", {});
```

### Rust run-state node status (existing — extend from here)
```rust
// Source: crates/rlm-core/src/domain/run_state_persistence.rs
pub fn persist_node_status(&self, node_id: &str, status: &str) -> std::io::Result<()> {
    // CAS retry loop via store.mutate on path nodeStatuses.{nodeId}
}
```

### Suggested resume cursor shape (new — discretion)
```rust
// Proposed for graph executor — not in TS today
pub fn persist_resume_cursor(&self, cursor: &ResumeCursor) -> std::io::Result<()> {
    // path: resumeCursor, value: { "activeNodeId": "...", "orderIndex": 3, "variant": "playbook" }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Node-only MCP stub in Rust | Port TS stdio client | Phase 1 Wave 2 | MCP tools available on default Rust path |
| Monolith `ui/src/main.tsx` controls | `TopBar.tsx` shell | Phase 61 | Pause control dropped — restore in TopBar |
| `RLM_RUNTIME=node` default | Keep until CLI proven | v1.8 migration | Escape hatch remains valid |
| Run-state schema-only cursor | Executor writes cursor | Phase 1 Wave 4 | Enables future resume; TS still gap |

**Deprecated/outdated:**
- Comment in `runtime.rs`: "full client deferred to post-v1.8 (INFR-02)" — superseded by Phase 1 PLUG-03 scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hand-porting TS MCP client is preferred over rmcp for parity | Standard Stack | Extra maintenance if protocol evolves; rmcp may be faster to integrate |
| A2 | TS `RunStatePersistence` does not write resumeCursor/checkpoints | Summary / Pitfall 5 | If TS has other write paths, PERS-03 parity target shifts |
| A3 | Skill tool (`createSkillTool`) is out of PLUG-03 scope | Architecture | Users with skill-only interop config get no skill tool until follow-on |
| A4 | HF search `entry.id` is valid `repo_id` for download body | Pattern 5 | Download fails if id format differs from HF API expectation |

## Open Questions (RESOLVED)

1. **Should Rust pause route return 409 for terminal sessions like TS?** → **RESOLVED: Yes.** Match TS 409 on terminal sessions in plan 01-01 Task 1 alongside TopBar wiring (low cost; UI may rely on error shape).

2. **CLI workflow: graph sidecar only or YAML config workflows too?** → **RESOLVED: Ask-first staging.** Plan 01-04 ships `rlm ask` on Rust path; workflow remains Node-only via `RLM_RUNTIME=node` with actionable error. Graph sidecar workflow is stretch goal only — YAML config workflows deferred to post-phase. Session CLI execution explicitly deferred (same Node fallback).

3. **PERS-03 minimum viable cursor fields?** → **RESOLVED: `{ activeNodeId, completedNodeIds, variant }`.** Plan 01-05 persists these at executor checkpoints into `resumeCursor`; document that no reload consumer exists yet (shared TS/Rust gap).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | UI build, npm test | ✓ | v20.18.2 | — |
| Rust/cargo | rlm-core, rlm-cli | ✓ | 1.94.0 | — |
| Ollama | CLI ask integration, model library | ✗ (not probed running) | — | QueueModel stub in tests; skip live ask in CI |
| MCP server binary | MCP integration tests | ✗ | — | Mock stdio server script (mirror TS tests) |
| Hugging Face API | HF download/search | network | — | Existing reqwest client; mock in unit tests |

**Missing dependencies with no fallback:**
- None for Wave 1 UI (pure frontend)

**Missing dependencies with fallback:**
- Ollama — use `QueueModel` / fixture configs for automated tests; document manual REG-01 with live Ollama
- MCP server — spawn echo/mock process in `crates/rlm-core/tests/mcp_stdio.rs`

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Rust: `cargo test --workspace`; TS/Node: `node --test dist/tests` |
| Config file | `Cargo.toml` workspace; `package.json` scripts |
| Quick run command | `cargo test -p rlm-core` |
| Full suite command | `npm run check:rust && npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGN-02 | Pause API sets autoApprovalPaused | integration | `cargo test -p rlm-core pause` | ❌ Wave 0 — add session route test |
| MDLH-03 | HF download route accepts repo_id | integration | `cargo test -p rlm-core model_library` | ✅ partial (`model_library_routes.rs`) |
| PLUG-03 | MCP tools register on runtime context | integration | `cargo test -p rlm-core mcp_stdio` | ❌ Wave 0 — port TS mock server pattern |
| CLI-01 | `rlm ask` runs engine (not stub) | integration | `cargo test -p rlm-cli ask` | ❌ Wave 0 |
| PERS-03 | resumeCursor mutation accepted | unit | `cargo test -p rlm-core run_state_persistence` | ❌ Wave 0 — extend existing test |
| REG-01 | UI workflow UAT | manual | `61-06-VERIFICATION.md` checklist | ✅ exists |

### Sampling Rate
- **Per task commit:** `cargo test -p rlm-core <focused>` + `npm run build:ui` for UI tasks
- **Per wave merge:** `npm run check:rust`
- **Phase gate:** `npm run check:parity` + REG-01 operator sign-off

### Wave 0 Gaps
- [ ] `crates/rlm-core/tests/mcp_stdio.rs` — mock MCP server, tool registration
- [ ] `crates/rlm-core/tests/pause_auto_approvals.rs` — route + snapshot field
- [ ] `crates/rlm-cli/tests/ask_smoke.rs` — non-stub exit code
- [ ] `crates/rlm-core/src/domain/run_state_persistence.rs` — cursor persist test
- [ ] UI: no vitest/jest — REG-01 remains manual; optional `npm run lint -- ui/src`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | partial | Run-state capability tokens on mutations |
| V5 Input Validation | yes | HF repo_id/file validation; modal prompt sanitization; MCP JSON schema |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| MCP subprocess command injection | Elevation | Use config `command` + `args` array only; no shell interpolation (match TS `spawn` without shell) |
| HF path traversal in downloads | Tampering | Existing `validate_safe_filename` in hf_registry.rs |
| Run-state mutation without token | Spoofing | `FileRunStateStore.authorize` capability token check |
| XSS via graph modal prompts | Tampering | React text nodes; no `dangerouslySetInnerHTML` |

## Recommended Plan Structure (Waves)

### Wave 1 — UI regressions + REG-01 (2 plans)

**01-01-PLAN.md — UI wiring + visual fixes**
- TopBar: pause-auto-approvals button + Run button class (`.btn-run-primary` not `.icon`)
- `styles.css`: define `.secondary` (outline/neutral per 61-UI-REVIEW)
- `ModelLibraryRow`: HF → `/api/model-library/download`
- `NodeContextMenu` + `GraphActionModal`: replace browser dialogs
- `ExecutionNodeCard`: fix stale "click Plan children" copy
- Verify: `npm run build:ui`, `npm run lint -- ui/src`

**01-02-PLAN.md — REG-01 human UAT**
- Execute `61-06-VERIFICATION.md` checklist on Rust-served UI
- Include session save/reopen, HF download, pause control
- Update verification doc status to operator-signed or file gaps
- Checkpoint: human `approved` signal

### Wave 2 — MCP client (1 plan)

**01-03-PLAN.md — Rust MCP stdio client**
- Add `crates/rlm-core/src/interop/` with TS port
- Wire `build_runtime_context` to load `interop.mcp.servers` from config
- Register `{serverId}.{toolName}` on `ExtensionHost`
- Required server failure policy (fail init vs continue)
- Doctor/interop warning when servers configured but connection failed
- Tests: `mcp_stdio.rs` mirroring TS interoperability tests
- Verify: `cargo test -p rlm-core mcp`

### Wave 3 — CLI parity (1 plan, ask-first)

**01-04-PLAN.md — Rust CLI ask (+ staged workflow)**
- Extract bootstrap helper from control-server patterns
- Implement `commands/ask.rs` using `RecursiveLanguageModel::run`
- JSON/text output parity with TS `renderResult`
- Optional stretch: `workflow` subcommand loading graph sidecar
- Keep `RLM_RUNTIME=node` documented; update stub message
- Tests: ask smoke with `QueueModel` fixture
- Verify: `cargo test -p rlm-cli`

### Wave 4 — Run-state resume (1 plan)

**01-05-PLAN.md — Run-state cursor extension**
- Add `persist_resume_cursor` / checkpoint hooks in `GraphExecutor`
- Extend `RunStatePersistence` with retry CAS (mirror node status pattern)
- Write `PERS-03-GAP.md` documenting TS+Rust shared limitations
- Integration test: executor writes cursor + node statuses
- Verify: `cargo test -p rlm-core run_state`

**Parallelization:** Waves 1→2→3→4 sequential per CONTEXT; within Wave 1, UI tasks can parallelize (TopBar/HF/modals/CSS).

## Sources

### Primary (HIGH confidence)
- `src/runtime/interop/interop-runtime.ts` — MCP stdio client reference implementation
- `crates/rlm-core/src/plugins/runtime.rs` — interop stub location
- `crates/rlm-core/src/control_server/mod.rs` — CLI bootstrap patterns
- `crates/rlm-core/src/domain/run_state_persistence.ts` / `.rs` — persistence parity baseline
- `.planning/milestones/v1.8-phases/61-ui-shell-rewrite/61-UI-REVIEW.md` — UI priority fixes
- [docs.rs/rmcp/1.7.0](https://docs.rs/rmcp/latest/rmcp/) — official MCP Rust SDK (alternative)

### Secondary (MEDIUM confidence)
- [rmcp GitHub README](https://github.com/modelcontextprotocol/rust-sdk) — TokioChildProcess client example
- `.planning/milestones/v1.8-MILESTONE-AUDIT.md` — requirement partial statuses

### Tertiary (LOW confidence)
- None asserted without codebase verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against Cargo.toml, package.json, existing adapters
- Architecture: HIGH — all entry points traced in source
- Pitfalls: HIGH — regressions documented in milestone audit with file/line evidence
- PERS-03 TS parity: MEDIUM — verified TS only writes nodeStatuses; audit wording may overstate TS cursor support

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (30 days — stable Rust/UI stack)
