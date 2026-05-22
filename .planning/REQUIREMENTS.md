# Requirements: Recursive Language Model CLI

**Defined:** 2026-05-22  
**Milestone:** v1.9 — Rust Runtime Hardening  
**Core Value:** Developers can reliably plan, inspect, edit, and execute recursive AI node graphs with explicit model routing and no silent failures.

## v1.9 Requirements

### Regression & UI Parity

- [ ] **REG-01**: Phase 61 UI regressions are closed — pause-auto-approvals control, Hugging Face model download wiring, and REG-01 human UAT checklist signed.
- [x] **REG-02**: Combined CI gate stays green: `npm run check`, `npm run check:rust`, and parity fixtures throughout milestone execution.

### Recursive Engine

- [x] **ENGN-01**: Rust quality loop matches TypeScript orchestrator — full draft/critique/refine/gate/best-of phases, iteration metadata, per-phase model routing, budget behavior, and golden parity tests.
- [x] **ENGN-02**: Session readiness JSON shape matches TypeScript structured object (no string `"empty"` drift on draft graphs).

### Persistence & Resume

- [ ] **PERS-01**: Cross-session resume consumer reads `resumeCursor` + `nodeStatuses` on graph entry and skips completed nodes after process restart.
- [ ] **PERS-02**: Control-server resume path requires explicit user confirmation; TS `RunStatePersistence` writes the same cursor shape for dual-runtime parity.
- [ ] **PERS-03**: Integration test proves partial run → restart → resume → complete without re-executing finished nodes.

### Plugins & Interop

- [ ] **PLUG-01**: Skill interop ports to Rust — skill discovery, path policies, cache, and `skill` tool registration with preserved init order.
- [ ] **PLUG-02**: Plugin doctor surfaces skill path violations with actionable warnings (mirrors MCP doctor pattern).

### CLI

- [ ] **CLI-01**: Rust `rlm` binary supports all Node run modes without fallback: `plan-node`, `workflow-export`, `workflow-import`, session/memory flags, and full approval/plan-only/workflow/agent config surface from `args.ts`.
- [ ] **CLI-02**: Parity CI gate covers new CLI commands; `RLM_RUNTIME=rust` is sufficient for documented workflows.

### Packaging

- [ ] **PACK-01**: Linux `.deb` package smoke runs in CI on headless hosts (Docker or `xvfb-run`) without requiring local GTK/dbus.

### Rust Architecture

- [ ] **ARCH-01**: Domain layer has no imports from `persistence/`, `adapters/`, or `control_server/` — run-state uses `RunStateStorePort` trait.
- [ ] **ARCH-02**: `application/` module groups execution, graph, memory, config, and bootstrap facades; composition wiring extracted from transport/CLI entrypoints.
- [ ] **ARCH-03**: Control server handlers split from monolithic `routes.rs` into concern modules; router file is transport-only wiring.
- [ ] **ARCH-04**: Large modules decomposed (`recursive_language_model`, `session_graph`, `registry_service`, `persistence/config`) with behavior-preserving tests green after each split.
- [ ] **ARCH-05**: Rust concern map documented in `AGENTS.md`; `check-rust-boundaries` script wired into `npm run check:rust`.
- [ ] **ARCH-06**: Optional workspace crate split (`rlm-ports`, `rlm-domain`) evaluated and implemented only if compile iteration remains painful after A1–A4; public API unchanged.

## Future Requirements

### Post–v1.9 (Deferred)

- **INFR-01**: Managed in-process llama.cpp runtime with GPU backend matrix.
- **INFR-02**: WASM or subprocess bridge for external ESM plugins beyond Rust-native builtins.
- **INFR-03**: Multi-runner adapters (vLLM, cloud APIs) beyond Ollama HTTP.
- **INFR-04**: Fine-tuning / LoRA / QLoRA workflows.
- **INFR-05**: Product shell convergence (guided composer, session launcher).
- **INFR-06**: Release hardening (signed artifacts, Windows/macOS packages, auto-update channel).

## Out of Scope

| Feature | Reason |
|---------|--------|
| React UI rewrite beyond regression fixes | v1.9 closes v1.8 debt; canvas shell is current product surface |
| Replacing Ollama as default inference host | Separate milestone (INFR-01 seed) |
| Fine-tuning / LoRA | Explicitly deferred (INFR-04) |
| Node runtime removal from strangler tests | TS remains for parity CI until v1.9 closes all partial ports |
| Mandatory crate split | ARCH-06 is optional; triggered by measured compile pain only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REG-01 | Phase 62 | Pending |
| REG-02 | All phases | Complete |
| ENGN-01 | Phase 63 | Complete |
| ENGN-02 | Phase 63 | Complete |
| PERS-01 | Phase 64 | Pending |
| PERS-02 | Phase 64 | Pending |
| PERS-03 | Phase 64 | Pending |
| PLUG-01 | Phase 65 | Pending |
| PLUG-02 | Phase 65 | Pending |
| CLI-01 | Phase 66 | Pending |
| CLI-02 | Phase 66 | Pending |
| PACK-01 | Phase 67 | Pending |
| ARCH-01 | Phase 64 | Pending |
| ARCH-02 | Phase 68 | Pending |
| ARCH-03 | Phase 68 | Pending |
| ARCH-04 | Phase 69 | Pending |
| ARCH-05 | Phase 70 | Pending |
| ARCH-06 | Phase 71 | Pending |

**Coverage:**
- v1.9 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-22*  
*Last updated: 2026-05-22 after milestone v1.9 initialization*
