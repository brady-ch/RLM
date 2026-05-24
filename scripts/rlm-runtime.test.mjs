import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const RUNTIME_SCRIPT = path.join(__dirname, "rlm-runtime.mjs");

function readRuntimeSource() {
  return readFileSync(RUNTIME_SCRIPT, "utf8");
}

test("default runtime constant is rust", () => {
  const source = readRuntimeSource();
  assert.match(
    source,
    /process\.env\.RLM_RUNTIME\s*\?\?\s*"rust"/,
    "expected RLM_RUNTIME nullish coalescing default to be rust",
  );
  const defaultLine = source
    .split("\n")
    .find((line) => line.includes("process.env.RLM_RUNTIME") && line.includes("??"));
  assert.ok(defaultLine, "expected runtime default line");
  assert.doesNotMatch(
    defaultLine,
    /\?\?\s*"node"/,
    "default line must not fall back to node",
  );
});

test("defaults to rust when RLM_RUNTIME unset", () => {
  const env = { ...process.env };
  delete env.RLM_RUNTIME;

  const result = spawnSync(process.execPath, [RUNTIME_SCRIPT, "--version"], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8",
  });

  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.doesNotMatch(
    combined,
    /Node CLI entry missing/,
    "unset RLM_RUNTIME must not take the node path",
  );
  assert.match(
    combined,
    /Rust rlm binary|cargo build|Compiling rlm-cli|--version/i,
    "unset RLM_RUNTIME should invoke rust path or cargo build",
  );
});

test("RLM_RUNTIME=node preserves node path", () => {
  const source = readRuntimeSource();
  assert.match(source, /runtime === "node"/);
  assert.match(source, /function runNode\(\)/);

  const entry = path.join(REPO_ROOT, "dist", "src", "index.js");
  if (existsSync(entry)) {
    return;
  }

  const env = { ...process.env, RLM_RUNTIME: "node" };
  const result = spawnSync(process.execPath, [RUNTIME_SCRIPT, "--help"], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8",
  });
  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.match(combined, /Node CLI entry missing/);
});
