import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("source has no runNode function", () => {
  const source = readRuntimeSource();
  assert.doesNotMatch(source, /function runNode\(/);
  assert.doesNotMatch(source, /dist\/src\/index\.js/);
});

test("RLM_RUNTIME warning is emitted but Rust path is used", () => {
  const env = { ...process.env, RLM_RUNTIME: "node" };
  const result = spawnSync(process.execPath, [RUNTIME_SCRIPT, "--help"], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8",
  });
  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.match(
    combined,
    /RLM_RUNTIME.*ignored/i,
    "stale RLM_RUNTIME should warn",
  );
  assert.doesNotMatch(
    combined,
    /Node CLI entry missing/,
    "RLM_RUNTIME=node must not invoke node dist",
  );
  assert.match(
    combined,
    /ask|ui|plugin/i,
    "should show Rust CLI subcommands",
  );
});

test("spawnSync --help succeeds with Rust subcommands", () => {
  const result = spawnSync(process.execPath, [RUNTIME_SCRIPT, "--help"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.equal(result.status, 0, combined);
  assert.doesNotMatch(combined, /Node CLI entry missing/);
  assert.match(combined, /ask|ui|plugin/i);
});

test("blank RLM_RUNTIME invokes Rust without error", () => {
  const env = { ...process.env, RLM_RUNTIME: "   " };
  const result = spawnSync(process.execPath, [RUNTIME_SCRIPT, "--version"], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8",
  });
  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.doesNotMatch(combined, /Unknown RLM_RUNTIME/);
  assert.doesNotMatch(combined, /Node CLI entry missing/);
});
