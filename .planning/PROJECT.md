# Recursive Language Model CLI

## Current State

**Latest shipped milestone:** v1.9 — Rust Runtime Hardening (2026-05-22)  
**Current milestone:** v1.10 — v1.9 Debt Closure (planning)  
**Audit status:** v1.9 closed as tech_debt — 17/18 requirements; this milestone closes documented deferrals

v1.9 closed all v1.8 functional debt and hardened the Rust workspace to match the TypeScript concern map. Wave 1 delivered UI regression fixes, full quality loop parity, cross-session resume via `RunStateStorePort`, skill interop, full CLI parity, and PACK-03 CI smoke. Wave 2 applied application layer grouping, control-server handler split, large-file decomposition, Rust boundary enforcement (`check-rust-boundaries`), and evaluated defer on optional crate split (7s clean build, 8s lib tests — no split). Combined gates green at close: `npm run check`, `npm run check:rust`, `cargo test --workspace`.

v1.8 shipped a Rust-only runtime (`rlm-core`, `rlm-cli`) embedded in Tauri with no bundled Node. The Axum control server preserves the existing HTTP/SSE contract; persistence, recursive engine, graph executor, vector index, model library, plugins, and CLI parity CI all run in Rust. Phase 61 rewrote the UI shell to a canvas-first AppShell (GraphCanvas, slim Run panel, Advanced hub). **471+** TypeScript tests and **67+** Rust integration tests green; ~15k LOC Rust workspace.

<details>
<summary>Prior milestone context (v1.0–v1.7)</summary>

v1.7 shipped concern-first taxonomy and full plugin manager UX: ARCH-02 boundary fixes and `ExtensionHostPort`; composition and interop wiring under `src/runtime/`; `application/` grouped by execution/graph/memory/plugins/control-server; unified plugin manifest schema with builtin migration to `src/plugins/builtin/`; canonical concern map in AGENTS.md with mirrored tests and strict dependency-cruiser enforcement; shared `PluginRegistryService` for CLI and control-server; remote HTTPS/git fetch-to-local install; UI plugin panel with CLI-aligned vocabulary. Milestone audit: 38/38 requirements.

v1.6 shipped behavior-preserving structural hardening: ESLint/Prettier/dependency-cruiser baselines; focused `application/config/` modules; `buildRuntimeContext()` bootstrap; adapters grouped under `adapters/tools|persistence|models/`; `domain/recursion/` concern modules; control-server HTTP handlers colocated by surface; subsystem-aligned tests. Milestone audit: 40/40 requirements; **359** tests at v1.6 close.

v1.5 shipped graph-primary authoring: model-driven plan-from-node, protected replan, planner-assigned expert teams, shared GraphExecutor, lossless `kind: graph` workflow sidecars, UI/CLI/session integration hardening.

v1.4 shipped durable session memory: saved session bundles, structured memory scopes, preference persistence, local semantic retrieval, Phase 29.1 integration hardening.

v1.3 shipped desktop product foundation: Tauri shell, model library, release staging, Ollama readiness, Linux `.deb` packaging.

</details>

## What This Is

A local recursive language model CLI and desktop app for developers. It accepts a prompt, plans a typed node graph for recursive execution via model-driven plan-from-node, lets users review and modify that graph through direct node controls (with optional chat refinement), binds planner-assigned expert presets per node, and executes approved topology through a shared graph executor — with visible execution state, explicit model routing, replayable graph workflow sidecars, artifact/run-state continuity, and hard stops for approvals or clarification. **v1.8:** the orchestration runtime is Rust (`rlm-core`); the React/Vite UI runs in Tauri against the Rust Axum control server.

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

### Active

(None yet — v1.10 requirements in `.planning/REQUIREMENTS.md`)

## Current Milestone: v1.10 v1.9 Debt Closure

**Goal:** Close all documented v1.9 tech debt so REG-01 is fully satisfied and resume/skill/packaging/boundary deferrals are resolved or explicitly ratcheted.

**Target features:**
- REG-01 human UAT sign-off on Rust-served UI (61-06 checklist)
- UI resume control wired to `POST /api/chat/resume-run` with confirm gate
- TS graph executor `persistResumeCursor` at node transitions
- HTTP integration test for resume-run confirm gate
- Skill interop depth: SKILL_PARSE_ERROR lifecycle events; ManifestSkillLoader async load
- `test:packaging` in default `npm test` gate
- Architecture hygiene: 71-DECISION.md refresh, baseline script fix, boundary debt documented or reduced
- Stale v1.9 wave todos archived

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

The repository has a layered TypeScript architecture (`src/application`, `src/domain`, `src/ports`, `src/adapters`), a React/Vite UI in `ui/`, a Tauri shell under `src-tauri/`, and a Rust workspace under `crates/` (`rlm-core` ~15k LOC). **Production desktop uses Rust-only runtime** — Tauri embeds the Axum control server in-process; Node is no longer bundled. TypeScript remains for UI, tooling, and strangler parity tests (`RLM_RUNTIME=node|rust`).

Primary verification: `npm run check` (TypeScript/UI) plus `npm run check:rust` (fmt, clippy, boundary check, test). **471+** TS tests and **67+** Rust integration tests at v1.9 close. Rust workspace has `application/`, decomposed handlers, and boundary enforcement matching TypeScript depcruise rules.

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
| Rust runtime replaces Node for orchestration via HTTP/SSE strangler | Remove bundled Node; UI stays TS/React | ✓ Good — v1.8; v1.9 closed partial ports |
| Ollama remains default inference host during Rust migration | Avoid day-one llama.cpp bundling | ✓ Good — v1.8 |
| Canvas-first UI shell (Phase 61) preserves HTTP/SSE contract | Frontend restructure only; Rust backend unchanged | ✓ Good — v1.8/v1.9 |
| v1.9 Wave 1 before Wave 2 structural cleanup | Close functional debt before architecture refactors | ✓ Good — v1.9 |
| ARCH-06 evaluated defer over mandatory crate split | Measured compile iteration acceptable (7s/8s) | ✓ Good — v1.9 |
| Rust boundary check baseline mode with strict opt-in | Transitional arcs documented; ratchet path preserved | ✓ Good — v1.9 |
| Fine-tuning / LoRA explicitly out of scope | Compute and ecosystem cost | — Deferred |

## Next Milestone Goals

v1.10 in progress — see Current Milestone above. After close, candidate themes:

- Product shell convergence: guided composer, session launcher, graph workspace as primary surface (`ui-shell-architecture.md`)
- Managed llama.cpp runtime (INFR-01 seed)
- Release hardening: signed artifacts, Windows/macOS packages, auto-update channel

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-05-22 after v1.10 milestone start*
