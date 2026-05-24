import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

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
