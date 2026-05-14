# Recursive Language Model CLI

## Current State

**Latest shipped milestone:** v1.1 — Interop, chat-first, plugins, constrained tools  
**Current milestone:** v1.2 — Answer Quality Loops  
**Status:** Defining requirements

v1.1 shipped plugin/extension foundations, MCP and skill interoperability, configurable local/remote model hosts, constrained tool-calling plumbing, typed artifact/run-state continuity, chat-first graph authoring, runtime clarification stops, cross-platform packaging/startup UX, and a typed node-composer UI for recursive workflow authoring.

## Current Milestone: v1.2 Answer Quality Loops

**Goal:** Add hybrid refinement loop nodes that improve answer quality through bounded draft, critique, refine, gate, and best-of-progress cycles.

**Target features:**
- Hybrid loop node shown as one top-level graph node with inspectable internal loop history.
- Default adaptive rubric for answer quality, code/engineering, planning/architecture, user-facing writing, and structured artifacts.
- Rubric fit, critique resolution, and best-of-progress selection used together.
- Phase-specific model overrides for draft, critique, refine, gate, and best-of-progress.
- Clear stop reasons: pass threshold, critique resolved, no meaningful improvement, max iterations, or human accept.

## What This Is

A local recursive language model CLI and UI workflow system for developers in this repo. It accepts a prompt, plans a typed node graph for recursive execution, lets users review and modify that graph through chat and direct graph controls, and then runs the AI workflow with visible execution state, explicit model routing, artifact/run-state continuity, and hard stops for approvals or clarification.

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
- ✓ Checkpoint graph mutations (edit/add/delete/connect) are controller-authoritative — v1.0
- ✓ Mutation validation failures are explicit and structured for UI/CLI handling — v1.0
- ✓ Planned/effective model metadata is captured and surfaced per node — v1.0
- ✓ Per-node model overrides at checkpoints route execution model selection — v1.0
- ✓ Explicit selected-model failures are strict and user-visible — v1.0
- ✓ Recursive execution can spawn downstream nodes while honoring approval/run-mode policy — v1.0
- ✓ Runtime failures are visible across UI/CLI with aligned vocabulary and non-zero CLI exit on failure — v1.0
- ✓ MCP and skill interoperability path is documented and implemented for reference layouts — v1.1
- ✓ Chat-first UI session can create and refine execution graphs through conversation — v1.1
- ✓ Extension/plugin path exists for registering tools, skills, and model host adapters — v1.1
- ✓ Configuration supports local and remote model endpoints with consistent routing semantics — v1.1
- ✓ Runtime supports explicit clarification prompts and answer-or-abort continuation — v1.1
- ✓ Tool rounds support constrained tool selection/argument plumbing through the model port and adapters — v1.1
- ✓ Typed artifact schema and run-state continuity support long-running node workflows — v1.1
- ✓ First-run UI and global/project config paths support zero-doc startup — v1.1
- ✓ Typed node composer exposes ports, artifact refs, complexity, and visible planning budgets — v1.1

### Active

- [ ] Hybrid refinement loop nodes improve answer quality through inspectable, bounded draft/critique/refine/gate cycles.
- [ ] Adaptive rubrics evaluate loop candidates by prompt/task context and support best-of-progress final selection.

### Candidate Next-Milestone Themes

- Developer launcher and local-folder plugin manager.
- Local Hugging Face GGUF model browser/installer with llama.cpp compatibility states.
- Release hardening: signed/reproducible single executable artifacts and platform release checks.
- Provider parity: deepen constrained tool-calling enforcement across non-Ollama hosts.
- Persistence/collaboration: durable graph edit history, interrupted-plan resume, or shared approval sessions if prioritized.

### Out of Scope

- Multi-user collaboration or shared remote approval sessions — still not required for repo-local developer workflow unless selected for a future milestone.
- Silent auto-fallback behavior — conflicts with explicit error visibility requirement.

## Context

The repository has a layered TypeScript architecture (`src/application`, `src/domain`, `src/ports`, `src/adapters`) and a React/Vite UI execution surface in `ui/`. v1.1 expanded the system into an interoperable recursive workflow authoring tool: extension shims now load built-in tools, MCP/skill runtime paths are exposed as executable tools, model host routing and constrained-tool signals flow through the language model port, run-state persistence records guarded mutations, and the UI supports typed dataflow composition with budgeted recursive planning.

Current verification baseline at v1.1 close: `npm test` passed outside sandbox restrictions with 98/98 tests passing.

## Constraints

- **Tech stack:** Continue using TypeScript/Node + existing React/Vite UI architecture.
- **Runtime mode:** Keep recursive agent behavior and dynamic node spawning.
- **Observability:** No silent failures — all errors must surface in CLI/UI states.
- **Compatibility:** Preserve existing CLI workflows (`--plan-only`, `--require-approval`, workflow execution).
- **Local-first workflow:** Project-local config and repo-local developer use remain the default unless a future milestone explicitly broadens deployment scope.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Approval checkpoints allow edit/delete/add actions before continuing | Needed for human-in-the-loop control over recursive execution plans | Shipped in v1.0 |
| Show planned model directly on each node card | Model choice is a first-class execution concern, including cross-model handoff | Shipped in v1.0 |
| v1 graph edits remain in-memory | Faster path to stable approval flow; avoids persistence/versioning complexity initially | Shipped in v1.0 |
| Add override mode: approve initial plan only, then auto-run | Maintains safety at planning boundary while reducing interaction overhead | Shipped in v1.0 |
| Built-in tools load through first-party extension shims | Keeps core composition aligned with third-party extension contracts | Shipped in v1.1 |
| MCP and skill lifecycle events share a deterministic event schema | Makes outages, warnings, and recovery auditable across interop mechanisms | Shipped in v1.1 |
| Clarification stops are answer-or-abort only | Prevents undocumented silent continuation when human input is required | Shipped in v1.1 |
| Typed artifact refs stay in graph state while large payloads stay external | Keeps long-running workflows inspectable without context overflow | Shipped in v1.1 |
| Packaging can ship functionally before full signing/reproducibility | Allows zero-doc first-run UX to land while tracking release hardening separately | Revisit |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `$gsd-complete-milestone`):
1. Review product description and core value.
2. Move shipped requirements to Validated.
3. Refresh active requirements for the next milestone.
4. Record major decisions and known debt.
5. Update current-state context.

---
*Last updated: 2026-05-14 starting v1.2 milestone*
