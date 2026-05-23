# Phase 75: Skill Interop Depth — Context

**Goal:** Skill load/parse failures surface as structured lifecycle events; declarative skill paths load asynchronously via `ManifestSkillLoader.load()`.

**Requirements:** PLUG-04, PLUG-05

**Depends on:** Phase 74 — roadmap sequencing only; no code dependency.

## Decisions

### D-01: SKILL_PARSE_ERROR event shape (PLUG-04)

Emit structured lifecycle events matching TS `RuntimeEvent` fields used in `src/runtime/interop/mcp-skill-runtime.ts`: at minimum `code: "SKILL_PARSE_ERROR"`, `severity` (`warn` | `error` per path strictness), `source: "skills"`, `subject` (absolute skill path), `message`, `runId`, `seq`, `occurredAt`. Rust `SkillRuntime.resolve_skill` must emit through an injectable sink — not warning strings alone.

### D-02: ManifestSkillLoader async load (PLUG-05)

Extend Rust `SkillLoader` trait with `async fn load(&self) -> Result<(), String>`. `ManifestSkillLoader.load()` validates `root_path` is a directory, discovers skill candidates under it (reuse `discover_skill_candidates`), and records load outcome. Invoke `load().await` during manifest registration (`register_manifest_skill_loaders`) before inserting into extension host; propagate failures as structured events and doctor-visible issues.

### D-03: Doctor/status structured context

Plugin doctor (`collect_skill_loader_issues`) and runtime init warnings must include parse/load failure context (path + reason), not opaque strings only. Align severity with strict/lenient path policy.

### D-04: Targeted tests only

Extend `crates/rlm-core/tests/skill_interop.rs` (and unit tests in `skill_runtime.rs`) for event emission and loader `load()`. **Full test suite / `cargo test` workspace run deferred** in phase verification — use scoped test filters.

## Claude's Discretion

- Module placement for Rust `RuntimeEvent` types (`application/execution/` vs `interop/`) — mirror TS layering; keep interop-specific emit helper in `skill_runtime.rs`.
- Whether manifest loader paths merge into `SkillInteropConfig.search_paths` or remain loader-scoped — prefer merging discovered paths so `skill` tool resolves declarative manifest paths.

## Deferred Ideas

- Full JSONL event export sink parity with TS `FileEventExportSink` — not required if in-memory/test sink proves lifecycle contract.
- Full workspace `cargo test` in phase verify — deferred.
- TS-side ManifestSkillLoader (Node runtime) — out of scope; requirement targets Rust stub from Phase 65.

## Upstream

- Phase 65 deferred: warning strings only, no `SKILL_PARSE_ERROR` lifecycle events (`65-01-SUMMARY.md`).
- TS reference: `tests/runtime/interop/mcp-skill-interoperability.test.ts` asserts `store.events[0]?.code === "SKILL_PARSE_ERROR"`.
- `ManifestSkillLoader` currently registers name + path only; no `load()` on trait (`crates/rlm-core/src/ports/skill_loader.rs`).
