import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  loadProjectConfig,
  resolveRuntimeConfig,
  seedProjectRlmStarter,
} from "../src/application/project-config.js";
import { resolveLaunchMode } from "../src/cli/first-run.js";

test("layered config lets project agent override global agent with same id", async () => {
  const prevHome = process.env.HOME;
  const prevUserProfile = process.env.USERPROFILE;
  const prevCwd = process.cwd();
  const sandbox = await mkdtemp(join(tmpdir(), "rlm-scope-"));
  const fakeHome = join(sandbox, "home");
  const projectRoot = join(sandbox, "project");

  await mkdir(join(fakeHome, ".rlm", "agents"), { recursive: true });
  await mkdir(join(projectRoot, ".rlm", "agents"), { recursive: true });

  await writeFile(
    join(fakeHome, ".rlm", "agents", "a.yaml"),
    `tools: [shell]
models:
  depth: small
  classify: small
  decompose: small
  answer: small
  summarize: small
  synthesize: small
`,
    "utf8",
  );
  await writeFile(
    join(fakeHome, ".rlm", "agents", "b.yaml"),
    `tools: [web_fetch]
models:
  depth: small
  classify: small
  decompose: small
  answer: small
  summarize: small
  synthesize: small
`,
    "utf8",
  );

  await writeFile(
    join(projectRoot, ".rlm", "agents", "a.yaml"),
    `tools: [web_search, web_fetch]
models:
  depth: small
  classify: small
  decompose: small
  answer: small
  summarize: small
  synthesize: small
`,
    "utf8",
  );

  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  process.chdir(projectRoot);

  try {
    const loaded = await loadProjectConfig();

    assert.ok(loaded.config.agents["a"]?.tools.includes("web_search"));
    assert.ok(loaded.config.agents["b"]?.tools.includes("web_fetch"));
  } finally {
    process.chdir(prevCwd);
    process.env.HOME = prevHome;
    process.env.USERPROFILE = prevUserProfile;
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("invalid scoped yaml surfaces the file path in the error message", async () => {
  const prevHome = process.env.HOME;
  const prevUserProfile = process.env.USERPROFILE;
  const prevCwd = process.cwd();
  const sandbox = await mkdtemp(join(tmpdir(), "rlm-bad-yaml-"));
  const fakeHome = join(sandbox, "home");
  const projectRoot = join(sandbox, "project");
  const brokenFile = join(projectRoot, ".rlm", "agents", "bad.yaml");

  await mkdir(join(fakeHome, ".rlm"), { recursive: true });
  await mkdir(join(projectRoot, ".rlm", "agents"), { recursive: true });
  await writeFile(brokenFile, "{{not yaml", "utf8");

  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  process.chdir(projectRoot);

  try {
    await assert.rejects(
      () => loadProjectConfig(),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : "";
        assert.ok(message.includes(brokenFile), message);
        return true;
      },
    );
  } finally {
    process.chdir(prevCwd);
    process.env.HOME = prevHome;
    process.env.USERPROFILE = prevUserProfile;
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("resolveLaunchMode maps env and tty combinations", () => {
  assert.equal(resolveLaunchMode({ RLM_NON_INTERACTIVE: "1" }, true).mode, "ui");
  assert.equal(
    resolveLaunchMode({ RLM_NON_INTERACTIVE: "1", RLM_LAUNCH_MODE: "cli" }, true).mode,
    "cli",
  );
  assert.equal(resolveLaunchMode({}, false).shouldPrompt, false);
  assert.equal(resolveLaunchMode({}, true, "").mode, "ui");
  assert.equal(resolveLaunchMode({}, true, "2").mode, "cli");
});

test("starter seed writes project .rlm once and skips duplicates", async () => {
  const prevCwd = process.cwd();
  const sandbox = await mkdtemp(join(tmpdir(), "rlm-seed-"));
  process.chdir(sandbox);

  try {
    assert.equal(await seedProjectRlmStarter(sandbox), true);
    assert.equal(await seedProjectRlmStarter(sandbox), false);
    const reloaded = await loadProjectConfig();
    assert.ok(reloaded.config.agents["coding"]);
  } finally {
    process.chdir(prevCwd);
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("quality loop config defaults to disabled bounded runtime", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "rlm-quality-loop-default-"));
  try {
    const configPath = join(sandbox, "rlm.config.yaml");
    await writeFile(configPath, "", "utf8");

    const loaded = await loadProjectConfig(configPath);

    assert.deepEqual(loaded.config.runtime.qualityLoop, {
      enabled: false,
      maxIterations: 3,
      budgetBehavior: "stop_before_partial_iteration",
    });
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("quality loop config accepts explicit bounded runtime", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "rlm-quality-loop-explicit-"));
  try {
    const configPath = join(sandbox, "rlm.config.yaml");
    await writeFile(
      configPath,
      `
runtime:
  qualityLoop:
    enabled: true
    maxIterations: 5
    budgetBehavior: stop_before_partial_iteration
`,
      "utf8",
    );

    const loaded = await loadProjectConfig(configPath);

    assert.deepEqual(loaded.config.runtime.qualityLoop, {
      enabled: true,
      maxIterations: 5,
      budgetBehavior: "stop_before_partial_iteration",
    });
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("quality loop config rejects invalid max iterations", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "rlm-quality-loop-invalid-"));
  try {
    const configPath = join(sandbox, "rlm.config.yaml");
    await writeFile(
      configPath,
      `
runtime:
  qualityLoop:
    enabled: true
    maxIterations: 0
    budgetBehavior: stop_before_partial_iteration
`,
      "utf8",
    );

    await assert.rejects(
      () => loadProjectConfig(configPath),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : "";
        assert.ok(message.includes("maxIterations"), message);
        return true;
      },
    );
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("resolveRuntimeConfig deep-merges qualityLoop.phaseModels with CLI overrides", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "rlm-quality-loop-phase-merge-"));
  try {
    const configPath = join(sandbox, "rlm.config.yaml");
    await writeFile(
      configPath,
      `
runtime:
  qualityLoop:
    enabled: false
    maxIterations: 5
    budgetBehavior: stop_before_partial_iteration
    phaseModels:
      gate: large
      critique: small
`,
      "utf8",
    );

    const loaded = await loadProjectConfig(configPath);
    const runtime = resolveRuntimeConfig(loaded.config, {
      qualityLoop: {
        enabled: true,
        maxIterations: 3,
        budgetBehavior: "stop_before_partial_iteration",
      },
    });
    assert.deepEqual(runtime.qualityLoop, {
      enabled: true,
      maxIterations: 3,
      budgetBehavior: "stop_before_partial_iteration",
      phaseModels: {
        gate: "large",
        critique: "small",
      },
    });
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("resolveRuntimeConfig merges phaseModels from YAML and partial CLI phaseModels", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "rlm-quality-loop-phase-both-"));
  try {
    const configPath = join(sandbox, "rlm.config.yaml");
    await writeFile(
      configPath,
      `
runtime:
  qualityLoop:
    phaseModels:
      gate: large
`,
      "utf8",
    );

    const loaded = await loadProjectConfig(configPath);
    const runtime = resolveRuntimeConfig(loaded.config, {
      qualityLoop: {
        enabled: true,
        maxIterations: 3,
        budgetBehavior: "stop_before_partial_iteration",
        phaseModels: { refine: "medium" },
      },
    });
    assert.deepEqual(runtime.qualityLoop?.phaseModels, {
      gate: "large",
      refine: "medium",
    });
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("project config accepts optional sampling defaults and model profiles", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "rlm-sampling-config-"));
  try {
    const configPath = join(sandbox, "rlm.config.yaml");
    await writeFile(
      configPath,
      `
models:
  sampling:
    defaults:
      temperature: 0.4
      topP: 0.9
    modelProfiles:
      granite4.1:3b:
        temperature: 0.2
        maxTokens: 512
`,
      "utf8",
    );

    const loaded = await loadProjectConfig(configPath);

    assert.deepEqual(loaded.config.models.sampling, {
      defaults: {
        temperature: 0.4,
        topP: 0.9,
      },
      modelProfiles: {
        "granite4.1:3b": {
          temperature: 0.2,
          maxTokens: 512,
        },
      },
    });
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
