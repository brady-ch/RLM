# Phase 1: Close v1.8 tech debt — UI regressions, MCP client, CLI parity, run-state resume - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Mode:** Auto-generated from v1.8 milestone audit + STATE.md deferred items

<domain>
## Phase Boundary

Close the 6 partial v1.8 requirements and acknowledged tech debt left at milestone archive. Work spans UI polish/regressions, Rust MCP client parity, Rust CLI execution modes, and run-state checkpoint resume — without reopening the shipped Rust runtime migration scope.

**In scope:**
- REG-01 operator sign-off path (human UAT checklist for Phase 61 shell on Rust-served UI)
- ENGN-02 UI regression: restore `pause-future-auto-approvals` in TopBar (API exists in Rust)
- MDLH-03 UI regression: wire HF model install to `POST /api/model-library/download`
- PLUG-03: port MCP stdio client from TS `src/runtime/interop/` to Rust `rlm-core` (replace stub in `plugins/runtime.rs`)
- CLI-01: port `ask` / `workflow` / session CLI execution to Rust (remove Node-only stubs where feasible)
- PERS-03: extend run-state from minimal node-status snapshots to checkpoint/resume cursor parity with TS orchestrator (document remaining gaps if full parity exceeds phase)
- Phase 61 UI-REVIEW priority fixes: `.secondary` button styles, replace `window.prompt`/`confirm` with in-app modals for graph mutations

**Out of scope (defer to later milestone unless trivial):**
- PACK-03 `.deb` smoke on headless CI (GTK/dbus) — document only unless cheap fix exists
- Full quality-loop behavioral parity with TS (Phase 54 simplification) — spike/doc only
- Nyquist VALIDATION.md retroactive fill for phases 52–61
- WASM/subprocess bridge for external ESM plugins (INFR-02 beyond MCP client)
- Command palette (⌘K) — deferred from Phase 61

</domain>

<decisions>
## Implementation Decisions

### Priority ordering
1. **Wave 1 — UI regressions + UAT** (fast wins, unblocks REG-01): pause-auto-approvals, HF download wiring, UI-REVIEW top fixes, REG-01 checklist
2. **Wave 2 — MCP client** (Rust stdio JSON-RPC, port TS behavior; doctor warning when configured but disconnected)
3. **Wave 3 — CLI parity** (Rust `ask`/`workflow` at minimum; keep `RLM_RUNTIME=node` escape hatch until parity proven)
4. **Wave 4 — Run-state resume** (extend beyond minimal `persist_node_status`; align with TS `RunStatePersistence` cursor semantics)

### MCP architecture
- RLM remains an **MCP client** (not server) — subprocess stdio to configured `interop.mcp.servers`
- MCP is complementary to native Rust plugins; do not conflate with plugin registry
- Replace no-op `record("interop")` stub with real tool registration on `ExtensionHost`

### MCP vs plugins
- Native plugins: first-party + installable via registry
- MCP: bridge to external MCP ecosystem without Rust ports

### Claude's Discretion
- Exact plan split (number of PLAN.md files) and wave boundaries
- Whether CLI-01 ships full workflow parity or staged ask-first
- How much run-state resume to implement vs document as remaining debt

</decisions>

<code_context>
## Existing Code Insights

### TS reference (MCP — working)
- `src/runtime/interop/interop-runtime.ts` — `createMcpTools`, `StdioMcpClient` framed JSON-RPC
- `src/runtime/interop/mcp-skill-runtime.ts` — disconnect/reconnect events, skill loading
- `tests/runtime/interop/mcp-skill-interoperability.test.ts`

### Rust stub (broken on default path)
- `crates/rlm-core/src/plugins/runtime.rs` — interop stage recorded, no MCP tools loaded
- Config: `interop.mcp.servers` in `crates/rlm-core/src/persistence/config.rs`

### UI regressions (Phase 61)
- `ui/src/app/TopBar.tsx` — missing pause-auto-approvals
- `ui/src/advanced/ModelsView.tsx` — HF install gated on curated only
- `ui/src/nodes/NodeContextMenu.tsx` — uses `window.prompt`/`confirm`
- `.planning/milestones/v1.8-phases/61-ui-shell-rewrite/61-UI-REVIEW.md` — 16/24 score, top 3 fixes listed
- `.planning/milestones/v1.8-phases/61-ui-shell-rewrite/61-06-VERIFICATION.md` — REG-01 human checklist

### CLI stubs
- `crates/rlm-cli/src/commands/ask.rs` — Node fallback documented
- TS: `src/index.ts` + run-modes for ask/workflow

### Run-state
- `crates/rlm-core/src/persistence/run_state_store.rs` — FileRunStateStore
- Phase 60.1 wired minimal persist during graph execution
- TS: `src/domain/run-state-persistence.ts` (reference for cursor/resume semantics)

### Audit source
- `.planning/milestones/v1.8-MILESTONE-AUDIT.md` — status tech_debt, 6 partial reqs
- `.planning/STATE.md` — Deferred Items table

</code_context>

<specifics>
## Specific Ideas

- Port MCP by mirroring TS stdio framing (Content-Length headers) — do not invent new protocol
- Doctor/plugins panel should surface "MCP configured but Rust client not connected" until Wave 2 lands
- REG-01 UAT plan should include session save/reopen on Rust path (routes fixed in 60.1)

</specifics>

<deferred>
## Deferred Ideas

- External ESM plugin WASM/subprocess bridge (INFR-02 beyond MCP)
- Command palette
- Full quality-loop TS behavioral parity
- PACK-03 headless `.deb` smoke unless trivial CI fix

</deferred>
