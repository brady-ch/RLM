#!/usr/bin/env bash
# Measure rlm-core compile/test iteration baseline for Phase 71 split/defer gate.
# Note: Phases 69–70 must be complete before baseline is authoritative.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUTPUT="${1:-.planning/phases/71-optional-crate-split/71-BASELINE.md}"
mkdir -p "$(dirname "$OUTPUT")"
: > "$OUTPUT"

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
git_sha="$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")"
rustc_version="$(rustc --version 2>/dev/null || echo "rustc unavailable")"

time_build() {
  shift # discard label
  local start end elapsed rc
  start="$(date +%s.%N)"
  "$@" >&2
  rc=$?
  end="$(date +%s.%N)"
  elapsed="$(awk -v s="$start" -v e="$end" 'BEGIN { printf "%.1f", e - s }')"
  echo "$elapsed"
  return "$rc"
}

run_timed_step() {
  local label="$1"
  local var_name="$2"
  shift 2
  local elapsed
  if ! elapsed="$(time_build "$label" "$@")"; then
    echo "ERROR: ${label} failed; baseline incomplete." >&2
    exit 1
  fi
  printf -v "$var_name" '%s' "$elapsed"
}

emit_table() {
  cat <<EOF
# rlm-core Compile Baseline

**Captured:** ${timestamp}  
**Git SHA:** ${git_sha}  
**Toolchain:** ${rustc_version}

> Phases 69–70 must be complete before this baseline is authoritative for split decisions.

| Measurement | Wall seconds |
|-------------|-------------:|
| Rebuild after clean (\`cargo build -p rlm-core\`) | ${clean_build}s |
| Incremental domain (\`domain/types.rs\`) | ${inc_domain}s |
| Incremental ports (\`ports/language_model.rs\`) | ${inc_ports}s |
| Incremental application (\`application/mod.rs\`) | ${inc_application}s |
| Test iteration (\`cargo test -p rlm-core --lib --no-fail-fast\`) | ${test_wall}s |

## Notes

- Clean build: \`cargo clean -p rlm-core\` then timed rebuild (clean step not included in row).
- Incremental: touch target file, then \`cargo build -p rlm-core\`.
- Test iteration: library unit tests only; \`--no-fail-fast\` runs all tests even if one assertion fails; compile errors abort immediately.
EOF
}

echo "=== rlm-core compile baseline ==="
echo "Timestamp: ${timestamp}"
echo "Git SHA:   ${git_sha}"
echo "Rustc:     ${rustc_version}"
echo

echo "[1/5] Clean build..."
cargo clean -p rlm-core
run_timed_step "cargo build -p rlm-core (clean rebuild)" clean_build cargo build -p rlm-core
echo "  ${clean_build}s"

echo "[2/5] Incremental domain (domain/types.rs)..."
touch crates/rlm-core/src/domain/types.rs
run_timed_step "cargo build -p rlm-core (incremental domain)" inc_domain cargo build -p rlm-core
echo "  ${inc_domain}s"

echo "[3/5] Incremental ports (ports/language_model.rs)..."
touch crates/rlm-core/src/ports/language_model.rs
run_timed_step "cargo build -p rlm-core (incremental ports)" inc_ports cargo build -p rlm-core
echo "  ${inc_ports}s"

echo "[4/5] Incremental application (application/mod.rs)..."
touch crates/rlm-core/src/application/mod.rs
run_timed_step "cargo build -p rlm-core (incremental application)" inc_application cargo build -p rlm-core
echo "  ${inc_application}s"

echo "[5/5] Test iteration (cargo test -p rlm-core --lib --no-fail-fast)..."
run_timed_step "cargo test -p rlm-core --lib --no-fail-fast" test_wall cargo test -p rlm-core --lib --no-fail-fast
echo "  ${test_wall}s"

table="$(emit_table)"
echo
echo "$table"
echo "$table" > "$OUTPUT"
echo
echo "Wrote baseline to ${OUTPUT}"
