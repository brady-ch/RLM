#!/usr/bin/env bash
# Scan Rust sources for forbidden layer imports per scripts/rust-boundary-rules.toml.
# Production paths only: #[cfg(test)] mod tests { ... } blocks are stripped before import scan.
# Usage: check-rust-boundaries.sh [--strict]  (--strict ignores rust-boundary-baseline.json)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${RLM_BOUNDARY_REPO_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
RULES_FILE="${SCRIPT_DIR}/rust-boundary-rules.toml"
BASELINE_FILE="${SCRIPT_DIR}/rust-boundary-baseline.json"
STRICT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict) STRICT=true; shift ;;
    -h | --help)
      echo "Usage: $0 [--strict]"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ ! -f "${RULES_FILE}" ]]; then
  echo "Missing rules file: ${RULES_FILE}" >&2
  exit 2
fi

# --- Parse [[forbidden]] from TOML (name, from_layer, to_layer) ---
declare -a RULE_NAMES=()
declare -a RULE_FROM=()
declare -a RULE_TO=()

parse_rules() {
  local name="" from="" to="" in_block=0
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "${line}" ]] && continue
    if [[ "${line}" == "[[forbidden]]" ]]; then
      if [[ -n "${name}" && -n "${from}" && -n "${to}" ]]; then
        RULE_NAMES+=("${name}")
        RULE_FROM+=("${from}")
        RULE_TO+=("${to}")
      fi
      name=""; from=""; to=""; in_block=1
      continue
    fi
    if [[ "${in_block}" -eq 1 ]]; then
      case "${line}" in
        name\ =\ *)
          name="${line#name = }"
          name="${name//\"/}"
          ;;
        from_layer\ =\ *)
          from="${line#from_layer = }"
          from="${from//\"/}"
          ;;
        to_layer\ =\ *)
          to="${line#to_layer = }"
          to="${to//\"/}"
          ;;
      esac
    fi
  done < "${RULES_FILE}"
  if [[ -n "${name}" && -n "${from}" && -n "${to}" ]]; then
    RULE_NAMES+=("${name}")
    RULE_FROM+=("${from}")
    RULE_TO+=("${to}")
  fi
}

# --- Scan roots from [scan] roots = [...] ---
declare -a SCAN_ROOTS=()

parse_scan_roots() {
  local in_scan=0
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "${line}" ]] && continue
    if [[ "${line}" == "[scan]" ]]; then
      in_scan=1
      continue
    fi
    if [[ "${in_scan}" -eq 1 ]]; then
      if [[ "${line}" == "["* ]]; then
        break
      fi
      if [[ "${line}" =~ ^roots\ = ]]; then
        local roots="${line#roots = }"
        roots="${roots//[\[\]]/}"
        roots="${roots//\"/}"
        IFS=',' read -ra parts <<< "${roots}"
        for part in "${parts[@]}"; do
          part="${part// /}"
          [[ -n "${part}" ]] && SCAN_ROOTS+=("${REPO_ROOT}/${part}")
        done
      fi
    fi
  done < "${RULES_FILE}"
}

layer_from_path() {
  local file="$1"
  local rel=""
  if [[ "${file}" == *"/rlm-cli/src/"* ]]; then
    echo "cli"
    return
  fi
  if [[ "${file}" == *"/rlm-core/src/"* ]]; then
    rel="${file#*rlm-core/src/}"
    if [[ "${rel}" != */* ]]; then
      case "${rel}" in
        server.rs) echo "server"; return ;;
        lib.rs) echo "lib"; return ;;
      esac
    fi
    echo "${rel%%/*}"
    return
  fi
  echo "unknown"
}

# Strip #[cfg(test)] mod <name> { ... } including nested braces (production scan only).
strip_test_modules() {
  awk '
    BEGIN { depth=0; skip=0 }
    /#\[cfg\(test\)\]/ { if (getline nextline) { if (nextline ~ /^[[:space:]]*mod[[:space:]]+[a-zA-Z_][a-zA-Z0-9_]*/) { skip=1; depth=0; next } else { print "#[cfg(test)]"; print nextline } } else { print } next }
    skip {
      for (i=1;i<=length($0);i++) {
        c=substr($0,i,1)
        if (c=="{") depth++
        if (c=="}") { depth--; if (depth<=0) { skip=0; next } }
      }
      next
    }
    { print }
  '
}

import_layers_from_file() {
  local file="$1"
  strip_test_modules < "${file}" | grep -E '^[[:space:]]*(pub[[:space:]]+)?use[[:space:]]+(crate|rlm_core)::' || true
}

target_layer_from_use() {
  local use_line="$1"
  local rest=""
  if [[ "${use_line}" =~ ^[[:space:]]*(pub[[:space:]]+)?use[[:space:]]+crate::([^:;]+) ]]; then
    rest="${BASH_REMATCH[2]}"
    echo "${rest%%::*}"
    return
  fi
  if [[ "${use_line}" =~ ^[[:space:]]*(pub[[:space:]]+)?use[[:space:]]+rlm_core::([^:;]+) ]]; then
    rest="${BASH_REMATCH[2]}"
    echo "${rest%%::*}"
    return
  fi
}

rule_for_arc() {
  local from="$1" to="$2"
  local i
  for i in "${!RULE_NAMES[@]}"; do
    if [[ "${RULE_FROM[$i]}" == "${from}" && "${RULE_TO[$i]}" == "${to}" ]]; then
      echo "${RULE_NAMES[$i]}"
      return 0
    fi
  done
  return 1
}

is_baslined() {
  local rule="$1" file="$2" import_line="$3"
  [[ "${STRICT}" == "true" ]] && return 1
  [[ ! -f "${BASELINE_FILE}" ]] && return 1
  local rel="${file#${REPO_ROOT}/}"
  python3 - "${BASELINE_FILE}" "${rule}" "${rel}" "${import_line}" <<'PY' 2>/dev/null || return 1
import json, sys
path, rule, from_path, import_line = sys.argv[1:5]
with open(path) as f:
    entries = json.load(f)
for e in entries:
    if e.get("rule") == rule and e.get("from") == from_path and e.get("import") == import_line:
        sys.exit(0)
sys.exit(1)
PY
}

parse_rules
parse_scan_roots

if [[ "${#SCAN_ROOTS[@]}" -eq 0 ]]; then
  echo "No scan roots configured in ${RULES_FILE}" >&2
  exit 2
fi

if [[ "${STRICT}" != "true" && -f "${BASELINE_FILE}" ]]; then
  if grep -q 'no-domain-to-persistence' "${BASELINE_FILE}" 2>/dev/null; then
    echo "Baseline must not contain no-domain-to-persistence entries: ${BASELINE_FILE}" >&2
    exit 2
  fi
fi

violations=0

while IFS= read -r -d '' rs_file; do
  from_layer="$(layer_from_path "${rs_file}")"
  [[ "${from_layer}" == "cli" || "${from_layer}" == "unknown" ]] && continue

  while IFS= read -r use_line; do
    [[ -z "${use_line}" ]] && continue
    to_layer="$(target_layer_from_use "${use_line}")"
    [[ -z "${to_layer}" ]] && continue
    rule_name="$(rule_for_arc "${from_layer}" "${to_layer}" || true)"
    [[ -z "${rule_name}" ]] && continue
    if is_baslined "${rule_name}" "${rs_file}" "${use_line}"; then
      continue
    fi
    rel="${rs_file#${REPO_ROOT}/}"
    echo "${rule_name}: ${rel}: ${use_line}" >&2
    violations=$((violations + 1))
  done < <(import_layers_from_file "${rs_file}")
done < <(find "${SCAN_ROOTS[@]}" -name '*.rs' -type f -print0 2>/dev/null)

if [[ "${violations}" -gt 0 ]]; then
  echo "Rust boundary check failed: ${violations} violation(s)" >&2
  exit 1
fi

echo "Rust boundary check passed"
