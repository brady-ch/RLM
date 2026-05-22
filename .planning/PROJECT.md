# Recursive Language Model CLI

## Current Milestone: v1.7 Adapter & Plugin Taxonomy

**Goal:** Establish a concern-first project taxonomy — clearer separation across `src/`, `tests/`, and tooling — plus first-class plugin registration, boundary enforcement, and full plugin manager UX.

**Target features:**
- Concern taxonomy — group `application/` by domain (execution, graph, memory, plugins); introduce `runtime/` and `plugins/`; mirror layout in `tests/`; encode rules in dependency-cruiser + AGENTS.md
- Plugin vs adapter boundary — built-in tools as plugins; extension registration contracts clarified
- Dependency-cruiser enforcement — ratchet ARCH-02 boundary violations to error; fix import direction
- Runtime/interop split — composition and MCP/skill interop extracted from overloaded application modules
- First-class plugin taxonomy — tool categories, manifests, capability metadata
- Full plugin manager UX — CLI + UI panel; local-folder install/enable/list/doctor plus remote fetch-to-local

## Current State

**Latest shipped milestone:** v1.6 — Architecture Cleanup  
**Current milestone:** v1.7 — Adapter & Plugin Taxonomy  
**Status:** Defining requirements

v1.6 shipped behavior-preserving structural hardening: ESLint/Prettier/dependency-cruiser baselines with expanded `npm run check`; focused `application/config/` modules behind a stable `project-config` facade; `buildRuntimeContext()` bootstrap with slim `src/index.ts` and `cli/run-modes/*`; adapters grouped under `adapters/tools|persistence|models/`; `domain/recursion/` concern modules (budget, tool rounds, quality loop, execution-graph sync, prompts) with orchestrator retaining flow; control-server HTTP handlers colocated by surface with bootstrap-fed dependencies; subsystem-aligned tests under `tests/domain/recursion/` with shared helpers and refreshed `AGENTS.md`. Milestone audit: 40/40 requirements; `npm run check` green with **359** tests (per `v1.6-MILESTONE-AUDIT.md`).

v1.5 shipped graph-primary authoring: model-driven plan-from-node with root-composer default and explicit failure states, protected replan (Replace/Merge/Cancel), planner-assigned expert teams with visible overrides and execution-time allowlist enforcement, a shared GraphExecutor that walks approved topology, lossless `kind: graph` workflow sidecars (playbook and pipeline variants), and UI/CLI/session integration hardening with 205 passing tests.

v1.4 shipped durable session memory: saved session bundles with restore verification, structured memory scopes and episodic continuity, preference persistence and inspection surfaces, local semantic retrieval with visible degraded states, and Phase 29.1 integration hardening that binds live memory and vector state on save/reopen.

v1.3 shipped the desktop product foundation: runner adapter/sampling cascade metadata, model library, release staging with bundled Node runtime, Tauri shell configuration, native RLM child-process lifecycle management, Ollama readiness integration, Linux `.deb` build output, package smoke, and full test verification.

## What This Is

A local recursive language model CLI and UI workflow system for developers. It accepts a prompt, plans a typed node graph for recursive execution via model-driven plan-from-node, lets users review and modify that graph through direct node controls (with optional chat refinement), binds planner-assigned expert presets per node, and executes approved topology through a shared graph executor — with visible execution state, explicit model routing, replayable graph workflow sidecars, artifact/run-state continuity, and hard stops for approvals or clarification.

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
- ✓ Native desktop lifecycle starts packaged `rlm ui`, redirects the webview, checks Ollama readiness, and stops the managed RLM child on close — v1.3
- ✓ Durable session save/reopen preserves workflow graph state, memory scopes, episodic history, preferences, and vector index metadata — v1.4
- ✓ Structured memory scopes and episodic logs restore bounded node context deterministically — v1.4
- ✓ User/project preferences can be persisted, inspected, edited, and deleted — v1.4
- ✓ CLI and UI expose what memory is saved, restored, and injected into node context — v1.4
- ✓ Semantic/vector retrieval surfaces relevant prior memory with visible degraded states — v1.4
- ✓ Plan-from-node is the default graph authoring path (root-composer submit, model-driven child planning, replan with protected-state UX) — v1.5
- ✓ Approved graphs save/import as `kind: graph` workflow sidecars (playbook + pipeline variants) — v1.5
- ✓ Planner assigns expert presets per node with visible overrides and exportable assignment metadata — v1.5
- ✓ UI and CLI expose the same planning, export, and expert semantics with explicit failure states — v1.5
- ✓ Lint/format and dependency-cruise guardrails with aggregated `npm run check` — v1.6
- ✓ Config loading, validation, and resolution split under `application/config/` with unchanged public façade — v1.6
- ✓ Runtime composition centralized in `buildRuntimeContext()`; CLI dispatches built `RuntimeContext` from `cli/run-modes/*` — v1.6
- ✓ Tool, persistence, and model adapters grouped by concern; extension shims aligned — v1.6
- ✓ Recursive engine concern modules live under `domain/recursion/`; orchestrator retains top-level recursion — v1.6
- ✓ Control-server routes grouped under `handlers/` with transport-only boundaries — v1.6
- ✓ Tests mirror subsystem layout with shared helpers; contributor map updated in AGENTS.md — v1.6

### Active

_Requirements for v1.7 are being defined — see `.planning/REQUIREMENTS.md` once generated._

### Candidate Future-Milestone Themes

- Product shell convergence: guided composer for first-run/new-workflow, graph workspace as the primary surface, and project/session launcher for durable resume.
- Multi-runner adapters beyond bundled Ollama, including llama.cpp, vLLM, and cloud APIs.
- Release hardening beyond baseline Linux installer: signed/reproducible artifacts, Windows/macOS package builds, GUI clean-machine smoke, and auto-update channel.
- Developer launcher and local-folder plugin manager.

### Out of Scope

- Multi-user collaboration or shared remote approval sessions — still not required for repo-local developer workflow unless selected for a future milestone.
- Silent auto-fallback behavior — conflicts with explicit error visibility requirement.

## Context

The repository has a layered TypeScript architecture (`src/application`, `src/domain`, `src/ports`, `src/adapters`), a React/Vite UI execution surface in `ui/`, and a Tauri shell under `src-tauri/`. The product path remains local-first and observable.

v1.6 reduced hotspot file size and clarified module ownership without changing CLI/UI/session/graph semantics; primary verification remains `npm run check` (typecheck, lint, format check, dependency-cruise baseline, full test run). **359** tests passing at milestone close per audit.

v1.5 established graph-primary authoring: plan-from-node replaces keyword heuristics and chat-first pre-run flow; expert teams bind at plan time with execution-time allowlist enforcement; approved graphs export as replayable sidecars and execute through a shared GraphExecutor.

## Constraints

- **Tech stack:** Continue using TypeScript/Node + existing React/Vite UI architecture.
- **Runtime mode:** Keep recursive agent behavior and dynamic node spawning.
- **Observability:** No silent failures — all errors must surface in CLI/UI states.
- **Compatibility:** Preserve existing CLI workflows (`--plan-only`, `--require-approval`, workflow execution).
- **Local-first workflow:** Project-local config and repo-local developer use remain the default unless a future milestone explicitly broadens deployment scope.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Approval checkpoints allow edit/delete/add actions before continuing | Needed for human-in-the-loop control over recursive execution plans | ✓ Good — v1.0 |
| Built-in tools load through first-party extension shims | Keeps core composition aligned with third-party extension contracts | ✓ Good — v1.1 |
| Quality loops remain collapsed top-level graph nodes with inspectable internal history | Preserves graph readability while exposing loop internals where users need them | ✓ Good — v1.2 |
| v1.3 manages Ollama only while preserving adapter boundaries | Keeps the first desktop product installable and testable without multiplying runner lifecycle complexity | ✓ Good — v1.3 |
| Sampling configuration resolves by cascade: global → model → node | Gives simple defaults and precise per-node control while preserving auditability | ✓ Good — v1.3 |
| Desktop app starts packaged `rlm ui` as a managed child rather than duplicating the control server in Rust | Preserves the existing TypeScript control-server behavior while giving Tauri ownership of native process lifecycle | ✓ Good — v1.3 |
| Session memory prioritizes durability and explicit restore semantics over retrieval cleverness | User explicitly wants all memory surfaces and does not want anything to get lost | ✓ Good — v1.4 |
| Graph-primary authoring replaces chat-first pre-run flow | Users describe work on the canvas; plan-from-node is the default path | ✓ Good — v1.5 |
| Expert team v1 uses shared tools with per-node allowlists | Keeps extension stack unified; specialized tool surfaces deferred until measured failures | ✓ Good — v1.5 |
| Graph export uses lossless `kind: graph` sidecars with playbook/pipeline variants | Bridges dynamic authoring to replayable workflows without replan-by-default | ✓ Good — v1.5 |
| v1.6 uses strangler extractions behind stable façades (`project-config`, `RuntimeContext`) | Avoids flag-day breakage while shrinking hotspots (`index.ts`, RLM orchestrator, control server) | ✓ Good — v1.6 |
| Dependency-cruiser starts at WARN with a ratcheting baseline | Unblocks incremental boundary cleanup (`ARCH-02`) without stalling refactor phases | ⚠️ Revisit — ratchet toward error as violations clear |
| Product shell uses guided composer → graph workspace → launcher/resume | First-run should still be "say what I want," while the graph remains the durable executable product surface | — Pending future milestone |
| v1.7 treats plugins as registration/distribution packages distinct from core adapters | Avoids `adapters/` becoming a mixed grab bag as tools and extensions grow; enables auditable capability taxonomy | — Pending v1.7 |
| Built-in tools migrate to `plugins/builtin/` taxonomy before external plugin APIs harden | Responsibility extraction precedes directory moves per architecture-boundary-cleanup direction | — Pending v1.7 |
| Full plugin manager includes local-folder and remote fetch-to-local flows | Users install plugins without marketplace or remote execution; fetched plugins become local after download | — Pending v1.7 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-05-22 — Milestone v1.7 Adapter & Plugin Taxonomy started*
