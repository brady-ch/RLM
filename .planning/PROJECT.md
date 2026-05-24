# Recursive Language Model CLI

## Current State

**Latest shipped milestone:** v1.18 — Node Runtime Retirement (2026-05-24)  
**Requirements:** 33/33 satisfied (from PLAN/SUMMARY frontmatter; no REQUIREMENTS.md at close)  
**Audit status:** tech_debt accepted — `.planning/milestones/v1.18-MILESTONE-AUDIT.md`

v1.18 delivered full TypeScript runtime retirement: entire `src/` tree deleted, `npm rlm` dispatches exclusively to Rust CLI, Tauri embeds Axum control server in-process, Vite dev proxy targets Rust APIs, npm toolchain is UI-only (`npm run check` = lint/format + `check:rust`), and Phase 120 constrained Ollama tool envelope (`useToolEnvelope`) wired through config → adapter → tool_round_loop. Process debt accepted: 6/8 phases lack formal VERIFICATION.md; Nyquist validation artifacts absent.

**Prior shipped:** v1.17 Rust Infrastructure Layer (2026-05-24); v1.16 Application Memory & Config; v1.15 Application Layer Architecture; v1.14 Rust Architecture & Test Layout (2026-05-23–24); v1.13 Runtime Safety & WSL Hardening (2026-05-24).

<details>
<summary>Prior milestone context (v1.0–v1.16)</summary>

**v1.16** split `ram_guard.rs`, extracted memory block inline tests, zero inline tests in `src/application/`. **v1.15** split graph executor into execution_order/run_state_sync/executor with mirrored application tests. **v1.14** extracted domain/recursion inline tests to mirrored tree with `#[path]` stub pattern.

**v1.13** delivered end-to-end memory guardrails: live Ollama `/api/ps` in Rust and TypeScript guards, config validation, WSL auto cap, single-run concurrency (409), stop-triggered model unload, UI `resourceGuard` with budget panel, WSL operator runbook, and agent-safe verification (`test:reg03:preflight`).

**v1.12** delivered theme system (light/dark/system), high-contrast edges, dot-grid canvas, light node cards, Radix context menu, initial RAM guards (`ram_guard.rs`), and workflow overview/run-control fixes. REG-02 visual UAT checklist archived unsigned.

**v1.11** REG-01 operator browser UAT signed; shell architecture, first-run launcher, workflow overview, model RAM guards.

v1.7 shipped concern-first taxonomy and full plugin manager UX: ARCH-02 boundary fixes and `ExtensionHostPort`; composition and interop wiring under `src/runtime/`; `application/` grouped by execution/graph/memory/plugins/control-server; unified plugin manifest schema with builtin migration to `src/plugins/builtin/`; canonical concern map in AGENTS.md with mirrored tests and strict dependency-cruiser enforcement; shared `PluginRegistryService` for CLI and control-server; remote HTTPS/git fetch-to-local install; UI plugin panel with CLI-aligned vocabulary. Milestone audit: 38/38 requirements.

v1.6 shipped behavior-preserving structural hardening: ESLint/Prettier/dependency-cruiser baselines; focused `application/config/` modules; `buildRuntimeContext()` bootstrap; adapters grouped under `adapters/tools|persistence|models/`; `domain/recursion/` concern modules; control-server HTTP handlers colocated by surface; subsystem-aligned tests. Milestone audit: 40/40 requirements; **359** tests at v1.6 close.

v1.5 shipped graph-primary authoring: model-driven plan-from-node, protected replan, planner-assigned expert teams, shared GraphExecutor, lossless `kind: graph` workflow sidecars, UI/CLI/session integration hardening.

v1.4 shipped durable session memory: saved session bundles, structured memory scopes, preference persistence, local semantic retrieval, Phase 29.1 integration hardening.

v1.3 shipped desktop product foundation: Tauri shell, model library, release staging, Ollama readiness, Linux `.deb` packaging.

</details>

## What This Is

A local recursive language model CLI and desktop app for developers. It accepts a prompt, plans a typed node graph for recursive execution via model-driven plan-from-node, lets users review and modify that graph through direct node controls (with optional chat refinement), binds planner-assigned expert presets per node, and executes approved topology through a shared graph executor — with visible execution state, explicit model routing, replayable graph workflow sidecars, artifact/run-state continuity, and hard stops for approvals or clarification. **Production runtime is Rust-only** (`rlm-core` + `rlm-cli`); the React/Vite UI runs in Tauri against the Rust Axum control server.

## Core Value

Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## Requirements

### Validated

- ✓ CLI prompt execution and recursive orchestration engine exist — existing
- ✓ Interactive execution graph and node inspection UI plumbing exist — existing
- ✓ Config-driven model tier routing and agent/workflow configuration exist — existing
- ✓ Tool adapters for shell, file write, web search, and web fetch exist — existing
- ✓ User can submit a prompt and receive a planning node graph before execution — v1.0
- ✓ Approval checkpoints are backend-authoritative with explicit stale/duplicate handling — v1.0
- ✓ Checkpoint graph mutations are controller-authoritative — v1.0
- ✓ Runtime failures are visible across UI/CLI with aligned vocabulary and non-zero CLI exit on failure — v1.0
- ✓ MCP and skill interoperability path is documented and implemented for reference layouts — v1.1
- ✓ Chat-first UI session can create and refine execution graphs through conversation — v1.1
- ✓ Extension/plugin path exists for registering tools, skills, and model host adapters — v1.1
- ✓ Runtime supports explicit clarification prompts and answer-or-abort continuation — v1.1
- ✓ Typed artifact schema and run-state continuity support long-running node workflows — v1.1
- ✓ Hybrid refinement loop nodes improve answer quality through inspectable, bounded draft/critique/refine/gate cycles — v1.2
- ✓ Adaptive rubrics evaluate loop candidates by prompt/task context and support best-of-progress final selection — v1.2
- ✓ Quality-loop model routing and overrides are visible and strict per loop phase — v1.2
- ✓ Desktop release staging and Tauri shell packaging path exist — v1.3
- ✓ Runner registry and sampling cascade expose effective global/model/node values — v1.3
- ✓ Model library supports curated recommendations, Hugging Face search, download progress, and installed model selection — v1.3
- ✓ Native desktop lifecycle starts packaged `rlm ui`, redirects the webview, checks Ollama readiness, and stops the managed RLM child on close — v1.3 (superseded by in-process Rust in v1.8)
- ✓ Durable session save/reopen preserves workflow graph state, memory scopes, episodic history, preferences, and vector index metadata — v1.4
- ✓ Structured memory scopes and episodic logs restore bounded node context deterministically — v1.4
- ✓ User/project preferences can be persisted, inspected, edited, and deleted — v1.4
- ✓ CLI and UI expose what memory is saved, restored, and injected into node context — v1.4
- ✓ Semantic/vector retrieval surfaces relevant prior memory with visible degraded states — v1.4
- ✓ Plan-from-node is the default graph authoring path — v1.5
- ✓ Approved graphs save/import as `kind: graph` workflow sidecars — v1.5
- ✓ Planner assigns expert presets per node with visible overrides and exportable assignment metadata — v1.5
- ✓ UI and CLI expose the same planning, export, and expert semantics with explicit failure states — v1.5
- ✓ Lint/format and dependency-cruise guardrails with aggregated `npm run check` — v1.6
- ✓ Config loading, validation, and resolution split under `application/config/` — v1.6
- ✓ Runtime composition centralized in `buildRuntimeContext()` — v1.6
- ✓ Tool, persistence, and model adapters grouped by concern — v1.6
- ✓ Recursive engine concern modules live under `domain/recursion/` — v1.6
- ✓ Control-server routes grouped under `handlers/` with transport-only boundaries — v1.6
- ✓ Tests mirror subsystem layout with shared helpers — v1.6
- ✓ ARCH-02 boundary violations fixed; `ExtensionHostPort` decouples plugin registration — v1.7
- ✓ Composition and interop wiring live under `src/runtime/` — v1.7
- ✓ `application/` grouped by execution, graph, memory, plugins, control-server — v1.7
- ✓ Unified plugin manifest schema, PluginLoader discovery, builtin tools in `plugins/builtin/` — v1.7
- ✓ Canonical concern map in AGENTS.md; tests mirror layout; dependency-cruiser at error severity — v1.7
- ✓ Local plugin manager CLI with shared `PluginRegistryService` — v1.7
- ✓ Remote HTTPS/git fetch-to-local plugin install with zip-slip defenses — v1.7
- ✓ UI plugin panel aligned with CLI semantics — v1.7
- ✓ Cargo workspace (`rlm-core`, `rlm-cli`) with Axum control server preserving HTTP/SSE contract — v1.8
- ✓ Rust file stores and config loader read Node-written `.rlm/` data losslessly — v1.8
- ✓ Recursive engine and ExecutionController run in Rust with SSE execution events — v1.8
- ✓ GraphExecutor and node/graph API routes power interactive authoring and execution — v1.8
- ✓ Rust ANN vector index with Ollama embeddings replaces JSON linear scan — v1.8
- ✓ Ollama adapter and model library routes with v1.7 parity — v1.8
- ✓ Rust plugin system with builtin tools and registry service — v1.8
- ✓ Rust `rlm` binary with `RLM_RUNTIME` strangler switch and parity CI gate — v1.8 (partial: full ask/workflow/session CLI remains Node-only)
- ✓ Tauri embeds Rust control server in-process; release bundle ships without bundled Node — v1.8
- ✓ Canvas-first UI shell (AppShell, GraphCanvas, slim Run panel, Advanced hub) — v1.8
- ✓ UI regression fixes — pause-auto-approvals and HF download wiring restored (REG-01 automated; human UAT pending) — v1.9
- ✓ Rust quality loop matches TypeScript — full draft/critique/refine/gate/best-of with golden parity tests — v1.9
- ✓ Cross-session resume consumer via RunStateStorePort with confirm gate and integration test — v1.9
- ✓ Skill interop in Rust — discovery, path policies, `skill` tool, doctor warnings — v1.9
- ✓ Full Rust CLI parity — plan-node, workflow export/import, session/memory flags — v1.9
- ✓ Headless `.deb` CI smoke on ubuntu-latest with xvfb — v1.9
- ✓ Rust `application/` layer, handler split, large-file decomposition — v1.9
- ✓ Rust concern map in AGENTS.md and `check-rust-boundaries` in `npm run check:rust` — v1.9
- ✓ Optional crate split evaluated defer — compile iteration acceptable, no extraction — v1.9
- ✓ UI resume control — TopBar confirm gate → `POST /api/chat/resume-run`; session reflects resumed state — v1.10
- ✓ Resume-run HTTP integration test — reject without confirm; accept with confirm; skip completed nodes — v1.10
- ✓ TypeScript graph executor `persistResumeCursor` at node transitions — v1.10
- ✓ Rust `SKILL_PARSE_ERROR` structured lifecycle events on skill parse failure — v1.10
- ✓ `ManifestSkillLoader.load()` async declarative skill path discovery — v1.10
- ✓ `test:packaging` in default `npm test` gate — v1.10
- ✓ Architecture hygiene — 71-DECISION refresh, boundary ratchet table, wave todo archive — v1.10
- ✓ Canvas renders and interacts reliably on Rust-served UI — v1.11 Phase 77
- ✓ Tier assignment from installed Ollama models in Advanced → Models — v1.11 Phase 77
- ✓ Run/Stop and tier refresh reflect server state — v1.11 Phase 77
- ✓ UI server single-instance lock and `--stop`/`--replace` lifecycle — v1.11 Phase 77
- ✓ Shell architecture — domain panels in `advanced/*`, workflow vs Advanced boundaries, context menu Variant B — v1.11 Phases 78–79
- ✓ First-run launcher — guided composer and session picker — v1.11 Phase 80
- ✓ REG-01 operator browser UAT signed on Rust-served UI — v1.11 Phase 81
- ✓ Theme system, canvas visual polish, initial RAM guards — v1.12 Phases 82–85
- ✓ Memory budget enforcement with live Ollama ps, config validation, WSL auto cap, TS parity — v1.13
- ✓ Execution concurrency — single-run mutex, keep_alive ratchet, stop unload — v1.13
- ✓ UI memory visibility — live resourceGuard, budget panel, WSL runbook — v1.13
- ✓ REG-03 operator safety UAT signed (native Linux; WSL item 7 SKIP) — v1.13 Phase 89
- ✓ Domain recursion inline tests extracted to mirrored `tests/domain/recursion/` tree — v1.14
- ✓ Graph executor split into execution_order/run_state_sync/executor with application test mirror — v1.15
- ✓ Application-layer inline tests zeroed; RAM guard split into probe/budget/eligibility modules — v1.16
- ✓ Config loaders moved to `persistence/config/` facade; persistence owns config resolution — v1.17
- ✓ Inline tests extracted from persistence/adapters/plugins to mirrored `tests/` trees via `#[path]` stubs — v1.17
- ✓ Oversized infrastructure modules split (memory_store, run_state_store, session_store, ollama_language_model) — v1.17
- ✓ `ToolExecutionResult`, `AgentProfile`, `PluginRegistryConfig` consolidated under ports — v1.17
- ✓ Rust boundary baseline empty; strict `check-rust-boundaries.sh` passes — v1.17
- ✓ TypeScript runtime tree (`src/`) fully deleted; Rust-only orchestration — v1.18
- ✓ npm rlm dispatches exclusively to Rust CLI; Tauri in-process Axum server — v1.18
- ✓ npm toolchain UI-only; `npm run check` = lint/format + check:rust — v1.18
- ✓ Constrained Ollama tool envelope (`useToolEnvelope`) config-gated in Rust — v1.18

### Active

(No active requirements — v1.19 UI Product Simplification queued in ROADMAP.md)

### Recently Validated (v1.12)

- **THEME-01–03**, **EDGE-01–03**, **CANV-01–04**: UI canvas visual polish (phases 82–84)
- Initial RAM guard on Rust plan/run path (`8680496`)

### Candidate Future-Milestone Themes

- Product shell convergence: guided composer for first-run/new-workflow, graph workspace as primary surface, project/session launcher.
- Managed llama.cpp runtime (supervised process, GPU backends).
- Multi-runner adapters beyond Ollama (vLLM, cloud APIs).
- Release hardening: signed/reproducible artifacts, Windows/macOS packages, auto-update channel.

### Out of Scope

- Multi-user collaboration or shared remote approval sessions.
- Silent auto-fallback behavior — conflicts with explicit error visibility requirement.
- Fine-tuning / LoRA — deferred to separate milestone.

## Context

The repository is **Rust-only for orchestration** (`crates/rlm-core`, `crates/rlm-cli`) with a React/Vite UI in `ui/` and Tauri shell under `src-tauri/`. **Production desktop uses Rust-only runtime** — Tauri embeds the Axum control server in-process; no TypeScript runtime layers remain.

**v1.18 state:** Entire `src/` absent; npm toolchain is UI-only; primary verification: `npm run check` (lint/format + `check:rust`) and `npm run test:agent:verify:light`.

## Constraints

- **Tech stack:** TypeScript/React UI + Rust orchestration runtime (`rlm-core`); Ollama default inference host.
- **Runtime mode:** Recursive agent behavior and dynamic node spawning preserved.
- **Observability:** No silent failures — all errors surface in CLI/UI states.
- **Compatibility:** Preserve CLI workflows where ported; documented partial deferrals for Node-only modes.
- **Local-first workflow:** Project-local config and repo-local developer use remain default.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Approval checkpoints allow edit/delete/add actions before continuing | Human-in-the-loop control over recursive execution plans | ✓ Good — v1.0 |
| Built-in tools load through first-party extension shims | Keeps core composition aligned with third-party extension contracts | ✓ Good — v1.1 |
| Quality loops remain collapsed top-level graph nodes with inspectable internal history | Preserves graph readability while exposing loop internals | ✓ Good — v1.2 |
| v1.3 manages Ollama only while preserving adapter boundaries | First desktop product installable without multiplying runner lifecycle | ✓ Good — v1.3 |
| Sampling configuration resolves by cascade: global → model → node | Simple defaults and precise per-node control | ✓ Good — v1.3 |
| Desktop app starts packaged `rlm ui` as managed child | Preserved TS control-server while Tauri owned native lifecycle | ⚠️ Revisit — superseded by in-process Rust in v1.8 |
| Session memory prioritizes durability and explicit restore semantics | User wants all memory surfaces preserved | ✓ Good — v1.4 |
| Graph-primary authoring replaces chat-first pre-run flow | Users describe work on the canvas | ✓ Good — v1.5 |
| Expert team v1 uses shared tools with per-node allowlists | Keeps extension stack unified | ✓ Good — v1.5 |
| Graph export uses lossless `kind: graph` sidecars | Bridges dynamic authoring to replayable workflows | ✓ Good — v1.5 |
| v1.6 strangler extractions behind stable façades | Avoids flag-day breakage while shrinking hotspots | ✓ Good — v1.6 |
| Dependency-cruiser ratcheted to error with empty baseline | Strict boundary enforcement after v1.7 taxonomy | ✓ Good — v1.7 |
| v1.7 treats plugins as registration packages distinct from adapters | Enables auditable capability taxonomy | ✓ Good — v1.7 |
| Rust runtime replaces Node for orchestration via HTTP/SSE strangler | Remove bundled Node; UI stays TS/React | ✓ Good — v1.8; v1.18 completed full TS runtime deletion |
| Ollama remains default inference host during Rust migration | Avoid day-one llama.cpp bundling | ✓ Good — v1.8 |
| Canvas-first UI shell (Phase 61) preserves HTTP/SSE contract | Frontend restructure only; Rust backend unchanged | ✓ Good — v1.8/v1.9 |
| v1.9 Wave 1 before Wave 2 structural cleanup | Close functional debt before architecture refactors | ✓ Good — v1.9 |
| ARCH-06 evaluated defer over mandatory crate split | Measured compile iteration acceptable (7s/8s) | ✓ Good — v1.9 |
| Rust boundary check baseline mode with strict opt-in | Transitional arcs documented; ratchet path preserved | ✓ Good — v1.9/v1.10 |
| REG-01 operator UAT accepted as tech_debt at milestone close | Autonomous executor cannot substitute browser sign-off; automated gates green | ✓ Resolved — v1.11 operator signed `81-UAT.md` |
| Adaptive RAM gates for agent verification | Full chained preflight OOM'd on WSL/desktop during autonomous runs | ✓ Good — v1.13 `ram-gate.mjs` + sequential verify profiles |
| REG-03 WSL item 7 SKIP when operator not on WSL | Cannot verify WSL stability without WSL host | ✓ Accepted — D-05; items 1–6 signed on native Linux |
| Rust boundary baseline ratcheted to zero deferrals | Infrastructure layers must not depend upward | ✓ Good — v1.17 Phase 107 |
| Config resolution owned by persistence facade | Eliminate persistence→application baseline | ✓ Good — v1.17 Phase 97 |
| `#[path]` stub pattern for mirrored Rust tests | Private access without pub test hooks | ✓ Good — v1.14–v1.17 |
| v1.18 incremental TS layer deletion with per-phase gates | Avoid flag-day breakage during runtime cutover | ✓ Good — v1.18 Phases 113–119 |
| Constrained tool envelope via Ollama JSON Schema format (Option A) | Small-model tool calling reliability post-cutover | ✓ Good — v1.18 Phase 120; default off |
| Fine-tuning / LoRA explicitly out of scope | Compute and ecosystem cost | — Deferred |

## Next Milestone Goals

**v1.19 UI Product Simplification** (Phases 121–128): audit UI surfaces, prune Advanced hub, simplify workflow view, consolidate styles/tokens, decompose AppShell, lazy-load routes, operator UAT sign-off.

Queued after v1.19: v1.20 desktop/run outcome, v1.21 inference expansion, v1.22 agent primitives, v1.23 docs audit.

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-05-24 after v1.18 milestone archive*
