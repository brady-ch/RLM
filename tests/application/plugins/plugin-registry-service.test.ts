import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { parseArgs } from "../../../src/cli/args.js";
import { createPluginRegistryService } from "../../../src/application/plugins/index.js";
import {
  DEFAULT_PROJECT_CONFIG,
  type LoadedProjectConfig,
} from "../../../src/application/project-config.js";
import type { PluginListItem } from "../../../src/application/plugins/plugin-registry-service.js";
import type { PluginDoctorIssue } from "../../../src/application/plugins/plugin-registry-service.js";

async function createProjectFixture(): Promise<{
  root: string;
  userRoot: string;
  userCatalogPath: string;
  loadedConfig: LoadedProjectConfig;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), "rlm-plugin-mgr-project-"));
  const userRoot = await mkdtemp(join(tmpdir(), "rlm-plugin-mgr-user-"));
  const userCatalogPath = join(userRoot, "catalog.json");
  await writeFile(join(root, "rlm.config.yaml"), "extensions:\n  load: []\n", "utf8");
  const config = structuredClone(DEFAULT_PROJECT_CONFIG);
  config.extensions = { load: [] };

  return {
    root,
    userRoot,
    userCatalogPath,
    loadedConfig: {
      path: join(root, "rlm.config.yaml"),
      config,
    },
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
      await rm(userRoot, { recursive: true, force: true });
    },
  };
}

async function writeSamplePlugin(dir: string, id = "demo.test.plugin"): Promise<string> {
  const pluginDir = join(dir, "sample-plugin");
  await mkdir(pluginDir, { recursive: true });
  const entryPath = join(pluginDir, "index.mjs");
  await writeFile(
    join(pluginDir, "rlm.plugin.json"),
    JSON.stringify({
      id,
      name: "Demo Plugin",
      version: "1.0.0",
      category: "interop",
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
  return pluginDir;
}

test("parseArgs handles plugin list with json flag", () => {
  const options = parseArgs(["plugin", "list", "--json"]);
  assert.equal(options.command, "plugin");
  assert.equal(options.pluginSubcommand, "list");
  assert.equal(options.json, true);
});

test("PluginRegistryService lists builtins and installed plugins", async () => {
  const fixture = await createProjectFixture();
  try {
    const sourceDir = await writeSamplePlugin(fixture.root);
    const registry = createPluginRegistryService({
      projectRoot: fixture.root,
      loadedConfig: fixture.loadedConfig,
      userCatalogPath: fixture.userCatalogPath,
      userPluginsRoot: fixture.userRoot,
    });

    await registry.installLocal(sourceDir);
    const plugins = await registry.list();
    assert.ok(
      plugins.some(
        (plugin: PluginListItem) =>
          plugin.id === "rlm.builtin.shell" && plugin.source === "builtin",
      ),
    );
    const installed = plugins.find((plugin: PluginListItem) => plugin.id === "demo.test.plugin");
    assert.ok(installed);
    assert.equal(installed?.source, "local");
    assert.equal(installed?.enabled, true);
    assert.deepEqual(installed?.tools, ["demo_tool"]);
  } finally {
    await fixture.cleanup();
  }
});

test("PluginRegistryService install returns requiresRestart and pre-approves allowlist", async () => {
  const fixture = await createProjectFixture();
  try {
    const sourceDir = await writeSamplePlugin(fixture.root);
    const registry = createPluginRegistryService({
      projectRoot: fixture.root,
      loadedConfig: fixture.loadedConfig,
      userCatalogPath: fixture.userCatalogPath,
      userPluginsRoot: fixture.userRoot,
    });

    const result = await registry.installLocal(sourceDir);
    assert.deepEqual(result, {
      ok: true,
      id: "demo.test.plugin",
      requiresRestart: true,
    });

    const allowlist = JSON.parse(
      await readFile(join(fixture.root, ".rlm-allowlist.json"), "utf8"),
    ) as Record<string, string>;
    assert.ok(Object.values(allowlist).some((path) => path.includes("demo.test.plugin")));
  } finally {
    await fixture.cleanup();
  }
});

test("PluginRegistryService enable and disable mutate catalog", async () => {
  const fixture = await createProjectFixture();
  try {
    const sourceDir = await writeSamplePlugin(fixture.root);
    const registry = createPluginRegistryService({
      projectRoot: fixture.root,
      loadedConfig: fixture.loadedConfig,
      userCatalogPath: fixture.userCatalogPath,
      userPluginsRoot: fixture.userRoot,
    });
    await registry.installLocal(sourceDir);

    const disabled = await registry.disable("demo.test.plugin");
    assert.equal(disabled.requiresRestart, true);
    let listed = await registry.list();
    assert.equal(
      listed.find((plugin: PluginListItem) => plugin.id === "demo.test.plugin")?.enabled,
      false,
    );

    const enabled = await registry.enable("demo.test.plugin");
    assert.equal(enabled.requiresRestart, true);
    listed = await registry.list();
    assert.equal(
      listed.find((plugin: PluginListItem) => plugin.id === "demo.test.plugin")?.enabled,
      true,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("PluginRegistryService uninstall removes catalog entry and install dir", async () => {
  const fixture = await createProjectFixture();
  try {
    const sourceDir = await writeSamplePlugin(fixture.root);
    const registry = createPluginRegistryService({
      projectRoot: fixture.root,
      loadedConfig: fixture.loadedConfig,
      userCatalogPath: fixture.userCatalogPath,
      userPluginsRoot: fixture.userRoot,
    });
    await registry.installLocal(sourceDir);
    await registry.uninstall("demo.test.plugin");

    const listed = await registry.list();
    assert.equal(
      listed.find((plugin: PluginListItem) => plugin.id === "demo.test.plugin"),
      undefined,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("PluginRegistryService doctor reports missing paths", async () => {
  const fixture = await createProjectFixture();
  try {
    await mkdir(join(fixture.userRoot), { recursive: true });
    await writeFile(
      fixture.userCatalogPath,
      JSON.stringify({
        plugins: [
          {
            id: "ghost.plugin",
            path: join(fixture.userRoot, "ghost.plugin", "index.mjs"),
            enabled: true,
            source: "local",
          },
        ],
      }),
      "utf8",
    );

    const registry = createPluginRegistryService({
      projectRoot: fixture.root,
      loadedConfig: fixture.loadedConfig,
      userCatalogPath: fixture.userCatalogPath,
      userPluginsRoot: fixture.userRoot,
    });
    const report = await registry.doctor();
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue: PluginDoctorIssue) => issue.code === "missing_path"));
  } finally {
    await fixture.cleanup();
  }
});

test("PluginRegistryService inspect and validate are manifest-only", async () => {
  const fixture = await createProjectFixture();
  try {
    const sourceDir = await writeSamplePlugin(fixture.root);
    const registry = createPluginRegistryService({
      projectRoot: fixture.root,
      loadedConfig: fixture.loadedConfig,
      userCatalogPath: fixture.userCatalogPath,
      userPluginsRoot: fixture.userRoot,
    });

    const manifest = await registry.validatePath(sourceDir);
    assert.equal(manifest.id, "demo.test.plugin");

    await registry.installLocal(sourceDir);
    const inspected = await registry.inspect("demo.test.plugin");
    assert.equal(inspected.manifest.id, "demo.test.plugin");
  } finally {
    await fixture.cleanup();
  }
});

test("PluginRegistryService doctor reports duplicate ids across catalogs", async () => {
  const fixture = await createProjectFixture();
  try {
    const projectCatalogPath = join(fixture.root, ".rlm", "plugins", "catalog.json");
    await mkdir(join(fixture.root, ".rlm", "plugins"), { recursive: true });
    await mkdir(fixture.userRoot, { recursive: true });
    const entry = {
      id: "dup.plugin",
      path: join(fixture.userRoot, "dup.plugin", "index.mjs"),
      enabled: false,
      source: "local" as const,
    };
    await writeFile(fixture.userCatalogPath, JSON.stringify({ plugins: [entry] }), "utf8");
    await writeFile(projectCatalogPath, JSON.stringify({ plugins: [entry] }), "utf8");

    const registry = createPluginRegistryService({
      projectRoot: fixture.root,
      loadedConfig: fixture.loadedConfig,
      userCatalogPath: fixture.userCatalogPath,
      userPluginsRoot: fixture.userRoot,
    });
    const report = await registry.doctor();
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue: PluginDoctorIssue) => issue.code === "duplicate_id"));
  } finally {
    await fixture.cleanup();
  }
});
