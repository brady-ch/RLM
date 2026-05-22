# Phase 64 Context — Resume Consumer + Run-State Port

**Goal:** User can resume interrupted graph runs after restart; domain boundary fixed via store port.

**Requirements:** PERS-01, PERS-02, PERS-03, ARCH-01, REG-02

**Upstream:** Phase 63 quality loop parity (complete)

**Deferred from v1.8 (PERS-03-GAP.md):**

- Phase 1 wrote `resumeCursor` + `nodeStatuses` from Rust GraphExecutor but had no reload consumer.
- TypeScript `RunStatePersistence` persisted only `nodeStatuses` — no cursor parity.
- Domain imported concrete `FileRunStateStore` (ARCH-01 violation).

**Success criteria (from ROADMAP):**

1. Graph executor reads `resumeCursor` + `nodeStatuses` and skips completed nodes on entry
2. Control-server resume requires explicit user confirmation
3. TS `RunStatePersistence` writes same cursor shape as Rust
4. Integration test: partial run → restart → resume → complete
5. No `domain/` module imports concrete persistence types

**Out of scope:**

- Full checkpoint replay or orchestrator-level continuity
- UI resume button (endpoint only; UI can wire later)
- Pipeline vs playbook variant auto-detection beyond stored cursor variant
