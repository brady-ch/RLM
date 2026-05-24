# Phase 113: Per-Phase Verification Gates

Executable pass/fail commands for Phases 114–120 teardown. Cross-reference inventory: `113-AUDIT.md`.

---

## Phase 114: Control Server and UI Bootstrap Removal

**Scope:** Delete TypeScript control server; Rust Axum server is sole HTTP transport for UI  
**Preconditions:** Phase 113 gates passed (`npm run test:rlm-runtime`, audit docs exist)  
**Delete:** `src/application/control-server/`, `tests/integration/control-server-fixtures.test.ts`, `scripts/parity/compare-runtimes.mjs` TS boot portions  
**Keep:** `tests/fixtures/control-server/*.json`, `crates/rlm-core/src/control_server/`, `ui/`

**Gate commands:**

1. `node scripts/cargo-with-ram-gate.mjs -- cargo test -p rlm-core control_server_matches_golden_fixtures -- --nocapture` — exit 0
2. `RLM_UI_DIST=ui/dist cargo run -p rlm-cli -- ui --port 0` — smoke: server prints listening URL
3. `test ! -d src/application/control-server` — exit 0 (deleted)
4. `test ! -f tests/integration/control-server-fixtures.test.ts` — exit 0 (deleted)
5. `grep -q control_server_matches_golden_fixtures package.json && ! grep -q control-server-fixtures.test package.json` — `check:parity` must NOT boot TS fixture test

**Target `check:parity` after 114:**

```json
"check:parity": "node scripts/cargo-with-ram-gate.mjs -- cargo test -p rlm-core control_server_matches_golden_fixtures -- --nocapture"
```

**Rollback:** `git checkout HEAD~1 -- src/application/control-server tests/integration/control-server-fixtures.test.ts scripts/parity/compare-runtimes.mjs package.json`

---

## Phase 115: CLI Entry and Runtime Composition Removal

**Scope:** Delete Node CLI entry and runtime composition; Rust `rlm-cli` is sole CLI  
**Preconditions:** Phase 114 gates passed  
**Delete:** `src/index.ts`, `src/cli/`, `src/runtime/`  
**Keep:** `scripts/rlm-runtime.mjs` (dispatcher), `crates/rlm-cli/`

**Gate commands:**

1. `cargo test -p rlm-core` — exit 0
2. `npm run rlm -- --help` — via dispatcher → Rust CLI help text
3. `test ! -f src/index.ts && test ! -d src/cli && test ! -d src/runtime` — exit 0
4. `cargo check -p rlm-tauri` — Tauri smoke (or manual `npm run tauri:dev` checkpoint)

**Rollback:** `git checkout HEAD~1 -- src/index.ts src/cli src/runtime`

---

## Phase 116: Application Layer Removal

**Scope:** Delete `src/application/` after Rust application layer confirmed complete  
**Preconditions:** Phase 115 gates passed  
**Delete:** `src/application/` (remaining), `tests/application/`  
**Keep:** `crates/rlm-core/src/application/`

**Gate commands:**

1. `cargo test -p rlm-core` — exit 0
2. `test ! -d src/application` — exit 0
3. `npm run rlm -- ask --help` — Rust ask path available

**Rollback:** `git checkout HEAD~1 -- src/application tests/application`

---

## Phase 117: Domain and Ports Removal

**Scope:** Delete TS domain orchestrator and port interfaces; Rust is canonical  
**Preconditions:** Phase 116 gates passed  
**Delete:** `src/domain/`, `src/ports/`, `tests/domain/`  
**Keep:** `crates/rlm-core/src/domain/`, `crates/rlm-core/src/ports/`

**Gate commands:**

1. `cargo test -p rlm-core` — exit 0
2. `test ! -d src/domain && test ! -d src/ports` — exit 0
3. `! grep -r 'from.*src/domain\|from.*src/ports' ui/ scripts/ 2>/dev/null | grep -v node_modules` — no TS imports in ui/scripts

**Rollback:** `git checkout HEAD~1 -- src/domain src/ports tests/domain`

---

## Phase 118: Adapters, Plugins, and TS Tests Removal

**Scope:** Delete remaining TS infrastructure and mirrored runtime tests  
**Preconditions:** Phase 117 gates passed  
**Delete:** `src/adapters/`, `src/plugins/`, `tests/adapters/`, `tests/plugins/`, `tests/runtime/`, TS integration tests  
**Keep:** `crates/rlm-core/src/adapters/`, `crates/rlm-core/src/plugins/`, `crates/rlm-core/src/persistence/`

**Gate commands:**

1. `cargo test -p rlm-core` — exit 0
2. `test ! -d src/adapters && test ! -d src/plugins` — exit 0
3. `test ! -d tests/domain && test ! -d tests/adapters && test ! -d tests/plugins && test ! -d tests/runtime` — mirrored tests removed
4. `test ! -d src` — entire `src/` absent

**Rollback:** `git checkout HEAD~1 -- src/adapters src/plugins tests/`

---

## Phase 119: npm Toolchain and CI Rust-Only Cleanup

**Scope:** Strip Node runtime from package.json and CI; keep Vite/UI build toolchain  
**Preconditions:** Phase 118 gates passed  
**Delete:** TS build deps, depcruise, Node-specific scripts, `typecheck` as TS gate  
**Keep:** Vite/UI deps, `npm run build:ui`, `npm run check:rust`

**Gate commands:**

1. `npm run check:rust` — exit 0
2. `npm run build:ui` — exit 0
3. Verify `npm run typecheck` removed or documented no-op
4. `npm run test:agent:verify:light` — exit 0

**Rollback:** `git checkout HEAD~1 -- package.json tsconfig.json .dependency-cruiser.js`

---

## Phase 120: Constrained Ollama Tool Envelope (Rust)

**Scope:** Post-cutover tool-call hardening via Ollama JSON-schema envelope  
**Preconditions:** Phase 119 gates passed  
**Delete:** N/A (Rust-only feature)  
**Keep:** Existing two-phase path when envelope mode off

**Gate commands:**

1. `cargo test -p rlm-core` — exit 0
2. Envelope-specific tests per `.planning/research/TOOL-CALLING-CONSTRAINED-DECODING.md`
3. Valid envelope parse and unknown-tool rejection covered

**Rollback:** `git checkout HEAD~1 -- crates/rlm-core/src/adapters/ollama_language_model/`

---

## HTTP contract gate (post-114)

- **Sole gate:** `control_server_matches_golden_fixtures` in `crates/rlm-core/tests/control_server_fixtures.rs`
- **Retired in 114:** `tests/integration/control-server-fixtures.test.ts`, `scripts/parity/compare-runtimes.mjs` TS server boot
- **Fixture files:** `tests/fixtures/control-server/*.json` (shared data, kept)
- **Agent-safe invocation:** `node scripts/cargo-with-ram-gate.mjs -- cargo test -p rlm-core control_server_matches_golden_fixtures -- --nocapture`
- **CI evolution:** `check:parity` narrows to Rust golden only — no TS server boot after Phase 114

---

## Phase 113 completion checklist

| # | ROADMAP success criterion | Verification command / artifact |
|---|---------------------------|--------------------------------|
| 1 | TS-only path inventory documented | `test -f 113-AUDIT.md` + `## Deletion order (summary)` section |
| 2 | Default npm rlm dispatches to Rust | `npm run test:rlm-runtime` |
| 3 | Per-phase verification gates written | `test -f 113-GATES.md` + migration note updated |
| 4 | Rust golden fixtures sole HTTP gate post-114 | `113-GATES.md` HTTP contract section |

---

## References

- `.planning/phases/113-node-runtime-retirement-audit-and-cutover-gates/113-AUDIT.md`
- `.planning/phases/113-node-runtime-retirement-audit-and-cutover-gates/113-GATES.md` (this file)
- `.planning/notes/rust-only-runtime-migration-decisions.md`
- `crates/rlm-core/tests/control_server_fixtures.rs`
- `tests/fixtures/control-server/`
