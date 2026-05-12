# Roadmap: Recursive Language Model CLI — v1.1

## Overview

- **Active milestone:** v1.1 — Interop, chat-first, plugins, constrained tools
- **Project mode:** mvp
- **v1.0 history:** Phases 1–5 completed 2026-05-08 — see `.planning/milestones/v1.0-ROADMAP.md`
- **v1.1 requirements:** 15
- **v1.1 phases:** 7 (Phase 6–11 with Phase 8.5)
- **Coverage target:** 100% of v1.1 requirements mapped exactly once

---

## Phases

- [x] **Phase 6: Extension and Plugin Foundation** — Establish a documented extension mechanism for tools, skills, and model host adapters without forking core. (completed 2026-05-10)
- [x] **Phase 7: MCP and Skills Interoperability** — Wire MCP server connectivity and on-disk skill loading through the extension layer from Phase 6. (completed 2026-05-10)
- [x] **Phase 8: Model Host Extensibility and Constrained Tool Calling** — Make local/remote model endpoints configurable and tool rounds schema-constrained per host. (completed 2026-05-11)
- [x] **Phase 8.5: Typed Artifact + Stateful Workflow Runtime** — Add typed artifact contracts and guarded external run-state continuity for long-running, model-chained node workflows. (completed 2026-05-11)
- [x] **Phase 9: Chat-First Graph UX and Clarification Stops** — Replace single-shot prompt submission with conversational graph authoring and add explicit human-clarification pause semantics. (completed 2026-05-11)
- [x] **Phase 10: Cross-Platform Executable Packaging and Install UX** — Ship single-executable distribution plus global-install path with zero-doc first-run behavior across macOS/Linux/Windows. (completed 2026-05-12)
- [x] **Phase 11: Node-Embedded Chat and Intuitive Graph Editing UX** — Ship a ComfyUI-style typed node composer with bounded recursive planning, dataflow ports, artifact refs, and direct graph editing. (completed 2026-05-12)

---

## Phase Details

### Phase 6: Extension and Plugin Foundation
**Goal:** System exposes a documented, working extension interface for registering tools, skills, and model host adapters — the load path INT and HOST phases build on.
**Mode:** mvp
**Depends on:** Phase 5 (v1.0 complete)
**Requirements:** PLUG-01
**Success Criteria** (what must be TRUE):
1. A tool, skill loader, or model host adapter can be registered through the extension interface without modifying any core source file.
2. At least one reference registration (tool or skill loader) is loadable and exercised in an integration test or documented runnable example.
3. Existing CLI behavior, tool adapters, and approval flows are unchanged after the extension layer is introduced.
4. The extension interface is documented with types, registration steps, and at least one worked example.
**Plans:** 2/2 plans complete

### Phase 7: MCP and Skills Interoperability
**Goal:** Users can configure MCP servers and load skills from common on-disk layouts used by target agent hosts.
**Mode:** mvp
**Depends on:** Phase 6
**Requirements:** INT-01, INT-02
**Success Criteria** (what must be TRUE):
1. User can specify at least one MCP server in config and the system establishes the connection and makes its tools available in the recursive execution loop.
2. User can reference skills from at least one common on-disk layout (compatible with a named target agent host) and they load and execute correctly.
3. The import or parity path is documented with at least one concrete configuration example per mechanism (MCP config, skill layout).
4. Existing non-MCP tool adapters remain functional after MCP integration.
5. Skill resolution supports configurable ordered search paths with first-match precedence, and optional skill caching controlled by config.
6. Skill loading strictness is configurable per skill path (`strict`/`lenient`), and lenient validation failures emit CLI warnings, structured run-trace events, and persisted audit records.
**Plans:** 2/2 plans complete

### Phase 8: Model Host Extensibility and Constrained Tool Calling
**Goal:** Model endpoints are configurable as local or remote with consistent routing semantics, and tool-calling rounds apply schema-constrained decoding appropriate to the active host.
**Mode:** mvp
**Depends on:** Phase 6
**Requirements:** HOST-01, TCON-01
**Success Criteria** (what must be TRUE):
1. User can configure local (e.g. Ollama) and remote (HTTP) model hosts in YAML and the system routes each node to the correct endpoint at runtime.
2. Tool-calling rounds enforce a schema-constrained envelope (JSON Schema / host-native structured output, e.g. Ollama `format`) for tool selection and arguments at the adapter layer, per `TOOL-CALLING-CONSTRAINED-DECODING.md`.
3. Ollama `tools` + `format` mutual exclusion is enforced — constrained decoding and tool rounds do not conflict.
4. A new model host adapter can be registered via the Phase 6 extension mechanism without modifying core recursion logic or `LanguageModelPort`.
5. CLI `--json-stream` output and the UI both show the host/endpoint used per node.
**Plans:** 2/2 plans complete

### Phase 8.5: Typed Artifact + Stateful Workflow Runtime
**Goal:** Support deterministic multi-model node pipelines (including code-only nodes) using typed artifact contracts and a guarded external run-state store suitable for whole-book scale processing.
**Mode:** mvp
**Depends on:** Phase 8
**Requirements:** ARTF-01
**Success Criteria** (what must be TRUE):
1. Runtime supports typed artifact schema handoff between nodes and validates artifacts at node boundaries.
2. Runtime supports code-only nodes that consume/emit typed artifacts and participate in the same graph execution model.
3. External run-state store is mutable and queryable with optimistic concurrency (`version`/`etag`) and path-level mutation ACL.
4. Every state mutation attempt is audit-logged (accepted or rejected), with enough metadata to replay and diagnose full-book workflows.
5. Text-to-audio model type can be configured as a node target and chained with parsing/reassembly nodes without breaking existing agent skill compatibility.
**Plans:** 2/2 plans complete

### Phase 9: Chat-First Graph UX and Clarification Stops
**Goal:** As a workflow author, I want to build and refine execution graphs through conversation and receive explicit clarification stops during runs, so that no execution continues silently without my input.
**Mode:** mvp
**Depends on:** Phase 5 (control-server and checkpoint infrastructure)
**Requirements:** CHAT-01, QUES-01
**Success Criteria** (what must be TRUE):
1. User can start a chat session and build an execution graph through natural-language messages, not only a single-shot prompt submission.
2. User can refine (add, remove, edit) pending nodes through follow-up messages before execution starts.
3. Execution pauses with a visible, user-facing clarification prompt when the runtime requires human input during a run.
4. Resumed execution after a clarification response proceeds explicitly — the question and answer are visible in run history.
5. Dismiss/skip policy for clarification prompts is documented and explicit; no undocumented silent default exists.
**Plans:** 2/2 plans complete

### Phase 10: Cross-Platform Executable Packaging and Install UX
**Goal:** As a new user, I want to install one executable (or global CLI) and run the tool in any folder with one command, so that I can open the UI and complete an edit-and-run workflow without reading setup docs.
**Mode:** mvp
**Depends on:** Phase 9
**Requirements:** DIST-01, DIST-02, DIST-03
**Success Criteria** (what must be TRUE):
1. Build pipeline produces signed/reproducible single executable artifacts for macOS, Linux, and Windows.
2. Global-install path (`rlm`) works and executes against the caller's current working directory.
3. First-run path requires one command to launch UI session with actionable defaults (no required manual config edits).
4. Installer/runtime messaging clearly explains next action (UI URL, prompt expectations, stop/restart).
5. Packaging verification covers platform-specific startup checks and folder-local operation semantics.
**Plans:** 2/2 plans complete

### Phase 11: Node-Embedded Chat and Intuitive Graph Editing UX
**Goal:** As a workflow author, I want a ComfyUI-style typed node composer with direct graph controls, bounded recursive planning, artifact-aware dataflow ports, and code-only node support surfaced in the UI, so that I can build modular long-running workflows such as full-book audiobook generation without context overflow.
**Mode:** mvp
**Depends on:** Phase 10
**Requirements:** UXND-01, UXND-02, UXND-03, UXND-04
**Success Criteria** (what must be TRUE):
1. Each editable node exposes a typed composer: node type, runtime/model selector, prompt or code configuration, typed input/output ports, artifact schema summary, complexity rating, and plan budget.
2. Plan mode creates editable pending child nodes, labels decomposition complexity, and never starts execution until the user explicitly approves.
3. UI provides explicit plan/spawn, break down, delete, drag, and connect-port controls with safe dependency validation and clear error recovery.
4. Recursive planning expansion is constrained by visible depth/node budgets; budget exhaustion pauses expansion and requires explicit approval to extend.
5. UI supports large artifact workflows by passing artifact refs/metadata through graph state while storing large payloads (audio, book chunks) on disk or external storage.
6. New-user usability check passes: install, launch, enter a root node prompt, generate an editable plan graph, break down a high-complexity child, inspect artifact refs, confirm run, and observe recursive expansion.
**Plans:** 1/1 plans complete

---

## Requirement Mapping Table

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAN-01 | Phase 1 | Complete |
| PLAN-02 | Phase 3 | Complete |
| APRV-01 | Phase 1 | Complete |
| APRV-02 | Phase 2 | Complete |
| APRV-03 | Phase 2 | Complete |
| APRV-04 | Phase 2 | Complete |
| APRV-05 | Phase 4 | Complete |
| MODL-01 | Phase 3 | Complete |
| MODL-02 | Phase 3 | Complete |
| MODL-03 | Phase 3 | Complete |
| RECR-01 | Phase 4 | Complete |
| RECR-02 | Phase 4 | Complete |
| ERRO-01 | Phase 5 | Complete |
| ERRO-02 | Phase 2 | Complete |
| ERRO-03 | Phase 5 | Complete |
| PLUG-01 | Phase 6 | Complete |
| INT-01 | Phase 7 | Complete |
| INT-02 | Phase 7 | Complete |
| HOST-01 | Phase 8 | Complete |
| TCON-01 | Phase 8 | Complete |
| ARTF-01 | Phase 8.5 | Complete |
| CHAT-01 | Phase 9 | Complete |
| QUES-01 | Phase 9 | Complete |
| DIST-01 | Phase 10 | Complete |
| DIST-02 | Phase 10 | Complete |
| DIST-03 | Phase 10 | Complete |
| UXND-01 | Phase 11 | Complete |
| UXND-02 | Phase 11 | Complete |
| UXND-03 | Phase 11 | Complete |
| UXND-04 | Phase 11 | Complete |

**Coverage:**
- v1 requirements: 15 total — all Complete ✓
- v1.1 requirements: 15 total — all Complete ✓
- Unmapped: 0 ✓

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Extension and Plugin Foundation | 2/2 | Complete    | 2026-05-10 |
| 7. MCP and Skills Interoperability | 2/2 | Complete    | 2026-05-10 |
| 8. Model Host Extensibility and Constrained Tool Calling | 2/2 | Complete | 2026-05-11 |
| 8.5 Typed Artifact + Stateful Workflow Runtime | 2/2 | Complete | 2026-05-11 |
| 9. Chat-First Graph UX and Clarification Stops | 2/2 | Complete | 2026-05-11 |
| 10. Cross-Platform Executable Packaging and Install UX | 2/2 | Complete    | 2026-05-12 |
| 11. Node-Embedded Chat and Intuitive Graph Editing UX | 1/1 | Complete | 2026-05-12 |
