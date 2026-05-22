import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(__dirname, "check-rust-boundaries.sh");

function runScript(cwd, extraArgs = []) {
  return spawnSync("bash", [SCRIPT, ...extraArgs], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, RLM_BOUNDARY_REPO_ROOT: cwd },
  });
}

test("fails with no-domain-to-persistence on domain fixture import", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rlm-boundary-"));
  const rules = path.join(REPO_ROOT, "scripts", "rust-boundary-rules.toml");
  const baseline = path.join(REPO_ROOT, "scripts", "rust-boundary-baseline.json");
  fs.mkdirSync(path.join(tmp, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "crates/rlm-core/src/domain"), { recursive: true });
  fs.copyFileSync(rules, path.join(tmp, "scripts/rust-boundary-rules.toml"));
  fs.copyFileSync(baseline, path.join(tmp, "scripts/rust-boundary-baseline.json"));
  fs.writeFileSync(
    path.join(tmp, "crates/rlm-core/src/domain/violation_fixture.rs"),
    "use crate::persistence::FileRunStateStore;\n",
  );
  const result = runScript(tmp, ["--strict"]);
  assert.notEqual(result.status, 0, "expected non-zero exit for domain→persistence");
  const combined = `${result.stdout}\n${result.stderr}`;
  assert.match(combined, /no-domain-to-persistence/);
});

test("fails with no-persistence-to-application on pub use fixture", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rlm-boundary-"));
  const rules = path.join(REPO_ROOT, "scripts", "rust-boundary-rules.toml");
  const baseline = path.join(REPO_ROOT, "scripts", "rust-boundary-baseline.json");
  fs.mkdirSync(path.join(tmp, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "crates/rlm-core/src/persistence"), { recursive: true });
  fs.copyFileSync(rules, path.join(tmp, "scripts/rust-boundary-rules.toml"));
  fs.writeFileSync(path.join(tmp, "scripts/rust-boundary-baseline.json"), "[]\n");
  fs.writeFileSync(
    path.join(tmp, "crates/rlm-core/src/persistence/config.rs"),
    "pub use crate::application::config::LoadedProjectConfig;\n",
  );
  const result = runScript(tmp, ["--strict"]);
  assert.notEqual(result.status, 0);
  const combined = `${result.stdout}\n${result.stderr}`;
  assert.match(combined, /no-persistence-to-application/);
});

test("passes on production repo scan with baseline", () => {
  const result = runScript(REPO_ROOT);
  assert.equal(
    result.status,
    0,
    `boundary check failed:\n${result.stdout}\n${result.stderr}`,
  );
});
