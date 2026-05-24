import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const RUNTIME_SCRIPT = path.join(__dirname, "rlm-runtime.mjs");

test("default runtime constant is rust", () => {
  const source = readFileSync(RUNTIME_SCRIPT, "utf8");
  const defaultLine = source
    .split("\n")
    .find((line) => line.includes("process.env.RLM_RUNTIME") && line.includes("??"));
  assert.ok(defaultLine, "expected RLM_RUNTIME default line with ??");
  assert.match(defaultLine, /\?\?\s*"rust"/, "default fallback must be rust");
  assert.doesNotMatch(defaultLine, /\?\?\s*"node"/, "default fallback must not be node");
});

test("defaults to rust when RLM_RUNTIME unset", () => {
  const env = { ...process.env };
  delete env.RLM_RUNTIME;
  const result = spawnSync(process.execPath, [RUNTIME_SCRIPT, "--version"], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8",
  });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  assert.doesNotMatch(
    combined,
    /Node CLI entry missing/,
    "unset RLM_RUNTIME must not take Node path",
  );
  assert.ok(
    /Rust rlm binary|cargo build|Compiling rlm-cli|--version/.test(combined),
    `expected Rust dispatch output, got: ${combined.slice(0, 500)}`,
  );
});

test("RLM_RUNTIME=node preserves node path", () => {
  const source = readFileSync(RUNTIME_SCRIPT, "utf8");
  assert.match(source, /runtime === "node"/);
  assert.match(source, /function runNode\(\)/);
  const entry = path.join(REPO_ROOT, "dist", "src", "index.js");
  if (existsSync(entry)) {
    return;
  }
  const env = { ...process.env, RLM_RUNTIME: "node" };
  const result = spawnSync(process.execPath, [RUNTIME_SCRIPT, "--version"], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8",
  });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  assert.match(combined, /Node CLI entry missing/);
});
