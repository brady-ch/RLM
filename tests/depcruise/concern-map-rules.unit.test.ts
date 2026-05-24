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

test("plugin and runtime depcruise rules are registered with concern map comments at error severity", () => {
  for (const name of PLUGIN_RUNTIME_RULES) {
    assert.match(configText, new RegExp(`name:\\s*"${name}"`));
    const block = configText.slice(
      configText.indexOf(`name: "${name}"`),
      configText.indexOf(`name: "${name}"`) + 400,
    );
    assert.match(block, /AGENTS\.md concern map/);
    assert.match(block, /severity:\s*"error"/);
  }
});

test("no-plugins-to-application fails strict depcruise with named rule", async () => {
  const fixturePath = join(
    process.cwd(),
    "src/plugins/__depcruise-fixtures__/forbidden-application-import.ts",
  );
  const { stdout } = await execFileAsync(
    "npx",
    [
      "dependency-cruise",
      fixturePath,
      "--config",
      "tests/depcruise/probe.dependency-cruiser.js",
      "--output-type",
      "json",
    ],
    { cwd: process.cwd() },
  );

  const report = JSON.parse(stdout) as {
    summary: {
      violations: Array<{ rule: { name: string; severity: string } }>;
    };
  };

  const pluginAppViolations = report.summary.violations.filter(
    (violation) => violation.rule.name === "no-plugins-to-application",
  );
  assert.ok(pluginAppViolations.length >= 1);
  assert.equal(pluginAppViolations[0]?.rule.severity, "error");
});
