# Recursive Language Model CLI

## Current State

**Latest shipped milestone:** v1.2 - Answer Quality Loops  
**Current milestone:** v1.3 - Desktop Product  
**Status:** Defining requirements and roadmap

v1.2 shipped bounded answer-quality refinement loops with visible rubrics, structured evaluator contracts, best-of-progress selection, phase-specific model routing, inspectable UI/CLI output, manual loop controls, and regression coverage across runtime, API/UI, trace, render, and run-state surfaces.

## Current Milestone: v1.3 Desktop Product

**Goal:** Turn RLM into an installable cross-platform desktop app that launches without terminal setup, manages an Ollama-backed local runner, provides a model library, and exposes sampling controls in the UI.

**Target features:**
- Runner registry and sampling cascade: global defaults -> per-model profile -> per-node override.
- Model library: curated catalog, Hugging Face search, download/progress states, installed model selection.
- Desktop shell and installers: Tauri app, control-server lifecycle, bundled/detected Ollama, clean shutdown.

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
- ✓ Checkpoint graph mutations (edit/add/delete/connect) are controller-authoritative - v1.0
- ✓ Mutation validation failures are explicit and structured for UI/CLI handling - v1.0
- ✓ Planned/effective model metadata is captured and surfaced per node - v1.0
- ✓ Per-node model overrides at checkpoints route execution model selection - v1.0
- ✓ Explicit selected-model failures are strict and user-visible - v1.0
- ✓ Recursive execution can spawn downstream nodes while honoring approval/run-mode policy - v1.0
- ✓ Runtime failures are visible across UI/CLI with aligned vocabulary and non-zero CLI exit on failure - v1.0
- ✓ MCP and skill interoperability path is documented and implemented for reference layouts - v1.1
- ✓ Chat-first UI session can create and refine execution graphs through conversation - v1.1
- ✓ Extension/plugin path exists for registering tools, skills, and model host adapters - v1.1
- ✓ Configuration supports local and remote model endpoints with consistent routing semantics - v1.1
- ✓ Runtime supports explicit clarification prompts and answer-or-abort continuation - v1.1
- ✓ Tool rounds support constrained tool selection/argument plumbing through the model port and adapters - v1.1
- ✓ Typed artifact schema and run-state continuity support long-running node workflows - v1.1
- ✓ First-run UI and global/project config paths support zero-doc startup - v1.1
- ✓ Typed node composer exposes ports, artifact refs, complexity, and visible planning budgets - v1.1
- ✓ Hybrid refinement loop nodes improve answer quality through inspectable, bounded draft/critique/refine/gate cycles - v1.2
- ✓ Adaptive rubrics evaluate loop candidates by prompt/task context and support best-of-progress final selection - v1.2
- ✓ Quality-loop model routing and overrides are visible and strict per loop phase - v1.2
- ✓ Quality-loop UI, CLI, JSON, trace, and run-state surfaces expose bounded, non-silent loop outcomes - v1.2

### Active

- [ ] Desktop app installers launch RLM on Windows, macOS, and Linux without requiring Node/npm or manual runner setup - v1.3
- [ ] Ollama is treated as a managed runner adapter with explicit availability and failure states - v1.3
- [x] Model library supports curated recommendations, Hugging Face search, download progress, and installed model selection - v1.3
- [x] Sampling controls resolve through global defaults, per-model profiles, and per-node overrides with traceable effective values - v1.3

### Candidate Next-Milestone Themes

- Developer launcher and local-folder plugin manager.
- Dynamic graph authoring, graph workflow export, and expert team node assignment.
- Session memory with structured scopes, save/reopen, and vector retrieval.
- Multi-runner adapters beyond bundled Ollama, including llama.cpp, vLLM, and cloud APIs.
- Release hardening beyond baseline installers: signed/reproducible artifacts, notarization depth, and auto-update channel.
- Provider parity: deepen constrained tool-calling enforcement across non-Ollama hosts.
- Persistence/collaboration: durable graph edit history, interrupted-plan resume, or shared approval sessions if prioritized.

### Out of Scope

- Multi-user collaboration or shared remote approval sessions - still not required for repo-local developer workflow unless selected for a future milestone.
- Silent auto-fallback behavior - conflicts with explicit error visibility requirement.
- Bundling llama.cpp or vLLM in v1.3 - keep Ollama as the sole managed runner first; additional adapters are seeded for later.

## Context

The repository has a layered TypeScript architecture (`src/application`, `src/domain`, `src/ports`, `src/adapters`) and a React/Vite UI execution surface in `ui/`. v1.3 focuses on productizing that stack as a desktop app: runner lifecycle and model installation become user-facing product flows, while the core recursive graph runtime remains local-first and observable.

Current verification baseline at v1.2 close: `npm test` passed with 141/141 tests passing. `npm run build` and `npm run build:ui` also passed during final phase verification.

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
| Show planned model directly on each node card | Model choice is a first-class execution concern, including cross-model handoff | Shipped in v1.0 |
| v1 graph edits remain in-memory | Faster path to stable approval flow; avoids persistence/versioning complexity initially | Shipped in v1.0 |
| Add override mode: approve initial plan only, then auto-run | Maintains safety at planning boundary while reducing interaction overhead | Shipped in v1.0 |
| Built-in tools load through first-party extension shims | Keeps core composition aligned with third-party extension contracts | Shipped in v1.1 |
| MCP and skill lifecycle events share a deterministic event schema | Makes outages, warnings, and recovery auditable across interop mechanisms | Shipped in v1.1 |
| Clarification stops are answer-or-abort only | Prevents undocumented silent continuation when human input is required | Shipped in v1.1 |
| Typed artifact refs stay in graph state while large payloads stay external | Keeps long-running workflows inspectable without context overflow | Shipped in v1.1 |
| Quality loops remain collapsed top-level graph nodes with inspectable internal history | Preserves graph readability while exposing loop internals where users need them | Shipped in v1.2 |
| Quality-loop model routing is phase-specific and strict | Users need to audit and override draft, critique, refine, gate, and best-of-progress independently without silent fallback | Shipped in v1.2 |
| Browser-level interactive UAT can follow regression coverage | Fake-model, API/UI source, render, trace, and run-state tests cover the milestone objective; browser UAT remains useful before public release | Revisit |
| v1.3 bundles or manages Ollama only, while preserving adapter boundaries | Keeps the first desktop product installable and testable without multiplying runner lifecycle complexity | Active in v1.3 |
| Sampling configuration resolves by cascade: global -> model -> node | Gives simple defaults and precise per-node control while preserving auditability | Active in v1.3 |
| Model library installs curated Ollama models first and treats Hugging Face as search/compatibility discovery | Keeps Phase 22 useful while avoiding silent unsupported imports | Active in v1.3 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `$gsd-complete-milestone`):
1. Review product description and core value.
2. Move shipped requirements to Validated.
3. Refresh active requirements for the next milestone.
4. Record major decisions and known debt.
5. Update current-state context.

---
*Last updated: 2026-05-20 after Phase 22 verification*
