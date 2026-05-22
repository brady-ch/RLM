---
phase: 70-rust-boundary-enforcement
reviewed: 2026-05-22T23:30:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - AGENTS.md
  - scripts/rust-boundary-rules.toml
  - scripts/check-rust-boundaries.sh
  - scripts/rust-boundary-baseline.json
  - scripts/rust-boundary-check.test.mjs
  - crates/rlm-core/src/domain/run_state_persistence.rs
  - crates/rlm-core/tests/run_state_persistence_boundary.rs
  - package.json
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 70: Code Review Report

**Reviewed:** 2026-05-22T23:30:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 70 delivers a workable Rust boundary gate: TOML rules align with AGENTS.md, domain production code correctly uses ports instead of persistence, and the baseline documents six transitional plugin arcs. The scanner passes on the current tree and the domain→persistence meta-test works under `--strict`.

The main weakness is **import detection completeness**. The scanner only matches plain `use crate::…` / `use rlm_core::…` lines and ignores `pub use`, leaving at least one enforced forbidden arc undetected in production. Meta-tests for the scanner are also not wired into `npm test` or `check:rust`, so scanner regressions would not fail the default check chain.

## Warnings

### WR-01: `pub use` re-exports bypass forbidden-arc detection

**File:** `scripts/check-rust-boundaries.sh:136-139`
**Issue:** `import_layers_from_file` greps only lines matching `^[[:space:]]*use[[:space:]]+(crate|rlm_core)::`. `pub use` re-exports are not scanned. A live violation exists: `crates/rlm-core/src/persistence/config.rs:1` re-exports `crate::application::config::…`, which violates the enforced `no-persistence-to-application` rule but passes CI.

**Fix:** Extend detection to include `pub use` (and ideally brace-grouped imports):

```bash
strip_test_modules < "${file}" | grep -E '^[[:space:]]*(pub[[:space:]]+)?use[[:space:]]+(crate|rlm_core)::' || true
```

Add a meta-test fixture with `pub use crate::application::…` under `persistence/` and assert `--strict` fails.

### WR-02: Top-level `src/*.rs` files get non-layer layer names

**File:** `scripts/check-rust-boundaries.sh:104-117`
**Issue:** `layer_from_path` takes the first path segment after `rlm-core/src/`. Files directly under `src/` (e.g. `lib.rs`, `server.rs`) resolve to layers `lib.rs` and `server.rs`, not documented concern names (`server`, crate root). No forbidden rules match these names today, so imports in `server.rs` (`use crate::application::…`, `use crate::control_server`) are never evaluated. Future rules for the `server` layer would silently not apply.

**Fix:** Treat crate-root modules explicitly, e.g. map `server.rs` → `server`, and either skip `lib.rs` (facade-only) or assign a dedicated `crate-root` layer with documented policy:

```bash
if [[ "${rel}" == "server.rs" ]]; then echo "server"; return; fi
if [[ "${rel}" == "lib.rs" ]]; then echo "lib"; return; fi
```

### WR-03: Scanner meta-tests not wired into npm check chain

**File:** `package.json:36-37`, `scripts/rust-boundary-check.test.mjs`
**Issue:** `check:rust:boundaries` runs only the bash scanner. `rust-boundary-check.test.mjs` (domain fixture failure + repo pass tests) is documented in phase verification but is not invoked by `npm test`, `check`, or `check:rust`. A broken scanner could ship while the bash script still exits 0 on the real repo.

**Fix:** Chain meta-tests into the boundaries script entry:

```json
"check:rust:boundaries": "node --test scripts/rust-boundary-check.test.mjs && bash scripts/check-rust-boundaries.sh"
```

### WR-04: Default CI path uses baseline, not `--strict`

**File:** `package.json:37`, `scripts/check-rust-boundaries.sh:168-171`
**Issue:** `check:rust:boundaries` runs without `--strict`, so the six baselined plugin violations are permanently allowed and **new** violations can be masked by adding JSON baseline entries. AGENTS.md documents this for transitional arcs, but unlike TS (`depcruise:strict` with empty baseline), there is no strict gate in the default Rust check chain. The only guard for `no-domain-to-persistence` in baseline is a grep on the rule name string.

**Fix:** Add a strict pass to the check chain (fail on any violation including baselined arcs), or add `check:rust:boundaries:strict` and run it in `check:rust` after the baseline pass:

```json
"check:rust:boundaries:strict": "bash scripts/check-rust-boundaries.sh --strict",
"check:rust": "... && npm run check:rust:boundaries && npm run check:rust:boundaries:strict && ..."
```

Keep baseline mode only for documenting shrink-wrapped transitional debt if both passes are required.

### WR-05: Test-module stripping only matches `mod tests`

**File:** `scripts/check-rust-boundaries.sh:119-134`
**Issue:** Production scan strips only the pattern `#[cfg(test)]` immediately followed by `mod tests { … }`. A forbidden import inside `#[cfg(test)] mod integration_tests { … }`, `#[cfg(test)] mod foo_tests { … }`, or a non-`tests`-named inline test module would remain in the production scan path and could hide domain→persistence imports in source files (integration tests under `crates/rlm-core/tests/` are out of scope by design).

**Fix:** Strip any `#[cfg(test)] mod <ident> { … }` block, or strip all `#[cfg(test)]` braced modules regardless of name:

```awk
/#\[cfg\(test\)\]/ { if (getline nextline) { if (nextline ~ /^[[:space:]]*mod[[:space:]]+[a-zA-Z_][a-zA-Z0-9_]*/) { skip=1; depth=0; next } ...
```

Add a meta-test with `mod integration_tests` containing a forbidden import.

## Info

### IN-01: Unreachable success after mutation retry loops

**File:** `crates/rlm-core/src/domain/run_state_persistence.rs:95,125`
**Issue:** After the `for attempt in 0..3` loops in `persist_node_status` and `persist_resume_cursor`, a trailing `Ok(())` is unreachable when the loop exhausts (attempt 2 always returns `Err` on conflict). Dead code suggests incomplete loop logic review.

**Fix:** Remove the trailing `Ok(())` or replace with `unreachable!()` / explicit `Err` for clarity.

### IN-02: `exclude_globs` in TOML is unused

**File:** `scripts/rust-boundary-rules.toml:16`, `scripts/check-rust-boundaries.sh:219`
**Issue:** Rules declare `exclude_globs = ["**/target/**"]` but the scanner's `find` does not read or apply them. Harmless today because scan roots are `src/` only, but the config is misleading.

**Fix:** Parse `exclude_globs` and pass `-path` prune expressions to `find`, or remove the unused key from TOML.

### IN-03: No npm script alias for strict boundary mode

**File:** `package.json:37`
**Issue:** `--strict` exists on the bash script but has no npm alias, unlike TS `depcruise:strict`. Developers must discover the flag from AGENTS.md or script `--help`.

**Fix:** Add `"check:rust:boundaries:strict": "bash scripts/check-rust-boundaries.sh --strict"`.

### IN-04: Meta-test coverage gaps

**File:** `scripts/rust-boundary-check.test.mjs`
**Issue:** Only two tests exist: domain→persistence fixture under `--strict`, and full-repo pass with baseline. Missing coverage for: baseline guard rejecting `no-domain-to-persistence`, baseline allowing listed plugin arcs, `pub use` detection, cli layer skip, and strict-vs-non-strict divergence.

**Fix:** Add focused fixtures for each behavior listed above.

---

_Reviewed: 2026-05-22T23:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
