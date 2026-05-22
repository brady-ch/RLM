import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { ExtensionHost } from "../src/runtime/composition/extension-host.js";
import type { ExtensionHostPort } from "../src/ports/extension-host-port.js";
import type { ToolExecutionResult, ToolPort } from "../src/ports/tool-port.js";

class SyntheticTool implements ToolPort {
  readonly description = "Synthetic test tool.";
  readonly schema = {};

  constructor(readonly name: string) {}

  async execute(): Promise<ToolExecutionResult> {
    return {
      status: "success",
      output: this.name,
    };
  }
}

test("third-party tool extension loads after preApprove and executes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-extension-"));
  try {
    const configPath = join(dir, "rlm.config.yaml");
    const allowlistPath = join(dir, ".rlm-allowlist.json");
    const extensionPath = join(dir, "third-party-extension.mjs");
    await writeFile(configPath, "extensions:\n  load: []\n", "utf8");
    await writeFile(
      extensionPath,
      `
export function register(host) {
  host.tools.register({
    name: "third_party_echo",
    description: "Third-party echo tool.",
    schema: {},
    async execute(args) {
      return { status: "success", output: String(args.text ?? "") };
    },
  });
}
`,
      "utf8",
    );

    const host = new ExtensionHost();
    await host.preApprove(extensionPath, allowlistPath);
    await host.loadExternal([{ path: "./third-party-extension.mjs", agents: ["default"] }], {
      configFilePath: configPath,
      allowlistPath,
      interactive: false,
    });

    const tool = host.tools.get("third_party_echo");
    assert.ok(tool);
    assert.deepEqual(await tool.execute({ text: "loaded" }), {
      status: "success",
      output: "loaded",
    });

    const allowlist = JSON.parse(await readFile(allowlistPath, "utf8")) as Record<string, string>;
    assert.equal(Object.values(allowlist)[0], extensionPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("extension missing register rejects with register message", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-extension-"));
  try {
    const configPath = join(dir, "rlm.config.yaml");
    const allowlistPath = join(dir, ".rlm-allowlist.json");
    const extensionPath = join(dir, "missing-register.mjs");
    await writeFile(configPath, "extensions:\n  load: []\n", "utf8");
    await writeFile(extensionPath, "export const value = 1;\n", "utf8");

    const host = new ExtensionHost();
    await host.preApprove(extensionPath, allowlistPath);

    await assert.rejects(
      () =>
        host.loadExternal([{ path: extensionPath, agents: [] }], {
          configFilePath: configPath,
          allowlistPath,
          interactive: false,
        }),
      /register/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("duplicate tools.register name throws", () => {
  const host = new ExtensionHost();
  host.tools.register(new SyntheticTool("duplicate"));

  assert.throws(
    () => host.tools.register(new SyntheticTool("duplicate")),
    /Duplicate tool registration: duplicate/,
  );
});

test("loadBuiltins registers synthetic builtin without allowlist", () => {
  const host = new ExtensionHost();
  const builtin = {
    path: "synthetic-builtin",
    register(target: ExtensionHostPort): void {
      target.tools.register(new SyntheticTool("builtin_echo"));
    },
  };

  host.loadBuiltins([builtin]);

  assert.equal(host.tools.get("builtin_echo")?.name, "builtin_echo");
});
