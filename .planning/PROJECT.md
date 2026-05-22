# Recursive Language Model CLI

## Current State

**Latest shipped milestone:** v1.4 - Session Memory  
**Current milestone:** v1.5 - Dynamic Graph Authoring  
**Status:** Defining requirements and roadmap

v1.4 shipped durable session memory: saved session bundles with restore verification, structured memory scopes and episodic continuity, preference persistence and inspection surfaces, local semantic retrieval with visible degraded states, and Phase 29.1 integration hardening that binds live memory and vector state on save/reopen.

v1.5 makes the graph the primary authoring surface: model-driven plan-from-node (replacing keyword heuristics and chat-first pre-run flow), graph workflow export/import (playbook and pipeline variants), and planner-assigned expert teams with visible overrides — with matching UI and CLI behavior.

v1.3 shipped the desktop product foundation: runner adapter/sampling cascade metadata, model library, release staging with bundled Node runtime, Tauri shell configuration, native RLM child-process lifecycle management, Ollama readiness integration, Linux `.deb` build output, package smoke, and full test verification.

## What This Is

A local recursive language model CLI and UI workflow system for developers in this repo. It accepts a prompt, plans a typed node graph for recursive execution, lets users review and modify that graph through chat and direct graph controls, and then runs the AI workflow with visible execution state, explicit model routing, artifact/run-state continuity, and hard stops for approvals or clarification.

## Core Value

Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## Requirements

### Validated

- ✓ CLI prompt execution and recursive orchestration engine exist - existing
- ✓ Interactive execution graph and node inspection UI plumbing exist - existing
- ✓ Config-driven model tier routing and agent/workflow configuration exist - existing
- ✓ Tool adapters for shell, file write, web search, and web fetch exist - existing
- ✓ User can submit a prompt and receive a planning node graph before execution - v1.0
- ✓ Approval checkpoints are backend-authoritative with explicit stale/duplicate handling - v1.0
- ✓ Checkpoint graph mutations are controller-authoritative - v1.0
- ✓ Runtime failures are visible across UI/CLI with aligned vocabulary and non-zero CLI exit on failure - v1.0
- ✓ MCP and skill interoperability path is documented and implemented for reference layouts - v1.1
- ✓ Chat-first UI session can create and refine execution graphs through conversation - v1.1
- ✓ Extension/plugin path exists for registering tools, skills, and model host adapters - v1.1
- ✓ Runtime supports explicit clarification prompts and answer-or-abort continuation - v1.1
- ✓ Typed artifact schema and run-state continuity support long-running node workflows - v1.1
- ✓ Hybrid refinement loop nodes improve answer quality through inspectable, bounded draft/critique/refine/gate cycles - v1.2
- ✓ Adaptive rubrics evaluate loop candidates by prompt/task context and support best-of-progress final selection - v1.2
- ✓ Quality-loop model routing and overrides are visible and strict per loop phase - v1.2
- ✓ Desktop release staging and Tauri shell packaging path exist - v1.3
- ✓ Runner registry and sampling cascade expose effective global/model/node values - v1.3
- ✓ Model library supports curated recommendations, Hugging Face search, download progress, and installed model selection - v1.3
- ✓ Native desktop lifecycle starts packaged `rlm ui`, redirects the webview, checks Ollama readiness, and stops the managed RLM child on close - v1.3
- ✓ Durable session save/reopen preserves workflow graph state, memory scopes, episodic history, preferences, and vector index metadata - v1.4
- ✓ Structured memory scopes and episodic logs restore bounded node context deterministically - v1.4
- ✓ User/project preferences can be persisted, inspected, edited, and deleted - v1.4
- ✓ CLI and UI expose what memory is saved, restored, and injected into node context - v1.4
- ✓ Semantic/vector retrieval surfaces relevant prior memory with visible degraded states - v1.4

### Active

- [ ] Plan-from-node is the default graph authoring path (root-composer submit, model-driven child planning, replan with protected-state UX) — v1.5
- [ ] Approved graphs save/import as `kind: graph` workflow sidecars (playbook + pipeline variants) — v1.5
- [ ] Planner assigns expert presets per node with visible overrides and exportable assignment metadata — v1.5
- [ ] UI and CLI expose the same planning, export, and expert semantics with explicit failure states — v1.5

### Candidate Next-Milestone Themes

- Product shell convergence: guided composer for first-run/new-workflow, graph workspace as the primary surface, and project/session launcher for durable resume.
- Multi-runner adapters beyond bundled Ollama, including llama.cpp, vLLM, and cloud APIs.
- Release hardening beyond baseline Linux installer: signed/reproducible artifacts, Windows/macOS package builds, GUI clean-machine smoke, and auto-update channel.
- Developer launcher and local-folder plugin manager.

### Out of Scope

- Multi-user collaboration or shared remote approval sessions - still not required for repo-local developer workflow unless selected for a future milestone.
- Silent auto-fallback behavior - conflicts with explicit error visibility requirement.

## Context

The repository has a layered TypeScript architecture (`src/application`, `src/domain`, `src/ports`, `src/adapters`), a React/Vite UI execution surface in `ui/`, and a Tauri shell under `src-tauri/`. The current product path remains local-first and observable.

v1.4 established the session memory foundation: durability, explicit persistence boundaries, restore verification, and visible degraded/error states. Retrieval builds on structured session state rather than replacing it.

## Constraints

- **Tech stack:** Continue using TypeScript/Node + existing React/Vite UI architecture.
- **Runtime mode:** Keep recursive agent behavior and dynamic node spawning.
- **Observability:** No silent failures - all errors must surface in CLI/UI states.
- **Compatibility:** Preserve existing CLI workflows (`--plan-only`, `--require-approval`, workflow execution).
- **Local-first workflow:** Project-local config and repo-local developer use remain the default unless a future milestone explicitly broadens deployment scope.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Approval checkpoints allow edit/delete/add actions before continuing | Needed for human-in-the-loop control over recursive execution plans | Shipped in v1.0 |
| Built-in tools load through first-party extension shims | Keeps core composition aligned with third-party extension contracts | Shipped in v1.1 |
| Quality loops remain collapsed top-level graph nodes with inspectable internal history | Preserves graph readability while exposing loop internals where users need them | Shipped in v1.2 |
| v1.3 manages Ollama only while preserving adapter boundaries | Keeps the first desktop product installable and testable without multiplying runner lifecycle complexity | Shipped in v1.3 |
| Sampling configuration resolves by cascade: global -> model -> node | Gives simple defaults and precise per-node control while preserving auditability | Shipped in v1.3 |
| Desktop app starts packaged `rlm ui` as a managed child rather than duplicating the control server in Rust | Preserves the existing TypeScript control-server behavior while giving Tauri ownership of native process lifecycle | Shipped in v1.3 |
| Session memory prioritizes durability and explicit restore semantics over retrieval cleverness | User explicitly wants all memory surfaces and does not want anything to get lost | Shipped v1.4 |
| Graph-primary authoring replaces chat-first pre-run flow | Users describe work on the canvas; plan-from-node is the default path | Active v1.5 |
| Expert team v1 uses shared tools with per-node allowlists | Keeps extension stack unified; specialized tool surfaces deferred until measured failures | Active v1.5 |
| Graph export uses lossless `kind: graph` sidecars with playbook/pipeline variants | Bridges dynamic authoring to replayable workflows without replan-by-default | Active v1.5 |
| Product shell uses guided composer -> graph workspace -> launcher/resume | First-run should still be "say what I want," while the graph remains the durable executable product surface | Candidate next milestone |

## Current Milestone: v1.5 Dynamic Graph Authoring

**Goal:** Make the execution graph the primary product surface for planning, expert assignment, and replayable workflow export — with full UI/CLI parity and no silent failures.

**Target features:**
- Model-driven plan-from-node (replace `plannedChildrenFor` heuristics); root-composer default; pristine vs protected replan (Replace / Merge / Cancel)
- Graph workflow export/import: playbook (literal prompts), pipeline (`{{input}}` templates), smart run defaults, `--variant` override
- Expert team: planner-assigned presets, inspector overrides, allowlist-only tools, plan-time `runtime: rlm` on high-complexity nodes
- Graph-primary UX: node submit replaces separate global chat-first authoring as default
- UI + CLI parity for plan, replan, export, import, and expert metadata

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-05-21 — milestone v1.5 Dynamic Graph Authoring started*
