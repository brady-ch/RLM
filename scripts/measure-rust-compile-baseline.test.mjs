import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "measure-rust-compile-baseline.sh");

test("measure-rust-compile-baseline.sh passes bash syntax check", () => {
  const result = spawnSync("bash", ["-n", SCRIPT], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || "bash -n failed");
});

test("run_timed_step exits 1 when cargo step fails", () => {
  const source = fs.readFileSync(SCRIPT, "utf8");
  assert.match(source, /if ! elapsed="\$\(time_build/, "run_timed_step must guard time_build failure");
  assert.match(source, /exit 1/, "run_timed_step must exit 1 on failure");
  assert.match(source, /rc=\$\?/, "time_build must capture command exit code");
  assert.match(source, /return "\$rc"/, "time_build must propagate exit code");
});
