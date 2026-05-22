import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { ExtensionHost } from "../../src/runtime/composition/extension-host.js";
import {
  PluginLoader,
  legacyExtensionId,
  normalizeLegacyExtensionEntries,
  parsePluginManifest,
  type PluginDescriptor,
} from "../../src/plugins/index.js";

test("parsePluginManifest rejects invalid category before import", () => {
  assert.throws(
    () =>
      parsePluginManifest(
        {
          id: "bad.plugin",
          name: "Bad Plugin",
          version: "1.0.0",
          category: "unknown",
          contributes: { tools: ["demo"] },
          engines: { rlm: ">=1.0.0" },
        },
        "test-manifest",
      ),
    /category/,
  );
});

test("normalizeLegacyExtensionEntries assigns stable legacy ids", () => {
  const entries = normalizeLegacyExtensionEntries(
    [{ path: "./custom-extension.mjs", agents: ["default"] }],
    "/tmp/project/rlm.config.yaml",
  );

  assert.equal(entries.length, 1);
  assert.match(entries[0]?.id ?? "", /^legacy\.custom-extension\./);
  assert.equal(entries[0]?.source, "configured");
  assert.equal(entries[0]?.enabled, true);
  assert.equal(legacyExtensionId("/tmp/project/custom-extension.mjs"), entries[0]?.id);
});

test("PluginLoader loads built-in plugins with category metadata", async () => {
  const host = new ExtensionHost();
  const loader = new PluginLoader();

  await loader.loadInto(host, {
    cwd: process.cwd(),
    configFilePath: join(process.cwd(), "rlm.config.yaml"),
    legacyExtensions: [],
    interactive: false,
  });

  assert.ok(host.tools.get("shell"));
  assert.ok(host.tools.get("write_file"));
  assert.ok(host.tools.get("web_search"));
  assert.ok(host.tools.get("web_fetch"));

  const plugins = loader.listPlugins();
  assert.equal(plugins.length, 3);
  assert.deepEqual(plugins.map((plugin: PluginDescriptor) => plugin.category).sort(), [
    "files",
    "shell",
    "web",
  ]);
  assert.ok(plugins.every((plugin: PluginDescriptor) => plugin.source === "builtin"));
  assert.match(loader.formatListOutput(), /\[shell\]/);
});

test("PluginLoader validates external manifest before import", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-plugin-manifest-"));
  try {
    const configPath = join(dir, "rlm.config.yaml");
    const allowlistPath = join(dir, ".rlm-allowlist.json");
    const pluginDir = join(dir, "broken-plugin");
    const entryPath = join(pluginDir, "index.mjs");
    await mkdir(pluginDir, { recursive: true });
    await writeFile(configPath, "extensions:\n  load: []\n", "utf8");
    await writeFile(
      join(pluginDir, "rlm.plugin.json"),
      JSON.stringify({
        id: "demo.plugin",
        name: "Demo",
        version: "1.0.0",
        category: "not-a-real-category",
        contributes: { tools: ["demo_tool"] },
        engines: { rlm: ">=1.0.0" },
      }),
      "utf8",
    );
    await writeFile(
      entryPath,
      'export function register(host) { host.tools.register({ name: "demo_tool", description: "demo", schema: {}, async execute() { return { status: "success", output: "ok" }; } }); }',
      "utf8",
    );

    const host = new ExtensionHost();
    const loader = new PluginLoader();
    await host.preApprove(entryPath, allowlistPath);

    await assert.rejects(
      () =>
        loader.loadInto(host, {
          cwd: dir,
          configFilePath: configPath,
          legacyExtensions: [{ path: entryPath, agents: ["default"] }],
          allowlistPath,
          interactive: false,
        }),
      /category/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("PluginLoader loads legacy extensions.load entries without on-disk manifest", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-plugin-legacy-"));
  try {
    const configPath = join(dir, "rlm.config.yaml");
    const allowlistPath = join(dir, ".rlm-allowlist.json");
    const extensionPath = join(dir, "legacy-extension.mjs");
    await writeFile(configPath, "extensions:\n  load: []\n", "utf8");
    await writeFile(
      extensionPath,
      `
export function register(host) {
  host.tools.register({
    name: "legacy_echo",
    description: "Legacy extension echo tool.",
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
    const loader = new PluginLoader();
    await host.preApprove(extensionPath, allowlistPath);

    await loader.loadInto(host, {
      cwd: dir,
      configFilePath: configPath,
      legacyExtensions: [{ path: extensionPath, agents: ["default"] }],
      allowlistPath,
      interactive: false,
    });

    const tool = host.tools.get("legacy_echo");
    assert.ok(tool);
    assert.deepEqual(await tool.execute({ text: "legacy" }), {
      status: "success",
      output: "legacy",
    });

    const legacyPlugin = loader
      .listPlugins()
      .find((plugin: PluginDescriptor) => plugin.id.startsWith("legacy."));
    assert.ok(legacyPlugin);
    assert.equal(legacyPlugin.category, "interop");
    assert.equal(legacyPlugin.source, "configured");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
