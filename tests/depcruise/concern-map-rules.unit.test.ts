import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

const PLUGIN_RUNTIME_RULES = [
  "no-plugins-to-application",
  "no-plugins-to-cli",
  "no-plugins-to-domain",
  "no-runtime-to-cli",
  "no-builtin-plugin-to-external-loader",
] as const;

const configText = readFileSync(join(process.cwd(), ".dependency-cruiser.js"), "utf8");

test("plugin and runtime depcruise rules are registered with concern map comments", () => {
  for (const name of PLUGIN_RUNTIME_RULES) {
    assert.match(configText, new RegExp(`name:\\s*"${name}"`));
    const block = configText.slice(
      configText.indexOf(`name: "${name}"`),
      configText.indexOf(`name: "${name}"`) + 400,
    );
    assert.match(block, /AGENTS\.md concern map/);
    assert.match(block, /severity:\s*"warn"/);
  }
});

test("no-runtime-to-cli reports named violation for build-runtime-context", async () => {
  const { stdout } = await execFileAsync(
    "npx",
    [
      "dependency-cruise",
      "src/runtime/composition/build-runtime-context.ts",
      "--config",
      ".dependency-cruiser.js",
      "--output-type",
      "json",
    ],
    { cwd: process.cwd() },
  );

  const report = JSON.parse(stdout) as {
    summary: {
      violations: Array<{ rule: { name: string } }>;
      ruleSetUsed: {
        forbidden: Array<{ name: string; comment: string }>;
      };
    };
  };

  const runtimeCliViolations = report.summary.violations.filter(
    (violation) => violation.rule.name === "no-runtime-to-cli",
  );
  assert.ok(runtimeCliViolations.length >= 1);

  const rule = report.summary.ruleSetUsed.forbidden.find(
    (entry) => entry.name === "no-runtime-to-cli",
  );
  assert.match(String(rule?.comment), /AGENTS\.md concern map/);
});
