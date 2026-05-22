---
phase: 71-optional-crate-split
reviewed: 2026-05-22T23:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - scripts/measure-rust-compile-baseline.sh
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
  fixed: 6
status: fixed
---

# Phase 71: Code Review Report

**Reviewed:** 2026-05-22T23:00:00Z  
**Depth:** standard  
**Files Reviewed:** 1  
**Status:** fixed (all Critical/Warning/Info addressed in scripts/measure-rust-compile-baseline.sh)

## Summary

Reviewed `scripts/measure-rust-compile-baseline.sh`, the Phase 71 compile-baseline measurement script. The stdout-to-markdown leak fix (`"$@" >&2` inside `time_build`) is correct — only the elapsed seconds reach command substitution. However, **`time_build` silently discards the exit status of `cargo` commands**, so build/test failures do not abort the script and the step-5 `if !` guard is ineffective. A failing `cargo build` or `cargo test` still produces a numeric timing and the script writes a complete-looking `71-BASELINE.md` with bogus data.

## Critical Issues

### CR-01: `time_build` swallows cargo failures — baseline written on error

**File:** `scripts/measure-rust-compile-baseline.sh:16-24,60-82`  
**Issue:** `time_build` runs `"$@" >&2` but never captures or returns its exit code. The function's return status is always that of the final `echo "$elapsed"`, which succeeds even when `cargo build` or `cargo test` fails. Because command substitution disables `errexit` for failures inside shell functions, assignments like `clean_build="$(time_build clean cargo build …)"` succeed and the script continues through all five steps and writes the markdown output.

Reproduced locally:

```bash
# Simulated failing cargo inside time_build — script exits 0 and assigns clean_build=0
clean_build="$(time_build clean bash -c 'echo build failed >&2; exit 1')"
# → prints "continuing...", writes baseline with fake timings
```

The step-5 `if ! test_wall="$(time_build tests …)"` block is equally ineffective for the same reason — `time_build` returns 0 after a failed test run.

**Fix:** Capture the command exit code and return it from `time_build`; apply explicit failure checks (or rely on `set -e` once return is propagated) for all five steps:

```bash
time_build() {
  shift
  local start end elapsed rc
  start="$(date +%s)"
  "$@" >&2
  rc=$?
  end="$(date +%s)"
  elapsed=$((end - start))
  echo "$elapsed"
  return "$rc"
}

if ! clean_build="$(time_build clean cargo build -p rlm-core)"; then
  echo "ERROR: cargo build -p rlm-core (clean) failed; baseline incomplete." >&2
  exit 1
fi
# Repeat the same if ! / exit 1 pattern for inc_domain, inc_ports, inc_application, test_wall
```

---

## Warnings

### WR-01: Build steps 1–4 lack explicit failure messages

**File:** `scripts/measure-rust-compile-baseline.sh:58-76`  
**Issue:** Only step 5 (tests) has a user-facing `"baseline incomplete"` error message. Once CR-01 is fixed, steps 1–4 will abort via `set -e` or `if !`, but operators only see raw `cargo` stderr with no step label. Inconsistent with step 5 and the plan requirement that compile failures must not be masked.  
**Fix:** Wrap each `time_build` assignment in an `if ! …; then echo "ERROR: [step N] …" >&2; exit 1; fi` block (same pattern as lines 79–82).

### WR-02: Failed run leaves stale baseline file

**File:** `scripts/measure-rust-compile-baseline.sh:88`  
**Issue:** `71-BASELINE.md` is only overwritten on full success at line 88. If the script exits mid-run (after CR-01 is fixed), the previous baseline file remains with no indication it is stale. A reader may treat outdated numbers as current.  
**Fix:** Delete or truncate `"$OUTPUT"` at script start (after `mkdir -p`), or write a `"status: incomplete"` header before measurements begin and replace on success.

### WR-03: Wall-clock timing limited to one-second resolution

**File:** `scripts/measure-rust-compile-baseline.sh:19-22`  
**Issue:** `date +%s` truncates sub-second duration. Incremental builds measured at 1–2 s in the existing baseline could read as `0s` on a faster machine, skewing split/defer trigger evaluation near thresholds.  
**Fix:** Use `date +%s.%N` (GNU date) or `/usr/bin/time -f '%e'` as suggested in the phase plan, and format to one decimal place.

---

## Info

### IN-01: Generated note mischaracterizes `--no-fail-fast`

**File:** `scripts/measure-rust-compile-baseline.sh:48`  
**Issue:** The emitted note says *"fails fast on compile errors"* while the command uses `--no-fail-fast`, which only affects test-failure stopping behavior (compile errors always abort regardless). The wording may confuse readers comparing flag name vs. note.  
**Fix:** Reword to: *"library unit tests only; `--no-fail-fast` runs all tests even if one assertion fails; compile errors still abort immediately."*

### IN-02: `cargo clean` duration excluded from reported "Clean build" row

**File:** `scripts/measure-rust-compile-baseline.sh:59-60`  
**Issue:** The table row labeled "Clean build" times only `cargo build`, not the preceding `cargo clean -p rlm-core`. Notes section clarifies this, but the row label alone is ambiguous.  
**Fix:** Rename the row to *"Rebuild after clean"* or add clean-step timing as a separate row.

---

_Reviewed: 2026-05-22T23:00:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_

## Fixes Applied (2026-05-22)

- **CR-01:** `time_build` now returns cargo exit code; `run_timed_step` aborts with labeled error
- **WR-01:** All five steps use consistent ERROR messages on failure
- **WR-02:** Truncate output file at script start to avoid stale baseline
- **WR-03:** Sub-second timing via `date +%s.%N` with one decimal place
- **IN-01:** Clarified `--no-fail-fast` note in generated markdown
- **IN-02:** Renamed clean build row to "Rebuild after clean"
