# Roadmap: Recursive Language Model CLI — v1.1

## Overview

- **Active milestone:** v1.1 — Interop, chat-first, plugins, constrained tools
- **Project mode:** mvp
- **v1.0 history:** Phases 1–5 completed 2026-05-08 — see `.planning/milestones/v1.0-ROADMAP.md`
- **v1.1 requirements:** 7
- **v1.1 phases:** 4 (Phase 6–9)
- **Coverage target:** 100% of v1.1 requirements mapped exactly once

---

## Phases

- [ ] **Phase 6: Extension and Plugin Foundation** — Establish a documented extension mechanism for tools, skills, and model host adapters without forking core.
- [ ] **Phase 7: MCP and Skills Interoperability** — Wire MCP server connectivity and on-disk skill loading through the extension layer from Phase 6.
- [ ] **Phase 8: Model Host Extensibility and Constrained Tool Calling** — Make local/remote model endpoints configurable and tool rounds schema-constrained per host.
- [ ] **Phase 9: Chat-First Graph UX and Clarification Stops** — Replace single-shot prompt submission with conversational graph authoring and add explicit human-clarification pause semantics.

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
**Plans:** TBD

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
**Plans:** TBD

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
**Plans:** TBD

### Phase 9: Chat-First Graph UX and Clarification Stops
**Goal:** Users build and refine execution graphs through conversation, and the runtime pauses with an explicit human prompt when clarification is required — no silent continuation.
**Mode:** mvp
**Depends on:** Phase 5 (control-server and checkpoint infrastructure)
**Requirements:** CHAT-01, QUES-01
**Success Criteria** (what must be TRUE):
1. User can start a chat session and build an execution graph through natural-language messages, not only a single-shot prompt submission.
2. User can refine (add, remove, edit) pending nodes through follow-up messages before execution starts.
3. Execution pauses with a visible, user-facing clarification prompt when the runtime requires human input during a run.
4. Resumed execution after a clarification response proceeds explicitly — the question and answer are visible in run history.
5. Dismiss/skip policy for clarification prompts is documented and explicit; no undocumented silent default exists.
**Plans:** TBD

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
| PLUG-01 | Phase 6 | Pending |
| INT-01 | Phase 7 | Pending |
| INT-02 | Phase 7 | Pending |
| HOST-01 | Phase 8 | Pending |
| TCON-01 | Phase 8 | Pending |
| CHAT-01 | Phase 9 | Pending |
| QUES-01 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 15 total — all Complete ✓
- v1.1 requirements: 7 total — all mapped ✓
- Unmapped: 0 ✓

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Extension and Plugin Foundation | 0/? | Not started | — |
| 7. MCP and Skills Interoperability | 0/? | Not started | — |
| 8. Model Host Extensibility and Constrained Tool Calling | 0/? | Not started | — |
| 9. Chat-First Graph UX and Clarification Stops | 0/? | Not started | — |
